import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdmin } from '$lib/server/firebase-admin';
import { getAccessDenial, parseAllowList } from '$lib/server/access-policy';
import type { RequestHandler } from './$types';
const base = 'workspaces/codemotion-milano-2026';
export const POST: RequestHandler = async ({ request, url }) => {
  const headers = { 'Cache-Control': 'no-store' };
  // Browser requests must originate from this app. No cookies or caller-supplied emails are trusted.
  const origin = request.headers.get('origin');
  if (origin && origin !== url.origin)
    return json({ error: 'Origine non consentita.' }, { status: 403, headers });
  const bearer = request.headers.get('authorization');
  if (!bearer?.startsWith('Bearer '))
    return json({ error: 'Accedi con Google.' }, { status: 401, headers });
  let admin;
  try {
    admin = getAdmin();
  } catch (e) {
    return json(
      { error: e instanceof Error ? e.message : 'Configurazione server mancante.' },
      { status: 503, headers }
    );
  }
  let identity;
  try {
    identity = await admin.auth.verifyIdToken(bearer.slice(7), true);
  } catch {
    return json(
      { error: 'Sessione non valida. Accedi di nuovo con Google.' },
      { status: 401, headers }
    );
  }
  try {
    const allowedEmails = parseAllowList(env.ALLOW_LIST || '');
    const denial = getAccessDenial(identity, env.ALLOW_LIST || '');
    if (denial) {
      // Only boolean/count diagnostics: never log emails, tokens, lists or Admin credentials.
      console.warn('[access-policy-denied]', {
        configurationPresent: Boolean(env.ALLOW_LIST?.trim()),
        entryCount: allowedEmails.length,
        emailMatches:
          typeof identity.email === 'string' &&
          allowedEmails.includes(identity.email.toLowerCase()),
        emailVerified: identity.email_verified === true,
        googleProvider: identity.firebase?.sign_in_provider === 'google.com'
      });
      return json({ error: denial.error }, { status: denial.status, headers });
    }
    const config = admin.db.doc(`${base}/access/config`);
    const member = admin.db.doc(`${base}/members/${identity.uid}`);
    const policyReady = await admin.db.runTransaction(async (tx) => {
      const [configSnap, memberSnap] = await Promise.all([tx.get(config), tx.get(member)]);
      // Runtime requests can never publish policy: old deployments must not restore removed users.
      if (
        !configSnap.exists ||
        JSON.stringify(configSnap.data()?.allowedEmails) !== JSON.stringify(allowedEmails)
      )
        return false;
      {
        const displayName = identity.name || 'Membro BacaroTech';
        if (!memberSnap.exists || memberSnap.data()?.displayName !== displayName)
          tx.set(
            member,
            {
              displayName,
              role: 'editor',
              updatedAt: FieldValue.serverTimestamp(),
              ...(!memberSnap.exists ? { createdAt: FieldValue.serverTimestamp() } : {})
            },
            { merge: true }
          );
      }
      return true;
    });
    if (!policyReady)
      return json(
        {
          error:
            'La configurazione ALLOW_LIST non è stata pubblicata per questo deploy. Esegui npm run access:sync e riavvia il server.'
        },
        { status: 503, headers }
      );

    return json({ allowed: true, uid: identity.uid }, { headers });
  } catch {
    return json(
      {
        error:
          'Verifica accesso non riuscita. Controlla i permessi Firebase Admin del server e riprova.'
      },
      { status: 503, headers }
    );
  }
};
