import {
  collection as firestoreCollection,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  type Firestore,
  type Unsubscribe
} from 'firebase/firestore';
import { prepareWrite, type Change } from './domain';
import type { Collection, Entity } from './fields';
export const basePath = 'workspaces/codemotion-milano-2026';
function requireOnline() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false)
    throw new Error(
      'Sei offline. Le modifiche non sono accodate: conserva il testo e riprova quando torna la connessione.'
    );
}
export async function commitChanges(db: Firestore, uid: string, changes: Change[]): Promise<void> {
  requireOnline();
  if (!changes.length) return;
  if (changes.length > 400) throw new Error('Massimo 400 documenti per transazione.');
  const keys = changes.map((c) => `${c.collection}/${c.data.id}`);
  if (new Set(keys).size !== keys.length) throw new Error('Documenti duplicati nella transazione.');
  await runTransaction(db, async (tx) => {
    const refs = changes.map((change) => doc(db, basePath, change.collection, change.data.id));
    // Every read precedes every write. Retries re-check the original preview revision.
    const snapshots = await Promise.all(refs.map((ref) => tx.get(ref)));
    const writes = changes.map((change, i) => {
      const snapshot = snapshots[i];
      const existing = snapshot.exists()
        ? ({ ...snapshot.data(), id: snapshot.id } as Entity)
        : null;
      if (
        (change.expectedRevision === null && existing) ||
        (change.expectedRevision !== null &&
          (!existing || existing.revision !== change.expectedRevision))
      )
        throw new Error(
          `Conflitto su ${change.collection}/${change.data.id}. Nessuna modifica salvata. Ricarica e verifica di nuovo.`
        );
      const prepared = prepareWrite(change.collection, change.data, existing, uid, Date.now());
      return {
        ...prepared,
        createdAt: existing?.createdAt ?? serverTimestamp(),
        updatedAt: serverTimestamp()
      };
    });
    refs.forEach((ref, i) => tx.set(ref, writes[i]));
  });
}
export async function removeEntity(
  db: Firestore,
  collection: Collection,
  entity: Entity
): Promise<void> {
  requireOnline();
  await runTransaction(db, async (tx) => {
    const ref = doc(db, basePath, collection, entity.id);
    const snap = await tx.get(ref);
    if (!snap.exists() || snap.data().revision !== entity.revision)
      throw new Error('Conflitto: il contenuto è cambiato. Riapri prima di eliminare.');
    tx.delete(ref);
  });
}
export function watchCollection(
  db: Firestore,
  name: Collection | 'members',
  ondata: (entities: Entity[], cached: boolean) => void,
  onerror: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    firestoreCollection(db, basePath, name),
    { includeMetadataChanges: true },
    (snap) =>
      ondata(
        snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Entity),
        snap.metadata.fromCache
      ),
    onerror
  );
}
