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
it('imports and restores briefs with more than three main questions', () => {
  const mainQuestionIds = ['q4', 'q2', 'q1', 'q3'];
  const data = {
    speakers: [{ id: 'g', fullName: 'Giulia' }],
    questions: mainQuestionIds.map((id) => ({ id, speakerId: 'g' })),
    conductorBriefs: [{ id: 'b', speakerId: 'g', mainQuestionIds }]
  };
  expect(
    parseImport(JSON.stringify({ schemaVersion: 1, ...data })).conductorBriefs![0].mainQuestionIds
  ).toEqual(mainQuestionIds);
  const backup = parseBackup(JSON.stringify(makeBackup(data)));
  expect(backup.data.conductorBriefs[0].mainQuestionIds).toEqual(mainQuestionIds);
  expect(() => planRestore(backup, makeBackup({}))).not.toThrow();
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

it('round trips optional selections and requires their referenced questions on restore', () => {
  const source = makeBackup({
    speakers: [{ id: 'g', fullName: 'Giulia' }],
    questions: [
      { id: 'main', speakerId: 'g' },
      { id: 'extra', speakerId: 'g' }
    ],
    conductorBriefs: [
      { id: 'b', speakerId: 'g', mainQuestionIds: ['main'], optionalQuestionIds: ['extra'] }
    ]
  });
  const parsed = parseBackup(JSON.stringify(source));
  expect(parsed.data.conductorBriefs[0].optionalQuestionIds).toEqual(['extra']);
  expect(() => planRestore(parsed, makeBackup({}))).not.toThrow();
  parsed.data.questions = parsed.data.questions.filter((q) => q.id !== 'extra');
  expect(() => planRestore(parsed, makeBackup({}))).toThrow();
});
