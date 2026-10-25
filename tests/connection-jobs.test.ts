import { expect, it } from 'vitest';
import {
  leaseAvailable,
  canPublish,
  semanticChunks
} from '../src/lib/server/connections/job-state';
it('recovers abandoned jobs without stealing a live lease', () => {
  expect(leaseAvailable({ state: 'running', leaseUntil: 200 }, 100)).toBe(false);
  expect(leaseAvailable({ state: 'pending', leaseUntil: 200 }, 100)).toBe(false);
  expect(leaseAvailable({ state: 'running', leaseUntil: 99 }, 100)).toBe(true);
});
it('rejects stale output after edits, direct content changes, or a new lease', () => {
  const job = { generation: 4, leaseOwner: 'one' };
  expect(canPublish(job, { generation: 4, owner: 'one' }, 'a', 'a')).toBe(true);
  expect(canPublish({ ...job, generation: 5 }, { generation: 4, owner: 'one' }, 'a', 'a')).toBe(
    false
  );
  expect(canPublish(job, { generation: 4, owner: 'two' }, 'a', 'a')).toBe(false);
  expect(canPublish(job, { generation: 4, owner: 'one' }, 'a', 'b')).toBe(false);
});
it('includes late notes and both languages within a bounded embedding workload', () => {
  const chunks = semanticChunks(
    'speaker',
    Array.from({ length: 30 }, (_, i) => `SECTION${i} ` + 'x'.repeat(400)).join('\n')
  );
  expect(chunks.length).toBeLessThanOrEqual(8);
  expect(chunks.some((c) => c.includes('SECTION29'))).toBe(true);
  expect(semanticChunks('question', 'Domanda italiana\nEnglish question\nFollow up')).toEqual([
    'Domanda italiana',
    'English question',
    'Follow up'
  ]);
});
