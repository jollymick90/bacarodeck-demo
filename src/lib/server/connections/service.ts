import { createHash, randomUUID } from 'node:crypto';
import { FieldValue, type Firestore, type Transaction } from 'firebase-admin/firestore';
import { waitUntil } from '@vercel/functions';
import {
  buildGraphNodes,
  buildAutomaticEdges,
  mergeGraphEdges,
  relationId,
  validateRelation,
  SEMANTIC_THRESHOLDS,
  SEMANTIC_TOP_K
} from '../../connections/model';
import type { GraphNode, GraphEdge, GraphResponse, RelationKind } from '../../connections/types';
import type { Dataset, Entity } from '../../fields';
import { prepareWrite } from '../../domain';
import {
  readCollection,
  invalidateCollections,
  firestoreCache,
  workspacePath
} from '../firestore-cache';
import { embedNode, MODEL_VERSION } from './embeddings';
import { leaseAvailable, canPublish, type JobState } from './job-state';

export const graphCollections = [
  'speakers',
  'talks',
  'materials',
  'insights',
  'questions',
  'topics'
] as const;
export const jobPath = `${workspacePath}/connectionState/current`;
const LEASE_MS = 120_000;
const MAX_NODES = 1500;
const RUN_BUDGET_MS = 160_000;
const stable = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(stable)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.entries(value)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => [k, stable(v)])
        )
      : value;
const hash = (value: unknown) =>
  createHash('sha256')
    .update(JSON.stringify(stable(value)))
    .digest('hex');
export const graphInputHash = (nodes: GraphNode[]) =>
  hash({
    engine: 1,
    thresholds: SEMANTIC_THRESHOLDS,
    topK: SEMANTIC_TOP_K,
    model: MODEL_VERSION,
    nodes
  });
const dirty = (names: readonly string[]) =>
  names.some(
    (n) => (graphCollections as readonly string[]).includes(n) || n === 'deletedQuestions'
  );

