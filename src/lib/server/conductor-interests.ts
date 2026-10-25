import { createHash } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { invalidateCollections, workspacePath } from './firestore-cache';
export const interestId = (uid: string, speakerId: string) =>
  createHash('sha256')
    .update(JSON.stringify([uid, speakerId]))
    .digest('hex');
export async function setInterest(
  db: Firestore,
  actorUid: string,
  speakerId: string,
  interested: boolean
): Promise<void> {
  const ref = db.doc(`${workspacePath}/speakerInterests/${interestId(actorUid, speakerId)}`);
  await db.runTransaction(async (tx) => {
    const speaker = await tx.get(db.doc(`${workspacePath}/speakers/${speakerId}`));
    if (!speaker.exists) throw new Error('Speaker non trovato.');
    const old = await tx.get(ref);
    if (interested && !old.exists)
      tx.set(ref, {
        speakerId,
        memberUid: actorUid,
        createdBy: actorUid,
        createdAt: Date.now(),
        revision: 1
      });
    if (!interested && old.exists) tx.delete(ref);
  });
  await invalidateCollections(db, ['speakerInterests']);
}
