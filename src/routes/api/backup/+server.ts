import { createHash } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { error, json } from '@sveltejs/kit';
import { authorize } from '$lib/server/authorize';
import { readCollection, invalidateCollections, workspacePath } from '$lib/server/firestore-cache';
import {
  backupCollections,
  backupPage,
  canonical,
  equivalentRestore,
  validateBackupEntity,
  type RestoreChange
} from '$lib/workspace-backup';
import { collections, type Entity } from '$lib/fields';
import type { RequestHandler } from './$types';
const headers = { 'Cache-Control': 'private, no-store' };

export const GET: RequestHandler = async ({ request, url }) => {
  const { db } = await authorize(request, url);
  const collection = url.searchParams.get('collection');
  const offset = Number(url.searchParams.get('offset') || '0');
  if (
    !collection ||
    !(backupCollections as readonly string[]).includes(collection) ||
    !Number.isSafeInteger(offset) ||
    offset < 0
  )
    error(400, 'Pagina backup non valida.');
  const records = await readCollection(db, collection);
  const version = createHash('sha256').update(JSON.stringify(records)).digest('hex');
  if (
    (offset > 0 || url.searchParams.has('version')) &&
    url.searchParams.get('version') !== version
  )
    error(409, 'La collezione è cambiata durante l’esportazione. Riprova senza modificare i dati.');
  if (offset > records.length) error(400, 'Pagina fuori intervallo.');
  const page = backupPage(records, offset);
  return json({ collection, version, ...page }, { headers });
};

export const POST: RequestHandler = async ({ request, url }) => {
  const { db, identity, superadmin } = await authorize(request, url);
  if (!superadmin) error(403, 'Ripristino completo riservato al superadmin.');
  const text = await request.text();
  if (new TextEncoder().encode(text).length > 2_000_000) error(413, 'Blocco troppo grande.');
  let changes: RestoreChange[];
  try {
    const body = JSON.parse(text);
    changes = body.changes;
    if (!Array.isArray(changes) || !changes.length || changes.length > 100)
      throw new Error('Blocco non valido.');
    const seen = new Set<string>();
    for (const change of changes) {
      if (
        !change ||
        !backupCollections.includes(change.collection) ||
        typeof change.id !== 'string' ||
        !/^[a-zA-Z0-9_-]{1,128}$/.test(change.id)
      )
        throw new Error('Documento non valido.');
      if (change.data === null && !['questions', 'deletedQuestions'].includes(change.collection))
        throw new Error('Cancellazione non consentita dal ripristino.');
      for (const value of [change.data, change.expected]) {
        if (value === null) continue;
        validateBackupEntity(change.collection, value);
        if (value.id !== change.id) throw new Error('ID non coerente.');
      }
      const key = `${change.collection}/${change.id}`;
      if (seen.has(key)) throw new Error('Documento duplicato.');
      seen.add(key);
    }
  } catch (failure) {
    error(400, failure instanceof Error ? failure.message : 'Backup non valido.');
  }
  await db.runTransaction(async (tx) => {
    const keys = new Set(changes.map((change) => `${change.collection}/${change.id}`));
    for (const change of changes) {
      if (change.collection === 'questions') keys.add(`deletedQuestions/${change.id}`);
      if (change.collection === 'deletedQuestions') keys.add(`questions/${change.id}`);
    }
    const refs = [...keys].map((key) => db.doc(`${workspacePath}/${key}`));
    const snapshots = await Promise.all(refs.map((ref) => tx.get(ref)));
    const current = new Map<string, Entity | null>(
      [...keys].map((key, index) => [
        key,
        snapshots[index].exists
          ? JSON.parse(JSON.stringify({ ...snapshots[index].data(), id: snapshots[index].id }))
          : null
      ])
    );
    const final = new Map(current);
    for (const change of changes) {
      const key = `${change.collection}/${change.id}`;
      const existing = current.get(key) || null;
      if (
        !equivalentRestore(existing, change.data) &&
        canonical(existing) !== canonical(change.expected)
      )
        error(
          409,
          `Conflitto su ${key}. Ricarica l’anteprima; i blocchi già completati restano salvati.`
        );
      final.set(key, change.data);
    }
    for (const change of changes) {
      if (
        ['questions', 'deletedQuestions'].includes(change.collection) &&
        final.get(`questions/${change.id}`) &&
        final.get(`deletedQuestions/${change.id}`)
      )
        error(
          409,
          'La domanda e la sua cancellazione devono essere ripristinate insieme. Ricarica l’anteprima.'
        );
    }
    for (const change of changes) {
      const key = `${change.collection}/${change.id}`;
      const existing = current.get(key) || null;
      if (equivalentRestore(existing, change.data)) continue;
      const ref = db.doc(`${workspacePath}/${key}`);
      if (change.data === null) {
        tx.delete(ref);
        continue;
      }
      const data = { ...change.data };
      if ((collections as readonly string[]).includes(change.collection)) {
        data.revision = Math.max(Number(existing?.revision || 0), Number(data.revision || 0)) + 1;
        data.updatedAt = Date.now();
        data.updatedBy = identity.uid;
      }
      // Base imports used Firestore Timestamp; retain that type for creation history.
      const created = data.createdAt;
      const document: Record<string, unknown> = { ...data };
      if (
        created &&
        typeof created === 'object' &&
        !Array.isArray(created) &&
        Object.keys(created).length === 2 &&
        Number.isInteger(created._seconds) &&
        Number.isInteger(created._nanoseconds)
      ) {
        document.createdAt = new Timestamp(Number(created._seconds), Number(created._nanoseconds));
      }
      tx.set(ref, document);
    }
  });
  await invalidateCollections(
    db,
    changes.map((change) => change.collection)
  );
  return json({ saved: changes.length }, { headers });
};
