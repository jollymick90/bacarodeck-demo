import { readCollection } from '$lib/server/firestore-cache';
import { json } from '@sveltejs/kit';
import { authorize } from '$lib/server/authorize';
import type { RequestHandler } from './$types';
export const GET: RequestHandler = async ({ request, url }) => {
  const { db } = await authorize(request, url);
  const entities = await readCollection(db, 'deletedQuestions');
  return json(
    entities.map((doc) => doc.id),
    { headers: { 'Cache-Control': 'no-store' } }
  );
};
