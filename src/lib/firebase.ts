import { browser } from '$app/environment';
import { env } from '$env/dynamic/public';
import { getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserPopupRedirectResolver,
  connectAuthEmulator
} from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  connectFirestoreEmulator,
  memoryLocalCache
} from 'firebase/firestore';
export const workspaceId = 'codemotion-milano-2026';
export function getFirebase() {
  if (!browser) return null;
  const config = {
    apiKey: env.PUBLIC_FIREBASE_API_KEY,
    authDomain: env.PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: env.PUBLIC_FIREBASE_PROJECT_ID,
    appId: env.PUBLIC_FIREBASE_APP_ID
  };
  if (Object.values(config).some((v) => !v)) return null;
  const existing = getApps()[0];
  const app = existing || initializeApp(config);
  // Both routes share the same SDK instances. Auth restores the saved account
  // before onAuthStateChanged emits, including after a full browser restart.
  const auth = existing
    ? getAuth(app)
    : initializeAuth(app, {
        persistence: [indexedDBLocalPersistence, browserLocalPersistence],
        popupRedirectResolver: browserPopupRedirectResolver
      });
  // Creating a new memoryLocalCache on every mount counts as different settings
  // and makes initializeFirestore throw when navigating to the other route.
  const db = existing
    ? getFirestore(app)
    : initializeFirestore(app, { localCache: memoryLocalCache() });
  if (!existing && import.meta.env.DEV && env.PUBLIC_USE_EMULATORS === 'true') {
    connectAuthEmulator(auth, env.PUBLIC_AUTH_EMULATOR_URL || 'http://127.0.0.1:9099', {
      disableWarnings: true
    });
    connectFirestoreEmulator(db, '127.0.0.1', Number(env.PUBLIC_FIRESTORE_EMULATOR_PORT || 8080));
  }
  return { auth, db };
}
