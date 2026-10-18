import { expect, it, vi } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
vi.mock('$env/dynamic/public', () => ({ env: { PUBLIC_FIREBASE_PROJECT_ID: 'demo-cache-test' } }));
vi.mock('@vercel/functions', () => {
  const values = new Map<string, unknown>();
  return {
    getCache: ({ namespace }: { namespace: string }) => ({
      get: async (key: string) => values.get(namespace + key) ?? null,
      set: async (key: string, value: unknown) => {
        values.set(namespace + key, value);
      }
    })
  };
});
import { readCollection, invalidateCollections } from '../src/lib/server/firestore-cache';

it('repeated collection polls read Firestore only once until a mutation invalidates it', async () => {
  let content = 'original';
  const get = vi.fn(async () => ({
    size: 1,
    docs: [{ id: 'one', data: () => ({ title: content }) }]
  }));
  const db = { collection: () => ({ get }) } as unknown as Firestore;
  const otherInstance = { collection: () => ({ get }) } as unknown as Firestore;
  await Promise.all(Array.from({ length: 8 }, () => readCollection(db, 'speakers')));
  expect(get).toHaveBeenCalledTimes(1);
  expect(await readCollection(otherInstance, 'speakers')).toEqual([
    { id: 'one', title: 'original' }
  ]);
  expect(get).toHaveBeenCalledTimes(1);
  content = 'updated';
  await invalidateCollections(db, ['speakers']);
  expect(await readCollection(otherInstance, 'speakers')).toEqual([
    { id: 'one', title: 'updated' }
  ]);
  expect(get).toHaveBeenCalledTimes(2);
});
