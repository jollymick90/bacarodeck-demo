import { error, json } from '@sveltejs/kit';
import { authorize } from '$lib/server/authorize';
import {
  getConnections,
  refreshConnections,
  saveConnectionDecision,
  type DecisionRequest
} from '$lib/server/connections/service';
import type { RequestHandler } from './$types';
export const config = { maxDuration: 300 };
const headers = { 'Cache-Control': 'private, no-store' };
export const GET: RequestHandler = async ({ request, url }) => {
  const { db } = await authorize(request, url);
  return json(await getConnections(db), { headers });
};
export const POST: RequestHandler = async ({ request, url }) => {
  const { db, identity } = await authorize(request, url);
  const body = await request.json().catch(() => error(400, 'JSON non valido.'));
  if (body?.action === 'refresh') {
    await refreshConnections(db);
    return json({ queued: true }, { headers });
  }
  if (
    body?.action !== 'decision' ||
    typeof body.source !== 'string' ||
    typeof body.target !== 'string' ||
    typeof body.kind !== 'string' ||
    !['linked', 'confirmed', 'dismissed', 'reset'].includes(body.decision) ||
    !(
      body.expectedRevision === null ||
      (Number.isInteger(body.expectedRevision) && body.expectedRevision >= 0)
    ) ||
    (body.reason !== undefined && (typeof body.reason !== 'string' || body.reason.length > 2000))
  )
    error(400, 'Collegamento non valido.');
  try {
    await saveConnectionDecision(db, identity.uid, body as DecisionRequest);
  } catch (e) {
    const m = e instanceof Error ? e.message : 'Operazione non riuscita.';
    error(m.startsWith('Conflitto') ? 409 : 400, m);
  }
  return json({ saved: true }, { headers });
};
