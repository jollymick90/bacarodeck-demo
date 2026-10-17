import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
export function getAdmin() {
  const projectId = publicEnv.PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error('Configura PUBLIC_FIREBASE_PROJECT_ID.');
  if (dev && publicEnv.PUBLIC_USE_EMULATORS === 'true') {
    process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
    process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
  }
  if (!dev && (process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST))
    throw new Error('Emulatori non consentiti in produzione.');
  const emulator =
    dev && !!process.env.FIREBASE_AUTH_EMULATOR_HOST && !!process.env.FIRESTORE_EMULATOR_HOST;
  let app = getApps().find((app) => app.name === 'bacarodeck-admin');
  if (!app) {
    if (emulator) app = initializeApp({ projectId }, 'bacarodeck-admin');
    else if (env.FIREBASE_ADMIN_KEY) {
      let account;
      try {
        account = JSON.parse(env.FIREBASE_ADMIN_KEY);
      } catch {
        throw new Error('FIREBASE_ADMIN_KEY deve contenere il JSON del service account.');
      }
      if (account.project_id !== projectId)
        throw new Error(
          'Il progetto di FIREBASE_ADMIN_KEY non coincide con PUBLIC_FIREBASE_PROJECT_ID.'
        );
      app = initializeApp({ projectId, credential: cert(account) }, 'bacarodeck-admin');
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      app = initializeApp({ projectId, credential: applicationDefault() }, 'bacarodeck-admin');
    } else throw new Error('Configura FIREBASE_ADMIN_KEY sul server per abilitare ALLOW_LIST.');
  }
  return { auth: getAuth(app), db: getFirestore(app) };
}
