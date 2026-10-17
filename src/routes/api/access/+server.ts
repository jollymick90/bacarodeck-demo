import { json } from '@sveltejs/kit';
import { authorize } from '$lib/server/authorize';
import type { RequestHandler } from './$types';
export const POST: RequestHandler = async ({ request, url }) => {
  const { db, identity } = await authorize(request, url);
  await db.doc(`workspaces/codemotion-milano-2026/members/${identity.uid}`).set(
    {
      displayName: identity.name || 'Membro BacaroTech',
      role: 'editor'
    },
    { merge: true }
  );
  return json({ allowed: true, uid: identity.uid }, { headers: { 'Cache-Control': 'no-store' } });
};
