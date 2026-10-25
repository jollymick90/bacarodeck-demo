import type { Firestore } from 'firebase-admin/firestore';
import type { Dataset, Entity } from '../fields';
import { validateBrief } from '../conductor/brief';
import { prepareWrite } from '../domain';
import { trackEditorialFields } from '../editorial-export';
import { invalidateCollections, workspacePath } from './firestore-cache';
export async function saveBrief(
  db: Firestore,
  actorUid: string,
  brief: Entity,
  expectedRevision: number | null
) {
  let result: Entity = brief;
  await db.runTransaction(async (tx) => {
    const ref = db.doc(`${workspacePath}/conductorBriefs/${brief.id}`);
    const old = await tx.get(ref);
    const existing = old.exists ? ({ ...old.data(), id: old.id } as Entity) : null;
    if ((existing?.revision ?? null) !== expectedRevision)
      throw new Error(
        'Conflitto: scaletta cambiata. La bozza è conservata; ricarica prima di riprovare.'
      );
    const data: Dataset = {};
    for (const name of ['speakers', 'talks', 'questions', 'conductorBriefs'] as const) {
      const snapshot = await tx.get(db.collection(`${workspacePath}/${name}`));
      data[name] = snapshot.docs.map((d) => ({ ...d.data(), id: d.id }) as Entity);
    }
    if (
      data.conductorBriefs?.some(
        (b) =>
          b.id !== brief.id &&
          b.speakerId === brief.speakerId &&
          String(b.talkId || '') === String(brief.talkId || '')
      )
    )
      throw new Error('Conflitto: esiste già una scheda per questo talk.');
    validateBrief(brief, data);
    const write = prepareWrite('conductorBriefs', brief, existing, actorUid, Date.now());
    result = { ...write, ...trackEditorialFields(write, existing, 'manual') };
    tx.set(ref, result);
  });
  await invalidateCollections(db, ['conductorBriefs']);
  return result;
}
