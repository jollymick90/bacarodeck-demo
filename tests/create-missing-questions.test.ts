import { beforeEach, expect, it, vi } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';

vi.mock('../src/lib/server/firestore-cache', () => ({
  workspacePath: 'workspaces/codemotion-milano-2026',
  invalidateCollections: async () => {}
}));
vi.mock('../src/lib/server/connections/service', () => ({
  queueConnections: () => {},
  scheduleConnections: () => {}
}));

const prefix = 'workspaces/codemotion-milano-2026/';
let records: Map<string, Record<string, unknown>>;
const db = {
  doc: (path: string) => ({ path }),
  collection: (path: string) => ({
    where: (_field: string, _op: string, speakerId: string) => ({
      limit: () => ({ path, speakerId })
    })
  }),
  runTransaction: async (run: (tx: unknown) => Promise<unknown>) => {
    const writes: { path: string; value: Record<string, unknown>; create: boolean }[] = [];
    const result = await run({
      get: async (ref: { path: string; speakerId?: string }) => {
        if (ref.speakerId) {
          const found = [...records].filter(
            ([key, value]) => key.startsWith(ref.path + '/') && value.speakerId === ref.speakerId
          );
          return {
            empty: !found.length,
            docs: found.map(([path, value]) => ({ id: path.split('/').at(-1), data: () => value }))
          };
        }
        return { exists: records.has(ref.path), data: () => records.get(ref.path) };
      },
      create: (ref: { path: string }, value: Record<string, unknown>) =>
        writes.push({ path: ref.path, value, create: true }),
      set: (ref: { path: string }, value: Record<string, unknown>) =>
        writes.push({ path: ref.path, value, create: false })
    });
    if (writes.some((write) => write.create && records.has(write.path)))
      throw new Error('Already exists');
    for (const write of writes) records.set(write.path, write.value);
    return result;
  }
} as unknown as Firestore;

const payload = {
  schemaVersion: 1,
  questions: [
    {
      id: 'new-question',
      speakerId: 'empty',
      textEn: 'Where should we start?',
      followUpEn: 'Why?',
      order: 0,
      status: 'approved'
    }
  ]
};

beforeEach(() => {
  records = new Map([
    [prefix + 'speakers/empty', { fullName: 'Empty Speaker' }],
    [prefix + 'speakers/prepared', { fullName: 'Prepared Speaker' }],
    [
      prefix + 'questions/existing',
      { speakerId: 'prepared', textEn: 'Keep this question.', status: 'asked' }
    ],
    [prefix + 'interviewPlans/empty', { assignedTeamId: 'lorenzo', status: 'ready' }]
  ]);
});

it('creates suggested questions for an empty speaker, preserves existing work and blocks repeat imports', async () => {
  const { createMissingQuestions } = await import('../src/lib/server/create-missing-questions');
  const existingQuestion = records.get(prefix + 'questions/existing');
  const plan = records.get(prefix + 'interviewPlans/empty');
  const result = await createMissingQuestions(db, payload);
  expect(result).toMatchObject({ saved: true, created: 1, speakerIds: ['empty'] });
  expect(records.get(prefix + 'questions/new-question')).toMatchObject({
    textEn: 'Where should we start?',
    followUpEn: 'Why?',
    speakerId: 'empty',
    status: 'suggested',
    revision: 1,
    entryOrigin: 'import'
  });
  expect(records.get(prefix + 'questions/existing')).toBe(existingQuestion);
  expect(records.get(prefix + 'interviewPlans/empty')).toBe(plan);
  await expect(createMissingQuestions(db, payload)).rejects.toMatchObject({ status: 409 });
});

it('rejects a whole batch if any speaker already has questions or an ID was deleted', async () => {
  const { createMissingQuestions } = await import('../src/lib/server/create-missing-questions');
  const original = JSON.stringify([...records]);
  await expect(
    createMissingQuestions(db, {
      schemaVersion: 1,
      questions: [
        ...payload.questions,
        { id: 'other-question', speakerId: 'prepared', textEn: 'Do not add this.' }
      ]
    })
  ).rejects.toMatchObject({ status: 409 });
  expect(JSON.stringify([...records])).toBe(original);
  records.set(prefix + 'deletedQuestions/new-question', { deletedAt: 1 });
  await expect(createMissingQuestions(db, payload)).rejects.toMatchObject({ status: 409 });
  expect(records.has(prefix + 'questions/new-question')).toBe(false);
});

it('validates an import in dry-run mode without writing any document', async () => {
  const { createMissingQuestions } = await import('../src/lib/server/create-missing-questions');
  const original = JSON.stringify([...records]);
  await expect(createMissingQuestions(db, { ...payload, dryRun: true })).resolves.toMatchObject({
    saved: false,
    created: 0,
    wouldCreate: 1
  });
  expect(JSON.stringify([...records])).toBe(original);
  await expect(createMissingQuestions(db, { ...payload, speakers: [] })).rejects.toMatchObject({
    status: 400
  });
});
