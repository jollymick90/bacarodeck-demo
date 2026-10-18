import { readCollection } from '$lib/server/firestore-cache';
import { error, json } from '@sveltejs/kit';
import { authorize } from '$lib/server/authorize';
import { collections } from '$lib/fields';
import type { RequestHandler } from './$types';
export const GET: RequestHandler = async ({ request, url, params }) => {
  const { db } = await authorize(request, url);
  if (![...collections, 'members'].includes(params.collection as (typeof collections)[number]))
    error(400, 'Collezione non valida.');
  const entities = await readCollection(db, params.collection);
  return json(entities, {
    headers: { 'Cache-Control': 'private, no-store' }
  });
};
