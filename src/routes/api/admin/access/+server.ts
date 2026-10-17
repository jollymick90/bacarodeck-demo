import { error, json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { authorize } from '$lib/server/authorize';
import { accessDocument } from '$lib/server/member-access';
import { parseAllowList } from '$lib/server/access-policy';
import type { RequestHandler } from './$types';
const headers = { 'Cache-Control': 'private, no-store' };
export const GET: RequestHandler = async ({ request, url }) => {
  const { db, superadmin } = await authorize(request, url);
  if (!superadmin) error(403, 'Operazione riservata al superadmin.');
  const data = (await db.doc(accessDocument).get()).data();
  const permanent = parseAllowList(env.SUPERADMIN_EMAILS || '');
  const blocked: string[] = data?.blocked || [];
  const emails = [
    ...new Set([
      ...permanent,
      ...parseAllowList(env.ALLOW_LIST || ''),
      ...(data?.added || []),
      ...blocked
    ])
  ].sort();
  return json(
    emails.map((email) => ({
      email,
      permanent: permanent.includes(email),
      enabled: permanent.includes(email) || !blocked.includes(email)
    })),
    { headers }
  );
};
export const POST: RequestHandler = async ({ request, url }) => {
  const { db, superadmin } = await authorize(request, url);
  if (!superadmin) error(403, 'Operazione riservata al superadmin.');
  const body = await request.json().catch(() => error(400, 'JSON non valido.'));
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (
    !/^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(email) ||
    email.length > 254 ||
    typeof body.enabled !== 'boolean'
  )
    error(400, 'Email o operazione non valida.');
  if (parseAllowList(env.SUPERADMIN_EMAILS || '').includes(email))
    error(400, 'Gli amministratori permanenti si gestiscono nella configurazione del server.');
  const ref = db.doc(accessDocument);
  await db.runTransaction(async (tx) => {
    const data = (await tx.get(ref)).data();
    const added = new Set<string>(data?.added || []);
    const blocked = new Set<string>(data?.blocked || []);
    if (body.enabled) {
      added.add(email);
      blocked.delete(email);
    } else {
      added.delete(email);
      blocked.add(email);
    }
    tx.set(ref, { added: [...added].sort(), blocked: [...blocked].sort() });
  });
  return json({ saved: true }, { headers });
};
