import { error, json } from '@sveltejs/kit';
import { authorize } from '$lib/server/authorize';
import type { RequestHandler } from './$types';
export const POST: RequestHandler = async ({ request, url, params }) => {
  const { db, identity } = await authorize(request, url);
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(params.id)) error(400, 'ID non valido.');
  const body = await request.json().catch(() => error(400, 'JSON non valido.'));
  if (!Number.isInteger(body?.score) || body.score < 1 || body.score > 5)
    error(400, 'Voto richiesto da 1 a 5.');
  const ref = db.doc(`workspaces/codemotion-milano-2026/questions/${params.id}`);
  await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) error(404, 'Domanda non trovata.');
    const votes = { ...(snapshot.data()?.ratings || {}), [identity.uid]: body.score };
    tx.update(ref, { ratings: votes });
  });
  return json({ saved: true }, { headers: { 'Cache-Control': 'no-store' } });
};
