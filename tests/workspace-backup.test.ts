import { expect, it } from 'vitest';
import { validateNextInterview } from '../src/lib/conductor/next-interview';
import {
  makeBackup,
  parseBackup,
  planRestore,
  restoreBatches,
  backupCollections,
  backupPage
} from '../src/lib/workspace-backup';

it('round trips all collections, ratings and provenance without access settings', () => {
  const backup = makeBackup({
    questions: [
      {
        id: 'q',
        textIt: 'Test',
        status: 'asked',
        ratings: { olduser: 5 },
        entryOrigin: 'manual',
        manualFields: ['textIt']
      }
    ],
    members: [{ id: 'olduser', displayName: 'Editor', role: 'editor' }],
    deletedQuestions: [{ id: 'deleted', deletedAt: 1 }]
  });
  const restored = parseBackup(JSON.stringify(backup));
  expect(Object.keys(restored.data)).toEqual([...backupCollections]);
  expect(restored.data.questions[0].ratings).toEqual({ olduser: 5 });
  expect(() =>
    parseBackup(JSON.stringify({ ...backup, data: { ...backup.data, access: [] } }))
  ).toThrow();
});

it('rejects malformed votes, duplicate IDs and inconsistent live/deleted questions', () => {
  const backup = makeBackup({ questions: [{ id: 'q', textIt: 'Test' }] });
  backup.data.questions[0].ratings = { user: 9 };
  expect(() => parseBackup(JSON.stringify(backup))).toThrow();
  delete backup.data.questions[0].ratings;
  backup.data.questions.push({ id: 'q' });
  expect(() => parseBackup(JSON.stringify(backup))).toThrow();
  backup.data.questions.pop();
  backup.data.deletedQuestions.push({ id: 'q', deletedAt: 1 });
  expect(() => parseBackup(JSON.stringify(backup))).toThrow();
});

it('preserves unrelated destination data and groups question deletion with its tombstone', () => {
  const source = makeBackup({ deletedQuestions: [{ id: 'q', deletedAt: 1 }] });
  const current = makeBackup({
    questions: [{ id: 'q', textIt: 'Old' }],
    speakers: [{ id: 'keep', fullName: 'Keep' }]
  });
  const plan = planRestore(source, current);
  expect(plan).toHaveLength(2);
  expect(plan.some((item) => item.collection === 'speakers')).toBe(false);
  expect(plan.find((item) => item.collection === 'questions')?.data).toBeNull();
  expect(restoreBatches(plan)).toHaveLength(1);
});

it('skips identical data and prepares conflict expectations for changed documents', () => {
  const source = makeBackup({ speakers: [{ id: 's', fullName: 'New' }] });
  const current = makeBackup({ speakers: [{ id: 's', fullName: 'Old', revision: 7 }] });
  expect(planRestore(source, source)).toEqual([]);
  expect(planRestore(source, current)[0].expected).toEqual(current.data.speakers[0]);
});

it.each(['switch', 'relink'])(
  'keeps a next-interview %s and related speaker archival in one restore batch',
  (mode) => {
    const speakers = [
      ...Array.from({ length: 99 }, (_, i) => ({ id: `s${i}`, fullName: 'Old' })),
      { id: 'a', fullName: 'Ada' },
      { id: 'b', fullName: 'Berto' }
    ];
    const current = makeBackup({
      speakers,
      interviewPlans: [
        { id: 'plan-a', speakerId: 'a', nextInterview: true },
        { id: 'plan-b', speakerId: 'b', nextInterview: false }
      ]
    });
    const source = makeBackup({
      speakers: speakers.map((s) =>
        s.id === 'a' ? { ...s, status: 'archived' } : s.id === 'b' ? s : { ...s, fullName: 'New' }
      ),
      interviewPlans:
        mode === 'relink'
          ? [{ id: 'plan-a', speakerId: 'b', nextInterview: true }]
          : [
              { id: 'plan-b', speakerId: 'b', nextInterview: true },
              { id: 'plan-a', speakerId: 'a', nextInterview: false }
            ]
    });
    const batches = restoreBatches(planRestore(source, current));
    const state = structuredClone(current.data);
    for (const batch of batches) {
      for (const change of batch) {
        state[change.collection] = state[change.collection].filter((row) => row.id !== change.id);
        if (change.data) state[change.collection].push(change.data);
      }
      expect(() => validateNextInterview(state)).not.toThrow();
    }
    expect(batches.map((batch) => batch.length)).toEqual(mode === 'relink' ? [99, 2] : [99, 3]);
  }
);

it('splits large imports into bounded requests', () => {
  const source = makeBackup({
    materials: Array.from({ length: 450 }, (_, i) => ({ id: `m${i}`, bodyMd: 'x'.repeat(10000) }))
  });
  const plan = planRestore(source, makeBackup({}));
  const batches = restoreBatches(plan);
  expect(batches.flat()).toHaveLength(450);
  for (const batch of batches) {
    expect(batch.length).toBeLessThanOrEqual(100);
    expect(new TextEncoder().encode(JSON.stringify({ changes: batch })).length).toBeLessThan(
      2_000_000
    );
  }
});

it('pages exports below the response limit without dropping or duplicating documents', () => {
  const records = Array.from({ length: 30 }, (_, i) => ({
    id: `m${i}`,
    bodyMd: 'x'.repeat(200_000)
  }));
  const collected = [];
  let offset: number | null = 0;
  do {
    const page = backupPage(records, offset);
    expect(new TextEncoder().encode(JSON.stringify(page)).length).toBeLessThan(2_000_000);
    collected.push(...page.records);
    offset = page.next;
  } while (offset !== null);
  expect(collected).toEqual(records);
});
