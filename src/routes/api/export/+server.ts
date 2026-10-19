import { json } from '@sveltejs/kit';
import { authorize } from '$lib/server/authorize';
import { readCollection } from '$lib/server/firestore-cache';
import { collections } from '$lib/fields';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, url }) => {
  const { db } = await authorize(request, url);
  const entries = await Promise.all(
    collections.map(async (name) => [name, await readCollection(db, name)])
  );
  return json(Object.fromEntries(entries), { headers: { 'Cache-Control': 'private, no-store' } });
};
