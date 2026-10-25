import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
vi.mock('$env/dynamic/public', () => ({ env: {} }));
import {
  runConnectionsJob,
  queueConnections,
  jobPath,
  saveConnectionDecision
} from '../src/lib/server/connections/service';
import { workspacePath } from '../src/lib/server/firestore-cache';
import type { GraphNode } from '../src/lib/connections/types';

// Never run destructive fixtures against the event's emulator or a real project.
const enabled = process.env.FIRESTORE_EMULATOR_HOST === '127.0.0.1:18380';
describe.skipIf(!enabled)('persistent connection jobs (isolated emulator only)', () => {
  const app = initializeApp({ projectId: 'demo-bacarodeck-graph-tests' }, 'connection-tests');
  const db = getFirestore(app);
  const dirty = () => db.runTransaction(async (tx) => queueConnections(tx, db, ['speakers']));
  const vector = async (_node: GraphNode) => [1, 0, 0];
  beforeEach(async () => {
    await db.recursiveDelete(db.doc(workspacePath));
    await db.doc(`${workspacePath}/speakers/a`).set({ name: 'Ada', notesMd: 'Code review' });
    await dirty();
  }, 20000);
  afterAll(async () => {
    await db.terminate();
    await deleteApp(app);
  });
  it('rejects output when content changes during inference, then reuses unchanged vectors', async () => {
    let edited = false;
    expect(
      await runConnectionsJob(db, async (node) => {
        if (!edited) {
          edited = true;
          await db.runTransaction(async (tx) => {
            queueConnections(tx, db, ['speakers']);
            tx.update(db.doc(`${workspacePath}/speakers/a`), {
              notesMd: 'Independent agent verification'
            });
          });
        }
        return vector(node);
      })
    ).toBe(false);
    expect((await db.doc(jobPath).get()).data()).toMatchObject({ state: 'pending', generation: 2 });
    const recomputed: string[] = [];
    expect(
      await runConnectionsJob(db, async (node) => {
        recomputed.push(node.id);
        return vector(node);
      })
    ).toBe(true);
    expect(recomputed).toEqual(['speaker:a']);
    expect((await db.doc(jobPath).get()).data()?.publishedRun).toBeTruthy();
    expect((await db.collection(`${workspacePath}/connectionRuns`).get()).size).toBe(1);
  }, 20000);
  it('does not publish or release a replacement lease', async () => {
    let replaced = false;
    expect(
      await runConnectionsJob(db, async (node) => {
        if (!replaced) {
          replaced = true;
          await db
            .doc(jobPath)
            .update({ leaseOwner: 'replacement', leaseUntil: Date.now() + 60000 });
        }
        return vector(node);
      })
    ).toBe(false);
    expect((await db.doc(jobPath).get()).data()).toMatchObject({
      leaseOwner: 'replacement',
      state: 'running'
    });
    expect((await db.doc(jobPath).get()).data()?.publishedRun).toBeUndefined();
  }, 20000);
  it('keeps a newer request pending when an older computation fails', async () => {
    expect(
      await runConnectionsJob(db, async () => {
        await dirty();
        throw Error('inference failed');
      })
    ).toBe(false);
    expect((await db.doc(jobPath).get()).data()).toMatchObject({ state: 'pending', generation: 2 });
  }, 20000);
  it('preserves decisions on recomputation and rejects stale revisions and dangling references', async () => {
    await db.doc(`${workspacePath}/speakers/b`).set({ name: 'Bob', notesMd: 'Code review' });
    const decision = {
      source: 'speaker:a',
      target: 'speaker:b',
      kind: 'speaker-similar' as const,
      decision: 'dismissed' as const,
      expectedRevision: null
    };
    await saveConnectionDecision(db, 'tester', decision);
    await expect(saveConnectionDecision(db, 'tester', decision)).rejects.toThrow('Conflitto');
    expect(await runConnectionsJob(db, vector)).toBe(true);
    await dirty();
    expect(await runConnectionsJob(db, vector)).toBe(true);
    const links = await db.collection(`${workspacePath}/graphLinks`).get();
    expect(links.docs[0].data().decision).toBe('dismissed');
    await expect(
      saveConnectionDecision(db, 'tester', { ...decision, target: 'speaker:absent' })
    ).rejects.toThrow('non esiste');
  }, 20000);
});
