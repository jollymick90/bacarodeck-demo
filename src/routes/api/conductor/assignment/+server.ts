import { error, json } from '@sveltejs/kit';
import { authorize } from '$lib/server/authorize';
import { assignSpeaker } from '$lib/server/conductor-assignment';
import type { RequestHandler } from './$types';
export const POST: RequestHandler = async ({ request, url }) => {
  const { db, identity } = await authorize(request, url);
  const body = await request.json().catch(() => error(400, 'JSON non valido.'));
  if (
    !body ||
    typeof body.speakerId !== 'string' ||
    typeof body.teamId !== 'string' ||
    typeof body.expectedOwner !== 'string' ||
    !(body.expectedPlanRevision === null || Number.isInteger(body.expectedPlanRevision)) ||
    typeof body.confirmReplacement !== 'boolean'
  )
    error(400, 'Assegnazione non valida.');
  try {
    await assignSpeaker(db, identity.uid, body);
  } catch (e) {
    const message = (e as Error).message;
    error(message.startsWith('Conflitto') ? 409 : 400, message);
  }
  return json({ saved: true });
};
