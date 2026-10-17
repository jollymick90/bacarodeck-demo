import { error, json } from '@sveltejs/kit';
import { authorize } from '$lib/server/authorize';
import { collections, type Entity } from '$lib/fields';
import { prepareWrite, type Change } from '$lib/domain';
import type { RequestHandler } from './$types';
export const POST: RequestHandler = async ({ request, url }) => {
  const { db, identity } = await authorize(request, url);
  const body = await request.json().catch(() => error(400, 'JSON non valido.'));
  const changes: Change[] = body?.changes;
  if (!Array.isArray(changes) || !changes.length || changes.length > 400)
    error(400, 'Sono richiesti da 1 a 400 documenti.');
  if (body.action !== 'save' && body.action !== 'delete') error(400, 'Operazione non valida.');
  const keys = changes.map((change) => {
    if (
      !change ||
      !collections.includes(change.collection) ||
      typeof change.data?.id !== 'string' ||
      !/^[a-zA-Z0-9_-]{1,128}$/.test(change.data.id) ||
      !(change.expectedRevision === null || Number.isInteger(change.expectedRevision))
    )
      error(400, 'Documento non valido.');
    return `${change.collection}/${change.data.id}`;
  });
  if (new Set(keys).size !== keys.length) error(400, 'Documenti duplicati.');
  await db.runTransaction(async (tx) => {
    const refs = keys.map((key) => db.doc(`workspaces/codemotion-milano-2026/${key}`));
    const snapshots = await Promise.all(refs.map((ref) => tx.get(ref)));
    const writes = changes.map((change, index) => {
      const snapshot = snapshots[index];
      const existing = snapshot.exists ? ({ ...snapshot.data(), id: snapshot.id } as Entity) : null;
      if (
        change.expectedRevision === null
          ? !!existing
          : !existing || existing.revision !== change.expectedRevision
      )
        error(409, 'Conflitto: il contenuto è cambiato. Ricarica prima di salvare.');
      if (body.action === 'delete') {
        if (!existing) error(409, 'Documento già eliminato.');
        return null;
      }
      try {
        return prepareWrite(change.collection, change.data, existing, identity.uid, Date.now());
      } catch (failure) {
        error(400, failure instanceof Error ? failure.message : 'Documento non valido.');
      }
    });
    refs.forEach((ref, index) => {
      const write = writes[index];
      if (write) tx.set(ref, write);
      else tx.delete(ref);
    });
  });
  return json({ saved: true }, { headers: { 'Cache-Control': 'no-store' } });
};
