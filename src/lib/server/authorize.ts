import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { getAdmin } from './firebase-admin';
import { getAccessDenial } from './access-policy';

export async function authorize(request: Request, url: URL) {
  const origin = request.headers.get('origin');
  if (origin && origin !== url.origin) error(403, 'Origine non consentita.');
  const bearer = request.headers.get('authorization');
  if (!bearer?.startsWith('Bearer ')) error(401, 'Accedi con Google.');
  const admin = getAdmin();
  const identity = await admin.auth.verifyIdToken(bearer.slice(7), true).catch(() => {
    error(401, 'Sessione non valida. Accedi di nuovo con Google.');
  });
  const denial = getAccessDenial(identity, env.ALLOW_LIST || '');
  if (denial) error(denial.status, denial.error);
  return { ...admin, identity };
}
