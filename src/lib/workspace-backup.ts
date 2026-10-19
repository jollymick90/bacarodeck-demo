import { collections, auditKeys, type Entity, type Collection } from './fields';
import { validateEntity } from './domain';

export const backupCollections = [...collections, 'members', 'deletedQuestions'] as const;
export type BackupCollection = (typeof backupCollections)[number];
export type BackupData = Record<BackupCollection, Entity[]>;
export type WorkspaceBackup = {
  format: 'bacarodeck-workspace';
  version: 1;
  workspaceId: 'codemotion-milano-2026';
  exportedAt: string;
  data: BackupData;
};
export type RestoreChange = {
  collection: BackupCollection;
  id: string;
  data: Entity | null;
  expected: Entity | null;
};
const idPattern = /^[a-zA-Z0-9_-]{1,128}$/;

export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`)
      .join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}

export function equivalentRestore(a: Entity | null, b: Entity | null): boolean {
  const content = (item: Entity | null) =>
    item &&
    Object.fromEntries(
      Object.entries(item).filter(([key]) => !['revision', 'updatedAt', 'updatedBy'].includes(key))
    );
  return canonical(content(a)) === canonical(content(b));
}

export function makeBackup(data: Partial<BackupData>): WorkspaceBackup {
  return {
    format: 'bacarodeck-workspace',
    version: 1,
    workspaceId: 'codemotion-milano-2026',
    exportedAt: new Date().toISOString(),
    data: Object.fromEntries(
      backupCollections.map((name) => [name, data[name] || []])
    ) as BackupData
  };
}

export function validateBackupEntity(
  collection: BackupCollection,
  value: unknown
): asserts value is Entity {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Documento non valido.');
  const entity = value as Entity;
  if (typeof entity.id !== 'string' || !idPattern.test(entity.id))
    throw new Error('ID documento non valido.');
  if (collection === 'members') {
    if (
      Object.keys(entity).some((key) => !['id', 'displayName', 'role'].includes(key)) ||
      typeof entity.displayName !== 'string' ||
      entity.role !== 'editor'
    )
      throw new Error('Profilo membro non valido: non importare account o privilegi.');
  } else if (collection === 'deletedQuestions') {
    if (
      Object.keys(entity).some((key) => !['id', 'deletedAt'].includes(key)) ||
      typeof entity.deletedAt !== 'number' ||
      !Number.isFinite(entity.deletedAt)
    )
      throw new Error('Registrazione cancellazione non valida.');
  } else {
    const errors = validateEntity(collection, entity);
    if (errors.length) throw new Error(errors.join('\n'));
    if (
      entity.revision !== undefined &&
      (!Number.isInteger(entity.revision) || entity.revision < 0)
    )
      throw new Error('Revisione non valida.');
    if (
      entity.entryOrigin !== undefined &&
      !['manual', 'import'].includes(String(entity.entryOrigin))
    )
      throw new Error('Origine non valida.');
    if (
      entity.manualFields !== undefined &&
      (!Array.isArray(entity.manualFields) ||
        !entity.manualFields.every(
          (key) =>
            typeof key === 'string' &&
            key !== 'id' &&
            !auditKeys.includes(key) &&
            Object.hasOwn(entity, key)
        ))
    )
      throw new Error('Campi manuali non validi.');
    if (entity.ratings !== undefined) {
      if (
        collection !== 'questions' ||
        !entity.ratings ||
        typeof entity.ratings !== 'object' ||
        Array.isArray(entity.ratings) ||
        Object.entries(entity.ratings).some(
          ([uid, score]) =>
            !idPattern.test(uid) ||
            typeof score !== 'number' ||
            !Number.isInteger(score) ||
            score < 1 ||
            score > 5
        )
      )
        throw new Error('Voti non validi.');
    }
  }
  if (new TextEncoder().encode(JSON.stringify(entity)).length > 900_000)
    throw new Error('Documento troppo grande per il ripristino.');
}

export function parseBackup(text: string): WorkspaceBackup {
  const value = JSON.parse(text);
  if (
    !value ||
    value.format !== 'bacarodeck-workspace' ||
    value.version !== 1 ||
    value.workspaceId !== 'codemotion-milano-2026' ||
    typeof value.exportedAt !== 'string' ||
    !Number.isFinite(Date.parse(value.exportedAt)) ||
    !value.data ||
    typeof value.data !== 'object' ||
    Object.keys(value).some(
      (key) => !['format', 'version', 'workspaceId', 'exportedAt', 'data'].includes(key)
    ) ||
    Object.keys(value.data).some((name) => !backupCollections.includes(name as BackupCollection))
  )
    throw new Error('File backup completo non valido. Usa il pannello dedicato al tipo di export.');
  for (const collection of backupCollections) {
    const entities = value.data[collection];
    if (!Array.isArray(entities)) throw new Error(`Collezione mancante: ${collection}.`);
    const ids = new Set<string>();
    for (const entity of entities) {
      validateBackupEntity(collection, entity);
      if (ids.has(entity.id)) throw new Error(`ID duplicato: ${collection}/${entity.id}.`);
      ids.add(entity.id);
    }
  }
  const deleted = new Set(value.data.deletedQuestions.map((entity: Entity) => entity.id));
  if (value.data.questions.some((entity: Entity) => deleted.has(entity.id)))
    throw new Error(
      'Una domanda risulta sia presente sia eliminata. Riapri il backup dopo l’aggiornamento dei dati.'
    );
  return value;
}

export function planRestore(
  source: WorkspaceBackup,
  destination: WorkspaceBackup
): RestoreChange[] {
  const result: RestoreChange[] = [];
  for (const collection of backupCollections) {
    const existing = new Map(destination.data[collection].map((entity) => [entity.id, entity]));
    for (const data of source.data[collection]) {
      const expected = existing.get(data.id) || null;
      if (!equivalentRestore(data, expected))
        result.push({ collection, id: data.id, data, expected });
      if (collection === 'questions' || collection === 'deletedQuestions') {
        const opposite = collection === 'questions' ? 'deletedQuestions' : 'questions';
        const counterpart = destination.data[opposite].find((entity) => entity.id === data.id);
        if (counterpart)
          result.push({ collection: opposite, id: data.id, data: null, expected: counterpart });
      }
    }
  }
  return result;
}

export function restoreBatches(changes: RestoreChange[]): RestoreChange[][] {
  const groups = new Map<string, RestoreChange[]>();
  for (const change of changes) {
    const key = ['questions', 'deletedQuestions'].includes(change.collection)
      ? `question:${change.id}`
      : `${change.collection}:${change.id}`;
    groups.set(key, [...(groups.get(key) || []), change]);
  }
  const batches: RestoreChange[][] = [];
  let batch: RestoreChange[] = [];
  for (const group of groups.values()) {
    const next = [...batch, ...group];
    if (
      next.length > 100 ||
      new TextEncoder().encode(JSON.stringify({ changes: next })).length > 2_000_000
    ) {
      if (!batch.length) throw new Error('Gruppo di documenti troppo grande.');
      batches.push(batch);
      batch = [];
    }
    batch.push(...group);
    if (new TextEncoder().encode(JSON.stringify({ changes: batch })).length > 2_000_000)
      throw new Error('Gruppo di documenti troppo grande.');
  }
  if (batch.length) batches.push(batch);
  return batches;
}

export function backupPage(records: Entity[], offset: number) {
  const page: Entity[] = [];
  let bytes = 0;
  for (let index = offset; index < records.length; index++) {
    const size = new TextEncoder().encode(JSON.stringify(records[index])).length + 1;
    if (size > 1_900_000) throw new Error('Documento troppo grande per l’esportazione.');
    if (bytes + size > 1_900_000) break;
    page.push(records[index]);
    bytes += size;
  }
  const next = offset + page.length;
  return { records: page, next: next < records.length ? next : null };
}
