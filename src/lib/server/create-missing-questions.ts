import { error } from '@sveltejs/kit';
import type { Firestore } from 'firebase-admin/firestore';
import { parseImport, prepareWrite, type ImportData } from '../domain';
import { trackEditorialFields } from '../editorial-export';
import { invalidateCollections, workspacePath } from './firestore-cache';
import { queueConnections, scheduleConnections } from './connections/service';

/** Creates a first set of questions only. Existing questions and assignments are never updated. */
export async function createMissingQuestions(db: Firestore, input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    error(400, 'Oggetto JSON richiesto.');
  const { dryRun = false, ...payload } = input as Record<string, unknown>;
  const allowed = ['schemaVersion', 'workspaceId', 'dataSnapshotDate', 'description', 'questions'];
  if (typeof dryRun !== 'boolean' || Object.keys(payload).some((key) => !allowed.includes(key)))
    error(400, 'Sono consentite solo domande nuove e dryRun booleano.');
  let parsed: ImportData;
  try {
    parsed = parseImport(JSON.stringify(payload));
  } catch (failure) {
    error(400, failure instanceof Error ? failure.message : 'Import non valido.');
  }
  const questions = parsed.questions;
  if (!questions?.length) error(400, 'Inserisci da 1 a 200 domande.');
  for (const question of questions) {
    if (
      typeof question.speakerId !== 'string' ||
      !/^[a-zA-Z0-9_-]{1,128}$/.test(question.speakerId)
    )
      error(400, 'Ogni domanda richiede uno speakerId valido.');
    if (![question.textIt, question.textEn].some((text) => typeof text === 'string' && text.trim()))
      error(400, 'Ogni domanda richiede un testo italiano o inglese.');
  }
  const speakerIds = [...new Set(questions.map((question) => question.speakerId as string))];
  const questionIds = questions.map((question) => question.id);

  await db.runTransaction(async (tx) => {
    // Read fresh database state, not the public feed's cache. The per-speaker guard also
    // serializes concurrent imports of different question IDs for the same empty speaker.
    const guards = speakerIds.map((id) => db.doc(`${workspacePath}/questionImports/${id}`));
    const refs = questionIds.map((id) => db.doc(`${workspacePath}/questions/${id}`));
    const [speakers, existingQuestions, , existingIds, deletedIds] = await Promise.all([
      Promise.all(speakerIds.map((id) => tx.get(db.doc(`${workspacePath}/speakers/${id}`)))),
      Promise.all(
        speakerIds.map((id) =>
          tx.get(db.collection(`${workspacePath}/questions`).where('speakerId', '==', id).limit(1))
        )
      ),
      Promise.all(guards.map((ref) => tx.get(ref))),
      Promise.all(refs.map((ref) => tx.get(ref))),
      Promise.all(
        questionIds.map((id) => tx.get(db.doc(`${workspacePath}/deletedQuestions/${id}`)))
      )
    ]);
    for (const [index, speakerId] of speakerIds.entries()) {
      if (!speakers[index].exists) error(404, `Speaker non trovato: ${speakerId}.`);
      if (!existingQuestions[index].empty)
        error(409, `Lo speaker ${speakerId} ha già domande. Nessuna domanda è stata aggiunta.`);
    }
    if (
      existingIds.some((snapshot) => snapshot.exists) ||
      deletedIds.some((snapshot) => snapshot.exists)
    )
      error(409, 'Un ID domanda esiste già o è stato eliminato. Nessuna domanda è stata aggiunta.');
    if (dryRun) return;

    const now = Date.now();
    const writes = questions.map((question) => {
      const write = prepareWrite(
        'questions',
        { ...question, status: 'suggested' },
        null,
        'question-import-api',
        now
      );
      return { ...write, ...trackEditorialFields(write, null, 'import') };
    });
    queueConnections(tx, db, ['questions']);
    for (const [index, write] of writes.entries()) tx.create(refs[index], write);
    for (const guard of guards) tx.set(guard, { updatedAt: now });
  });
  if (!dryRun) {
    await invalidateCollections(db, ['questions']);
    scheduleConnections(db);
  }
  return {
    saved: !dryRun,
    dryRun,
    created: dryRun ? 0 : questions.length,
    ...(dryRun ? { wouldCreate: questions.length } : {}),
    speakerIds,
    questionIds
  };
}
