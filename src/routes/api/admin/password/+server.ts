import { error, isHttpError, json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { authorize } from '$lib/server/authorize';
import { readAccessMembers } from '$lib/server/member-access';
import { accessConfiguration, accessEntries } from '$lib/assignees';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, url }) => {
  const { auth, superadmin } = await authorize(request, url);
  if (!superadmin) error(403, 'Operazione riservata al superadmin.');
  const body = await request.json().catch(() => error(400, 'JSON non valido.'));
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (
    !/^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(email) ||
    email.length > 254 ||
    typeof body.enabled !== 'boolean'
  )
    error(400, 'Email o operazione non valida.');
  if (
    body.enabled &&
    (typeof body.password !== 'string' ||
      body.password.trim().length < 12 ||
      body.password.length > 128)
  )
    error(400, 'La password deve contenere da 12 a 128 caratteri.');
  const entries = accessEntries(accessConfiguration(env), await readAccessMembers(true));
  const target = entries.find((entry) => entry.email === email);
  if (!target || (body.enabled && !target.enabled))
    error(403, 'Abilita prima l’accesso di questa persona.');
  try {
    let user = await auth.getUserByEmail(email).catch((failure) => {
      if (failure.code === 'auth/user-not-found') return null;
      throw failure;
    });
    if (body.enabled) {
      if (user?.disabled) error(400, 'L’account è disabilitato in Firebase Authentication.');
      if (user) user = await auth.updateUser(user.uid, { password: body.password });
      else {
        try {
          user = await auth.createUser({
            email,
            password: body.password,
            displayName: email.split('@')[0]
          });
        } catch (failure) {
          if ((failure as { code?: string }).code !== 'auth/email-already-exists') throw failure;
          // Google sign-in may have created the account while this request was in flight.
          user = await auth.getUserByEmail(email);
          if (user.disabled) error(400, 'L’account è disabilitato in Firebase Authentication.');
          user = await auth.updateUser(user.uid, { password: body.password });
        }
      }
    }
    if (user) {
      const claims = { ...user.customClaims };
      if (body.enabled) {
        claims.bacaroPasswordLogin = true;
        claims.bacaroPasswordEmail = email;
        claims.bacaroPasswordVersion = crypto.randomUUID();
      } else {
        delete claims.bacaroPasswordLogin;
        delete claims.bacaroPasswordEmail;
        delete claims.bacaroPasswordVersion;
      }
      await auth.setCustomUserClaims(user.uid, claims);
      await auth.revokeRefreshTokens(user.uid);
    }
  } catch (failure) {
    if (isHttpError(failure)) throw failure;
    // Never expose Firebase's request details: this operation carries a password.
    const code = (failure as { code?: string }).code;
    console.error('[password-access]', {
      code: typeof code === 'string' && /^auth\/[a-z-]+$/.test(code) ? code : 'unknown'
    });
    if (code === 'auth/insufficient-permission')
      error(
        503,
        'Il service account non ha i permessi per gestire gli utenti Firebase Authentication.'
      );
    error(500, 'Impossibile aggiornare l’accesso con password. Riprova.');
  }
  return json({ saved: true }, { headers: { 'Cache-Control': 'private, no-store' } });
};
