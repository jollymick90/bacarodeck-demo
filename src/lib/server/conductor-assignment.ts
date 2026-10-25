import type { Firestore } from 'firebase-admin/firestore';
import type { Dataset, Entity } from '../fields';
import { assignmentChanges } from '../conductor/assignment';
import { prepareWrite } from '../domain';
import { invalidateCollections, workspacePath } from './firestore-cache';
export type AssignmentRequest = {
  speakerId: string;
  teamId: string;
  expectedOwner: string;
  expectedPlanRevision: number | null;
  confirmReplacement: boolean;
};
export async function assignSpeaker(db: Firestore, actorUid: string, request: AssignmentRequest) {
  await db.runTransaction(async (tx) => {
    const data: Dataset = {};
    for (const collection of ['speakers', 'interviewPlans', 'interviewSlots'] as const) {
      const snapshot = await tx.get(db.collection(`${workspacePath}/${collection}`));
      data[collection] = snapshot.docs.map((d) => ({ ...d.data(), id: d.id }) as Entity);
    }
    const plan = data.interviewPlans?.find((p) => p.speakerId === request.speakerId);
    if ((plan?.revision ?? null) !== request.expectedPlanRevision)
      throw new Error('Conflitto: assegnazione cambiata. Riapri il riepilogo.');
    const changes = assignmentChanges(
      data,
      request.speakerId,
      request.teamId,
      request.expectedOwner,
      request.confirmReplacement
    );
    for (const change of changes) {
      const existing = data[change.collection]?.find((e) => e.id === change.data.id) || null;
      tx.set(
        db.doc(`${workspacePath}/${change.collection}/${change.data.id}`),
        prepareWrite(change.collection, change.data, existing, actorUid, Date.now())
      );
    }
  });
  await invalidateCollections(db, ['interviewPlans', 'interviewSlots']);
}
