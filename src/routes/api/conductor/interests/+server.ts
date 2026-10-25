import { error, json } from '@sveltejs/kit';
import { authorize } from '$lib/server/authorize';
import { setInterest } from '$lib/server/conductor-interests';
import type { RequestHandler } from './$types';
export const POST: RequestHandler = async ({ request, url }) => {
  const { db, identity } = await authorize(request, url);
  const body = await request.json().catch(() => error(400, 'JSON non valido.'));
  if (
    !body ||
    Object.keys(body).some((k) => !['speakerId', 'interested'].includes(k)) ||
    typeof body.speakerId !== 'string' ||
    !/^[a-zA-Z0-9_-]{1,128}$/.test(body.speakerId) ||
    typeof body.interested !== 'boolean'
  )
    error(400, 'Interesse non valido.');
  try {
    await setInterest(db, identity.uid, body.speakerId, body.interested);
  } catch (e) {
    error(400, (e as Error).message);
  }
  return json({ saved: true });
};
