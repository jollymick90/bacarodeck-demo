import { expect, it } from 'vitest';
import { makeBackup, parseBackup, planRestore } from '../src/lib/workspace-backup';
import { parseImport } from '../src/lib/domain';
it('reads legacy backups without requiring conductor collections', () => {
  const backup = makeBackup({});
  backup.version = 1;
  const data = backup.data as Record<string, unknown>;
  delete data.conductorBriefs;
  delete data.speakerInterests;
  expect(parseBackup(JSON.stringify(backup)).data.conductorBriefs).toEqual([]);
});
it('round trips interests and a shared brief', () => {
  const backup = makeBackup({
    speakerInterests: [{ id: 'i', speakerId: 'g', memberUid: 'm' }],
    conductorBriefs: [{ id: 'b', speakerId: 'g', mainQuestionIds: ['q'] }]
  });
  expect(parseBackup(JSON.stringify(backup)).data.speakerInterests[0].memberUid).toBe('m');
});
it('rejects interests in ordinary research import', () => {
  expect(() =>
    parseImport(
      JSON.stringify({
        schemaVersion: 1,
        speakerInterests: [{ id: 'i', speakerId: 'g', memberUid: 'other' }]
      })
    )
  ).toThrow();
});
it('blocks restoring a brief whose questions are missing in both workspaces', () => {
  const source = makeBackup({
    speakers: [{ id: 'g', fullName: 'Giulia' }],
    conductorBriefs: [{ id: 'b', speakerId: 'g', mainQuestionIds: ['missing'] }]
  });
  expect(() => planRestore(source, makeBackup({}))).toThrow();
});
