import { error, json } from '@sveltejs/kit';
import { authorize } from '$lib/server/authorize';
import { readCollection } from '$lib/server/firestore-cache';
import { collectionPage, collectionVersion } from '$lib/server/offline-package';
import { offlineCollections } from '$lib/offline/snapshot';
import type { Entity } from '$lib/fields';
import type { RequestHandler } from './$types';
export const GET: RequestHandler = async ({ request, url }) => {
  const { db } = await authorize(request, url);
  const headers = { 'Cache-Control': 'private, no-store' };
  const name = url.searchParams.get('collection');
  if (!name) {
    const versions = await Promise.all(
      offlineCollections.map(async (c) => [
        c,
        collectionVersion((await readCollection(db, c)) as Entity[])
      ])
    );
    return json({ versions: Object.fromEntries(versions) }, { headers });
  }
  if (!(offlineCollections as readonly string[]).includes(name))
    error(400, 'Collezione non valida.');
  const offset = Number(url.searchParams.get('offset') || 0);
  if (!Number.isInteger(offset) || offset < 0) error(400, 'Offset non valido.');
  const entities = (await readCollection(db, name)) as Entity[];
  const version = collectionVersion(entities);
  if (version !== url.searchParams.get('version'))
    error(409, 'I dati sono cambiati durante il download. Riprova.');
  if (offset > entities.length) error(400, 'Offset non valido.');
  return json({ ...collectionPage(entities, offset), version }, { headers });
};
