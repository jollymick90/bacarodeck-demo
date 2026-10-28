import { runAccessStep } from './access-diagnostics';
import { error } from '@sveltejs/kit';
import { getAccessState } from './member-access';
import { getAdmin } from './firebase-admin';
import { getAccessDenial, isCurrentPasswordGrant } from './access-policy';

export async function authorize(
  request: Request,
  url: URL,
  freshPermissions = request.method !== 'GET'
) {
  const origin = request.headers.get('origin');
  if (origin && origin !== url.origin) error(403, 'Origine non consentita.');
  const bearer = request.headers.get('authorization');
  if (!bearer?.startsWith('Bearer ')) error(401, 'Accedi con Google oppure email e password.');
  const admin = await runAccessStep('admin-init', getAdmin);
  const identity = await admin.auth.verifyIdToken(bearer.slice(7), true).catch(() => {
    error(401, 'Sessione non valida. Accedi di nuovo.');
  });
  const denial = getAccessDenial(identity, identity.email || '');
  if (denial) error(denial.status, denial.error);
  if (identity.firebase?.sign_in_provider === 'password') {
    // Read the current grant: second-resolution token revocation alone can miss a same-second reset.
    const user = await admin.auth
      .getUser(identity.uid)
      .catch(() => error(401, 'Sessione non valida. Accedi di nuovo.'));
    if (!isCurrentPasswordGrant(identity, user))
      error(
        403,
        'Accesso con password modificato o disabilitato. Accedi di nuovo oppure contatta il superadmin.'
      );
  }
  const permissions = await runAccessStep('policy-read', () =>
    getAccessState(identity.email!, freshPermissions)
  );
  if (!permissions.allowed)
    error(403, 'Questo account non è abilitato. Chiedi al superadmin di aggiungerti.');
  return { ...admin, identity, ...permissions };
}
