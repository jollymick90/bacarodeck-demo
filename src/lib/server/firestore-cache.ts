import { env } from '$env/dynamic/public';
import { createHash } from 'node:crypto';
import { getCache } from '@vercel/functions';
import type { Firestore } from 'firebase-admin/firestore';
import { ReadCache } from './read-cache';

export const workspacePath = 'workspaces/codemotion-milano-2026';
const caches = new WeakMap<Firestore, ReadCache>();

export function firestoreCache(db: Firestore): ReadCache {
  const scope = [
    'bacarodeck-v1',
    env.PUBLIC_FIREBASE_PROJECT_ID,
    workspacePath,
    process.env.VERCEL_PROJECT_ID || 'local',
    process.env.FIRESTORE_EMULATOR_HOST || 'production'
  ].join(':');
  let cache = caches.get(db);
  if (!cache) {
    const namespace = createHash('sha256').update(scope).digest('hex');
    cache = new ReadCache(
      getCache({
        namespace,
        keyHashFunction: (key) => createHash('sha256').update(key).digest('hex')
      })
    );
    caches.set(db, cache);
  }
  return cache;
}

export function readCollection(db: Firestore, collection: string) {
  return firestoreCache(db).read(`collection:${collection}`, 300, async () => {
    const snapshot = await db.collection(`${workspacePath}/${collection}`).get();
    console.info('[firestore-read]', { collection, documents: snapshot.size });
    return snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
  });
}

export async function invalidateCollections(db: Firestore, collections: string[]) {
  await Promise.all(
    [...new Set(collections)].map((name) => firestoreCache(db).invalidate(`collection:${name}`))
  );
}
