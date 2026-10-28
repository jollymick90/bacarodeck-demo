import { queueConnections, scheduleConnections } from '$lib/server/connections/service';
import { trackEditorialFields } from '$lib/editorial-export';
import { guardConductorWrite, guardConductorDelete } from '$lib/conductor/write-policy';
import { validateBrief } from '$lib/conductor/brief';
import { validateNextInterview } from '$lib/conductor/next-interview';
import type { Dataset } from '$lib/fields';
import { invalidateCollections } from '$lib/server/firestore-cache';
import { error, json } from '@sveltejs/kit';
import { authorize } from '$lib/server/authorize';
import { collections, type Entity } from '$lib/fields';
import { prepareWrite, validateGraphLinkReferences, type Change } from '$lib/domain';
import type { RequestHandler } from './$types';
export const config = { maxDuration: 300 };
export const POST: RequestHandler = async ({ request, url }) => {
  const { db, identity } = await authorize(request, url);
  const body = await request.json().catch(() => error(400, 'JSON non valido.'));
  const changes: Change[] = body?.changes;
  if (body?.origin !== undefined && !['manual', 'import'].includes(body.origin))
    error(400, 'Origine non valida.');
  if (!Array.isArray(changes) || !changes.length || changes.length > 400)
    error(400, 'Sono richiesti da 1 a 400 documenti.');
  if (body.action !== 'save' && body.action !== 'delete') error(400, 'Operazione non valida.');
  if (changes.some((change) => change?.collection === 'speakerInterests'))
    error(400, 'Gli interessi si modificano dal proprio account nella vista conduttore.');
  const keys = changes.map((change) => {
    if (
      !change ||
      !collections.includes(change.collection) ||
      typeof change.data?.id !== 'string' ||
      !/^[a-zA-Z0-9_-]{1,128}$/.test(change.data.id) ||
      !(change.expectedRevision === null || Number.isInteger(change.expectedRevision))
    )
      error(400, 'Documento non valido.');
    return `${change.collection}/${change.data.id}`;
  });
  if (new Set(keys).size !== keys.length) error(400, 'Documenti duplicati.');
  const documents = await db.runTransaction(async (tx) => {
    const refs = keys.map((key) => db.doc(`workspaces/codemotion-milano-2026/${key}`));
    const snapshots = await Promise.all(refs.map((ref) => tx.get(ref)));
    const tombstones = await Promise.all(
      changes.map((change) =>
        change.collection === 'questions'
          ? tx.get(db.doc(`workspaces/codemotion-milano-2026/deletedQuestions/${change.data.id}`))
          : Promise.resolve(null)
      )
    );
    const context: Dataset = {};
    const contextNames = new Set<(typeof collections)[number]>();
    if (
      changes.some(
        (c) =>
          (body.action === 'save' &&
            c.collection === 'interviewPlans' &&
            c.data.nextInterview !== undefined) ||
          (c.collection === 'speakers' &&
            (body.action === 'delete' || c.data.status === 'archived'))
      )
    )
      for (const name of ['speakers', 'interviewPlans'] as const) contextNames.add(name);
    if (body.action === 'save' && changes.some((c) => c.collection === 'conductorBriefs'))
      for (const name of ['speakers', 'talks', 'questions', 'conductorBriefs'] as const)
        contextNames.add(name);
    if (body.action === 'save' && changes.some((c) => c.collection === 'graphLinks'))
      for (const name of ['speakers', 'questions', 'topics'] as const) contextNames.add(name);
    for (const name of contextNames) {
      const snapshot = await tx.get(db.collection(`workspaces/codemotion-milano-2026/${name}`));
      context[name] = snapshot.docs.map((d) => ({ ...d.data(), id: d.id }) as Entity);
    }
    for (const change of changes) {
      if (context[change.collection])
        context[change.collection] = [
          ...context[change.collection]!.filter((e) => e.id !== change.data.id),
          change.data
        ];
    }

    const writes = changes.map((change, index): Entity | null => {
      if (body.action === 'save' && tombstones[index]?.exists)
        error(409, 'Domanda eliminata: non può essere ripristinata da un import.');
      const snapshot = snapshots[index];
      const existing = snapshot.exists ? ({ ...snapshot.data(), id: snapshot.id } as Entity) : null;
      if (
        change.expectedRevision === null
          ? !!existing
          : !existing || existing.revision !== change.expectedRevision
      )
        error(409, 'Conflitto: il contenuto è cambiato. Ricarica prima di salvare.');
      if (body.action === 'delete') {
        if (!existing) error(409, 'Documento già eliminato.');
        try {
          guardConductorDelete(change.collection, existing);
        } catch (e) {
          error(400, (e as Error).message);
        }
        return null;
      }
      try {
        guardConductorWrite(change.collection, change.data, existing);
        if (change.collection === 'graphLinks') validateGraphLinkReferences(change.data, context);
        if (change.collection === 'conductorBriefs') {
          validateBrief(change.data, context);
          if (
            context.conductorBriefs?.some(
              (b) =>
                b.id !== change.data.id &&
                b.speakerId === change.data.speakerId &&
                String(b.talkId || '') === String(change.data.talkId || '')
            )
          )
            throw Error('Scheda conduttore duplicata per lo stesso talk.');
        }
        const write = prepareWrite(
          change.collection,
          change.data,
          existing,
          identity.uid,
          Date.now()
        );
        return { ...write, ...trackEditorialFields(write, existing, body.origin || 'manual') };
      } catch (failure) {
        error(400, failure instanceof Error ? failure.message : 'Documento non valido.');
      }
    });
    if (context.interviewPlans) {
      changes.forEach((change, index) => {
        if (change.collection === 'interviewPlans' || change.collection === 'speakers') {
          context[change.collection] = context[change.collection]!.filter(
            (p) => p.id !== change.data.id
          );
          if (writes[index]) context[change.collection]!.push(writes[index]!);
        }
      });
      try {
        validateNextInterview(context);
      } catch (failure) {
        const message = (failure as Error).message;
        error(message.startsWith('Conflitto') ? 409 : 400, message);
      }
    }
    queueConnections(
      tx,
      db,
      changes.map((c) => c.collection)
    );
    refs.forEach((ref, index) => {
      const write = writes[index];
      if (write) {
        if (changes[index].collection === 'questions' && snapshots[index].data()?.ratings)
          write.ratings = snapshots[index].data()!.ratings;
        tx.set(ref, write);
      } else {
        tx.delete(ref);
        if (changes[index].collection === 'questions')
          tx.set(
            db.doc(`workspaces/codemotion-milano-2026/deletedQuestions/${changes[index].data.id}`),
            { deletedAt: Date.now() }
          );
      }
    });
    return writes.filter((write): write is Entity => write !== null);
  });
  await invalidateCollections(db, [
    ...changes.map((change) => change.collection),
    ...(body.action === 'delete' && changes.some((change) => change.collection === 'questions')
      ? ['deletedQuestions']
      : [])
  ]);
  scheduleConnections(db);
  return json({ saved: true, documents }, { headers: { 'Cache-Control': 'no-store' } });
};
