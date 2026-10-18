import { runAccessStep } from './access-diagnostics';
import { error } from '@sveltejs/kit';
import { getAccessState } from './member-access';
import { getAdmin } from './firebase-admin';
import { getAccessDenial } from './access-policy';

export async function authorize(
  request: Request,
  url: URL,
  freshPermissions = request.method !== 'GET'
) {
  const origin = request.headers.get('origin');
  if (origin && origin !== url.origin) error(403, 'Origine non consentita.');
  const bearer = request.headers.get('authorization');
  if (!bearer?.startsWith('Bearer ')) error(401, 'Accedi con Google.');
  const admin = await runAccessStep('admin-init', getAdmin);
  const identity = await admin.auth.verifyIdToken(bearer.slice(7), true).catch(() => {
    error(401, 'Sessione non valida. Accedi di nuovo con Google.');
  });
  const denial = getAccessDenial(identity, identity.email || '');
  if (denial) error(denial.status, denial.error);
  const permissions = await runAccessStep('policy-read', () =>
    getAccessState(identity.email!, freshPermissions)
  );
  if (!permissions.allowed)
    error(403, 'Questo account Google non è abilitato. Chiedi al superadmin di aggiungerti.');
  return { ...admin, identity, ...permissions };
}
