import { runAccessStep } from '$lib/server/access-diagnostics';
import { json } from '@sveltejs/kit';
import { authorize } from '$lib/server/authorize';
import type { RequestHandler } from './$types';
export const POST: RequestHandler = async ({ request, url }) => {
  const { db, identity, superadmin } = await authorize(request, url);
  await runAccessStep('member-sync', () =>
    db.runTransaction(async (transaction) => {
      const ref = db.doc(`workspaces/codemotion-milano-2026/members/${identity.uid}`);
      const snapshot = await transaction.get(ref);
      const displayName = identity.name || 'Membro BacaroTech';
      if (
        !snapshot.exists ||
        snapshot.data()?.displayName !== displayName ||
        snapshot.data()?.role !== 'editor'
      ) {
        transaction.set(ref, { displayName, role: 'editor' }, { merge: true });
      }
    })
  );
  return json(
    { allowed: true, uid: identity.uid, superadmin },
    { headers: { 'Cache-Control': 'no-store' } }
  );
};
