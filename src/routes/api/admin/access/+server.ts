import { firestoreCache } from '$lib/server/firestore-cache';
import { error, json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { authorize } from '$lib/server/authorize';
import { accessDocument, readAccessMembers } from '$lib/server/member-access';
import { parseAllowList } from '$lib/server/access-policy';
import { accessConfiguration, accessEntries } from '$lib/assignees';
import type { RequestHandler } from './$types';
const headers = { 'Cache-Control': 'private, no-store' };
export const GET: RequestHandler = async ({ request, url }) => {
  const { auth, superadmin } = await authorize(request, url);
  if (!superadmin) error(403, 'Operazione riservata al superadmin.');
  const data = await readAccessMembers();
  const entries = accessEntries(accessConfiguration(env), data);
  const passwordEmails = new Set<string>();
  for (let index = 0; index < entries.length; index += 100) {
    const result = await auth.getUsers(
      entries.slice(index, index + 100).map(({ email }) => ({ email }))
    );
    for (const user of result.users)
      if (
        user.customClaims?.bacaroPasswordLogin === true &&
        user.email &&
        user.customClaims.bacaroPasswordEmail === user.email.toLowerCase() &&
        typeof user.customClaims.bacaroPasswordVersion === 'string'
      )
        passwordEmails.add(user.email.toLowerCase());
  }
  return json(
    entries.map((entry) => ({ ...entry, passwordEnabled: passwordEmails.has(entry.email) })),
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
  if (parseAllowList(accessConfiguration(env).permanent).includes(email))
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
  await firestoreCache(db).invalidate('access-members');
  return json({ saved: true }, { headers });
};
