import { json } from '@sveltejs/kit';
import { authorize } from '$lib/server/authorize';
import type { RequestHandler } from './$types';
export const GET: RequestHandler = async ({ request, url }) => {
  const { db } = await authorize(request, url);
  const snapshot = await db.collection('workspaces/codemotion-milano-2026/deletedQuestions').get();
  return json(
    snapshot.docs.map((doc) => doc.id),
    { headers: { 'Cache-Control': 'no-store' } }
  );
};
