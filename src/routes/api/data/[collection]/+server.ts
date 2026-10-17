import { error, json } from '@sveltejs/kit';
import { authorize } from '$lib/server/authorize';
import { collections } from '$lib/fields';
import type { RequestHandler } from './$types';
export const GET: RequestHandler = async ({ request, url, params }) => {
  const { db } = await authorize(request, url);
  if (![...collections, 'members'].includes(params.collection as (typeof collections)[number]))
    error(400, 'Collezione non valida.');
  const snapshot = await db
    .collection(`workspaces/codemotion-milano-2026/${params.collection}`)
    .get();
  return json(
    snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id })),
    {
      headers: { 'Cache-Control': 'private, no-store' }
    }
  );
};
