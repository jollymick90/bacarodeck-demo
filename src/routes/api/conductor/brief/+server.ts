import { error, json } from '@sveltejs/kit';
import { authorize } from '$lib/server/authorize';
import { saveBrief } from '$lib/server/conductor-brief';
import type { RequestHandler } from './$types';
export const POST: RequestHandler = async ({ request, url }) => {
  const { db, identity } = await authorize(request, url);
  const body = await request.json().catch(() => error(400, 'JSON non valido.'));
  if (
    !body?.brief ||
    typeof body.brief.id !== 'string' ||
    !/^[a-zA-Z0-9_-]{1,128}$/.test(body.brief.id) ||
    !(body.expectedRevision === null || Number.isInteger(body.expectedRevision))
  )
    error(400, 'Scaletta non valida.');
  try {
    return json(await saveBrief(db, identity.uid, body.brief, body.expectedRevision));
  } catch (e) {
    const m = (e as Error).message;
    error(m.startsWith('Conflitto') ? 409 : 400, m);
  }
};
