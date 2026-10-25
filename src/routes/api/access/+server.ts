import { createHash } from 'node:crypto';
import { firestoreCache, invalidateCollections } from '$lib/server/firestore-cache';
import { runAccessStep } from '$lib/server/access-diagnostics';
import { json } from '@sveltejs/kit';
import { authorize } from '$lib/server/authorize';
import type { RequestHandler } from './$types';
export const POST: RequestHandler = async ({ request, url }) => {
  const { db, identity, superadmin } = await authorize(request, url, false);
  const syncKey = createHash('sha256')
    .update(JSON.stringify([identity.uid, identity.email, identity.name || 'Membro BacaroTech']))
    .digest('hex');
  await runAccessStep('member-sync', () =>
    firestoreCache(db).read(`member-sync:${syncKey}`, 3600, async () => {
      const changed = await db.runTransaction(async (transaction) => {
        const ref = db.doc(`workspaces/codemotion-milano-2026/members/${identity.uid}`);
        const snapshot = await transaction.get(ref);
        const displayName = identity.name || 'Membro BacaroTech';
        if (
          !snapshot.exists ||
          snapshot.data()?.displayName !== displayName ||
          snapshot.data()?.role !== 'editor' ||
          snapshot.data()?.email !== identity.email
        ) {
          transaction.set(
            ref,
            { displayName, email: identity.email, role: 'editor' },
            { merge: true }
          );
          return true;
        }
        return false;
      });
      if (changed) await invalidateCollections(db, ['members']);
      return true;
    })
  );
  return json(
    { allowed: true, uid: identity.uid, superadmin },
    { headers: { 'Cache-Control': 'no-store' } }
  );
};