/** Call inside the content transaction, after all reads. Same commit invalidates old jobs. */
export function queueConnections(tx: Transaction, db: Firestore, changed: readonly string[]) {
  if (!dirty(changed)) return;
  tx.set(
    db.doc(jobPath),
    {
      generation: FieldValue.increment(1),
      state: 'pending',
      requestedAt: Date.now(),
      error: FieldValue.delete()
    },
    { merge: true }
  );
}
async function corpus(db: Firestore, tx?: Transaction, cached = false): Promise<Dataset> {
  const data: Dataset = {};
  await Promise.all(
    graphCollections.map(async (name) => {
      if (cached) data[name] = await readCollection(db, name);
      else {
        const ref = db.collection(`${workspacePath}/${name}`);
        const snapshot = tx ? await tx.get(ref) : await ref.get();
        data[name] = snapshot.docs.map((d) => ({ ...d.data(), id: d.id }) as Entity);
      }
    })
  );
  return data;
}
async function acquire(db: Firestore) {
  return db.runTransaction(async (tx) => {
    const ref = db.doc(jobPath),
      job = (await tx.get(ref)).data() as JobState | undefined;
    if (!job || job.state === 'ready' || job.state === 'error' || !leaseAvailable(job, Date.now()))
      return null;
    const claim = { owner: randomUUID(), generation: job.generation || 0 };
    tx.set(
      ref,
      {
        state: 'running',
        leaseOwner: claim.owner,
        leaseUntil: Date.now() + LEASE_MS,
        progress: 0,
        error: FieldValue.delete()
      },
      { merge: true }
    );
    return claim;
  });
}
async function release(db: Firestore, owner: string, fields: Record<string, unknown> = {}) {
  return db.runTransaction(async (tx) => {
    const ref = db.doc(jobPath),
      job = (await tx.get(ref)).data() as JobState;
    if (job?.leaseOwner === owner)
      tx.set(ref, { leaseUntil: 0, leaseOwner: '', ...fields }, { merge: true });
  });
}
async function touch(db: Firestore, owner: string, progress?: number, total?: number) {
  return db.runTransaction(async (tx) => {
    const ref = db.doc(jobPath),
      job = (await tx.get(ref)).data() as JobState;
    if (job?.leaseOwner !== owner) throw Error('Lease del calcolo scaduta.');
    tx.set(
      ref,
      { leaseUntil: Date.now() + LEASE_MS, ...(progress === undefined ? {} : { progress, total }) },
      { merge: true }
    );
  });
}
async function readRun(db: Firestore, run?: string): Promise<GraphEdge[]> {
  if (!run) return [];
  return firestoreCache(db).read(`connection-run:${run}`, 300, async () => {
    const snapshot = await db.collection(`${workspacePath}/connectionRuns/${run}/chunks`).get();
    return snapshot.docs.flatMap((d) => (d.data().edges || []) as GraphEdge[]);
  });
}
export async function runConnectionsJob(db: Firestore, embed = embedNode): Promise<boolean> {
  const claim = await acquire(db);
  if (!claim) return false;
  const start = Date.now();
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let stagedRun: string | undefined;
  try {
    heartbeat = setInterval(() => void touch(db, claim.owner).catch(() => {}), 25_000);
    const nodes = buildGraphNodes(await corpus(db));
    if (nodes.length > MAX_NODES)
      throw Error(
        `Il grafo supera ${MAX_NODES} nodi: riduci i contenuti attivi prima di riprovare.`
      );
    const inputHash = graphInputHash(nodes),
      vectors: Record<string, number[]> = {};
    const refs = nodes.map((n) => db.doc(`${workspacePath}/connectionEmbeddings/${hash(n.id)}`));
    const snapshots = [];
    for (let i = 0; i < refs.length; i += 100)
      snapshots.push(...(await db.getAll(...refs.slice(i, i + 100))));
    let changed = 0;
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i],
        key = hash({ text: node.text, kind: node.kind, model: MODEL_VERSION });
      const old = snapshots[i]?.data();
      if (old?.inputHash === key && Array.isArray(old.vector)) vectors[node.id] = old.vector;
      else {
        if (Date.now() - start > RUN_BUDGET_MS) {
          await release(db, claim.owner, { state: 'pending' });
          return false;
        }
        const vector = await embed(node);
        vectors[node.id] = vector;
        await refs[i].set({
          nodeId: node.id,
          inputHash: key,
          model: MODEL_VERSION,
          vector,
          updatedAt: Date.now()
        });
        changed++;
      }
      if (i % 8 === 0 || i === nodes.length - 1) await touch(db, claim.owner, i + 1, nodes.length);
    }
    const edges = buildAutomaticEdges(nodes, vectors),
      run = randomUUID(),
      chunks: GraphEdge[][] = [];
    let chunk: GraphEdge[] = [],
      bytes = 0;
    for (const edge of edges) {
      const size = Buffer.byteLength(JSON.stringify(edge));
      if (bytes + size > 650_000) {
        chunks.push(chunk);
        chunk = [];
        bytes = 0;
      }
      chunk.push(edge);
      bytes += size;
    }
    if (chunk.length) chunks.push(chunk);
    const batch = db.batch();
    chunks.forEach((edges, i) =>
      batch.set(db.doc(`${workspacePath}/connectionRuns/${run}/chunks/${i}`), { edges })
    );
    batch.set(db.doc(`${workspacePath}/connectionRuns/${run}`), {
      inputHash,
      model: MODEL_VERSION,
      createdAt: Date.now(),
      changedEmbeddings: changed
    });
    stagedRun = run;
    await batch.commit();
    const published = await db.runTransaction(async (tx) => {
      const job = (await tx.get(db.doc(jobPath))).data() as JobState;
      if (job?.leaseOwner !== claim.owner) return false;
      const fresh = buildGraphNodes(await corpus(db, tx));
      if (!canPublish(job, claim, inputHash, graphInputHash(fresh))) {
        tx.set(
          db.doc(jobPath),
          { state: 'pending', leaseUntil: 0, leaseOwner: '' },
          { merge: true }
        );
        return false;
      }
      tx.set(
        db.doc(jobPath),
        {
          state: 'ready',
          publishedRun: run,
          publishedInputHash: inputHash,
          model: MODEL_VERSION,
          generatedAt: Date.now(),
          leaseUntil: 0,
          leaseOwner: '',
          progress: nodes.length,
          total: nodes.length,
          error: FieldValue.delete()
        },
        { merge: true }
      );
      return true;
    });
    if (published) {
      stagedRun = undefined;
      // Retain the current run and recent snapshots so in-flight readers can finish.
      const oldRuns = await db
        .collection(`${workspacePath}/connectionRuns`)
        .where('createdAt', '<', Date.now() - 24 * 60 * 60 * 1000)
        .get();
      for (const old of oldRuns.docs) {
        if (old.id !== run) await db.recursiveDelete(old.ref);
      }
    }
    return published;
  } catch (failure) {
    const message = failure instanceof Error ? failure.message : 'Calcolo non riuscito.';
    console.error('[connections]', message);
    await db.runTransaction(async (tx) => {
      const ref = db.doc(jobPath),
        job = (await tx.get(ref)).data() as JobState;
      if (job?.leaseOwner !== claim.owner) return;
      tx.set(
        ref,
        {
          state: job.generation === claim.generation ? 'error' : 'pending',
          leaseUntil: 0,
          leaseOwner: '',
          error: message.includes('1500 nodi')
            ? message
            : 'Calcolo delle connessioni non riuscito. Riprova; i contenuti e i collegamenti manuali sono conservati.'
        },
        { merge: true }
      );
    });
    return false;
  } finally {
    clearInterval(heartbeat);
    if (stagedRun)
      await db
        .recursiveDelete(db.doc(`${workspacePath}/connectionRuns/${stagedRun}`))
        .catch((error) => console.error('[connections-cleanup]', error.message));
  }
}
const running = new WeakMap<Firestore, Promise<void>>();
export function scheduleConnections(db: Firestore) {
  if (running.has(db)) return;
  const task = (async () => {
    // One request owns one bounded job; the persistent pending state resumes on polling.
    await runConnectionsJob(db);
  })()
    .catch((error) =>
      console.error('[connections-job]', error instanceof Error ? error.message : 'Errore')
    )
    .finally(() => running.delete(db));
  running.set(db, task);
  waitUntil(task);
}
export async function refreshConnections(db: Firestore) {
  await db.runTransaction(async (tx) => queueConnections(tx, db, ['topics']));
  scheduleConnections(db);
}
export async function getConnections(db: Firestore): Promise<GraphResponse> {
  let nodes = buildGraphNodes(await corpus(db, undefined, true));
  let job = (await db.doc(jobPath).get()).data() as JobState | undefined;
  if (
    !job ||
    (job.state === 'ready' &&
      (job.model !== MODEL_VERSION || job.publishedInputHash !== graphInputHash(nodes)))
  ) {
    // Cache may predate the last writer: confirm fresh before invalidating a ready run.
    if (job) nodes = buildGraphNodes(await corpus(db));
    if (!job || job.model !== MODEL_VERSION || job.publishedInputHash !== graphInputHash(nodes)) {
      await db.runTransaction(async (tx) => {
        const latest = (await tx.get(db.doc(jobPath))).data() as JobState | undefined;
        if (!latest || latest.state === 'ready') queueConnections(tx, db, ['topics']);
      });
      job = (await db.doc(jobPath).get()).data() as JobState;
    }
  }
  if (job?.state === 'pending' || job?.state === 'running') scheduleConnections(db);
  const [previous, overrides] = await Promise.all([
    readRun(db, job?.publishedRun),
    readCollection(db, 'graphLinks')
  ]);
  const currentExplicit = buildAutomaticEdges(nodes, {});
  const edges = mergeGraphEdges(
    nodes,
    [...previous.filter((e) => e.origin === 'automatic'), ...currentExplicit],
    overrides
  );
  return {
    nodes,
    edges,
    overrides,
    model: MODEL_VERSION,
    stale:
      !!job?.publishedRun &&
      (job.state !== 'ready' || job.publishedInputHash !== graphInputHash(nodes)),
    status: {
      state: job?.state || 'pending',
      ...(job?.error ? { error: job.error } : {}),
      ...(job?.generatedAt ? { generatedAt: job.generatedAt } : {}),
      ...(job?.total ? { progress: job.progress || 0, total: job.total } : {})
    }
  };
}
export type DecisionRequest = {
  source: string;
  target: string;
  kind: RelationKind;
  decision: 'linked' | 'confirmed' | 'dismissed' | 'reset';
  reason?: string;
  expectedRevision: number | null;
};
export async function saveConnectionDecision(
  db: Firestore,
  actor: string,
  request: DecisionRequest
) {
  await db.runTransaction(async (tx) => {
    const nodes = buildGraphNodes(await corpus(db, tx)),
      source = nodes.find((n) => n.id === request.source),
      target = nodes.find((n) => n.id === request.target);
    if (!source || !target) throw Error('Il contenuto non esiste più. Ricarica le connessioni.');
    validateRelation(request.kind, source, target);
    const id = relationId(request.kind, source.id, target.id),
      ref = db.doc(`${workspacePath}/graphLinks/${id}`);
    const snapshot = await tx.get(ref),
      old = snapshot.exists ? ({ ...snapshot.data(), id } as Entity) : null;
    if ((old?.revision ?? null) !== request.expectedRevision)
      throw Error('Conflitto: il collegamento è cambiato. Ricarica prima di riprovare.');
    if (request.decision === 'reset') {
      tx.delete(ref);
      return;
    }
    const ends =
      request.kind === 'speaker-topic' || request.kind === 'question-topic'
        ? source.kind === 'topic'
          ? [target.id, source.id]
          : [source.id, target.id]
        : [source.id, target.id].sort();
    const record = {
      id,
      source: ends[0],
      target: ends[1],
      kind: request.kind,
      decision: request.decision,
      reason: request.reason?.trim() || '',
      revision: old?.revision
    };
    tx.set(ref, prepareWrite('graphLinks', record, old, actor, Date.now()));
  });
  await invalidateCollections(db, ['graphLinks']);
}
