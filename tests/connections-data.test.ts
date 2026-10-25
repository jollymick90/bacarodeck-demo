import { expect, it } from 'vitest';
import { parseImport, validateEntity, validateGraphLinkReferences } from '../src/lib/domain';
import { makeBackup, parseBackup, planRestore } from '../src/lib/workspace-backup';
import { buildEditorialExport, exportCandidates } from '../src/lib/editorial-export';
import { relationId } from '../src/lib/connections/model';
const link = () => ({
  id: relationId('speaker-topic', 'speaker:s', 'topic:review-verifica'),
  source: 'speaker:s',
  target: 'topic:review-verifica',
  kind: 'speaker-topic',
  decision: 'linked',
  reason: 'Editorial choice'
});
it('accepts topics and canonical graph decisions, rejects invalid kinds and self loops', () => {
  expect(
    parseImport(
      JSON.stringify({
        schemaVersion: 1,
        topics: [{ id: 't', label: 'Topic', aliases: [] }],
        graphLinks: [link()]
      })
    ).topics
  ).toHaveLength(1);
  expect(validateEntity('graphLinks', { ...link(), id: 'wrong' }).length).toBeGreaterThan(0);
  expect(validateEntity('graphLinks', { ...link(), target: 'speaker:s' }).length).toBeGreaterThan(
    0
  );
  expect(validateEntity('graphLinks', { ...link(), decision: 'reset' }).length).toBeGreaterThan(0);
});
it('validates graph references against live entities and default topics', () => {
  expect(() =>
    validateGraphLinkReferences(link(), { speakers: [{ id: 's', fullName: 'Name' }] })
  ).not.toThrow();
  expect(() => validateGraphLinkReferences(link(), {})).toThrow();
});
it('old backups preserve graph collections and new backups omit member email', () => {
  const legacy = JSON.parse(JSON.stringify(makeBackup({})));
  legacy.version = 2;
  delete legacy.data.topics;
  delete legacy.data.graphLinks;
  expect(
    planRestore(
      parseBackup(JSON.stringify(legacy)),
      makeBackup({ topics: [{ id: 't', label: 'Keep' }] })
    )
  ).toEqual([]);
  const backup = makeBackup({
    members: [{ id: 'u', displayName: 'Member', role: 'editor', email: 'private@example.org' }]
  });
  expect(backup.data.members[0]).not.toHaveProperty('email');
  expect(() => parseBackup(JSON.stringify(backup))).not.toThrow();
});
it('exports graph decisions with exact node dependencies excluding built-in topics', () => {
  const rows = exportCandidates({ graphLinks: [{ ...link(), entryOrigin: 'manual' }] }, []);
  const exported = buildEditorialExport(rows);
  expect(exported.graphLinks).toEqual([link()]);
  expect(exported.requiredDocuments).toEqual([{ collection: 'speakers', id: 's' }]);
});
it('keeps graph decision records complete when exporting only a reason edit', () => {
  const rows = exportCandidates(
    { graphLinks: [{ ...link(), entryOrigin: 'import', manualFields: ['reason'] }] },
    []
  );
  const exported = buildEditorialExport(rows);
  expect(() => parseImport(JSON.stringify(exported))).not.toThrow();
  expect(exported.graphLinks?.[0]).toEqual(link());
});
it('requires custom topics and questions, but removes dependencies included in the export', () => {
  const decision = {
    id: relationId('question-topic', 'question:q', 'topic:custom'),
    source: 'question:q',
    target: 'topic:custom',
    kind: 'question-topic',
    decision: 'dismissed'
  };
  const rows = exportCandidates(
    {
      graphLinks: [{ ...decision, entryOrigin: 'manual' }],
      topics: [{ id: 'custom', label: 'Custom', entryOrigin: 'manual' }]
    },
    []
  );
  expect(buildEditorialExport(rows).requiredDocuments).toEqual([
    { collection: 'questions', id: 'q' }
  ]);
});
it('round trips historical graph decisions even after a referenced node was deleted', () => {
  const backup = parseBackup(JSON.stringify(makeBackup({ graphLinks: [link()] })));
  expect(planRestore(backup, makeBackup({}))).toHaveLength(1);
  expect(
    planRestore(backup, makeBackup({ speakers: [{ id: 's', fullName: 'Name' }] }))
  ).toHaveLength(1);
});
