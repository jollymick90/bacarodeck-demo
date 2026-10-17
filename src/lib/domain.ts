import Ajv from 'ajv';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import schema from '../../schemas/speaker-research-import.schema.json';
import {
  collections,
  fields,
  auditKeys,
  type Collection,
  type Entity,
  type Dataset,
  type Value
} from './fields';
export type ImportData = Dataset & { schemaVersion: number; targetSpeakerId?: string };
const ajv = new Ajv({ allErrors: true, strict: false });
const validateSchema = ajv.compile(schema);
const idPattern = /^[a-zA-Z0-9_-]{1,128}$/;
export function safeUrl(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return true;
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}
export function validateEntity(collection: Collection, data: Entity): string[] {
  const errors: string[] = [];
  if (collection === 'interviewSlots') {
    if (data.status === 'confirmed' && !data.chosenStart)
      errors.push('Scegli un orario prima di confermare lo slot.');
    if (!['proposed', 'provisional', 'confirmed'].includes(String(data.status)))
      errors.push('Stato slot non valido.');
    if (
      data.chosenStart &&
      (!/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(String(data.chosenStart)) ||
        !Number.isFinite(Date.parse(String(data.chosenStart))))
    )
      errors.push('Orario ISO con fuso richiesto.');
  }
  if (!idPattern.test(data.id))
    errors.push('ID non valido. Usa lettere, numeri, trattini (max 128).');
  const allowed = new Set(['id', ...auditKeys, ...fields[collection].map((f) => f.key)]);
  for (const key of Object.keys(data))
    if (!allowed.has(key))
      errors.push(`Campo non consentito: ${key}. Non inserire contatti privati.`);
  const checkNested = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    for (const [k, v] of Object.entries(value)) {
      if (/^(email|phone|telephone|address|privateAddress)$/i.test(k))
        errors.push(`Contatto privato non consentito: ${k}`);
      if (/url$/i.test(k) && !safeUrl(v))
        errors.push(`URL non valido in ${k}: usa https:// o http://.`);
      checkNested(v);
    }
  };
  checkNested(data);
  for (const field of fields[collection]) {
    const v = data[field.key];
    if (v === undefined || v === null) continue;
    if (field.type === 'array' && (!Array.isArray(v) || !v.every((x) => typeof x === 'string')))
      errors.push(`${field.label}: usa una lista di testi.`);
    if (
      field.type === 'number' &&
      (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 10000)
    )
      errors.push(`${field.label}: numero intero tra 0 e 10000.`);
    if (field.type === 'boolean' && typeof v !== 'boolean')
      errors.push(`${field.label}: valore sì/no richiesto.`);
    if (['text', 'markdown', 'select'].includes(field.type || 'text') && typeof v !== 'string')
      errors.push(`${field.label}: testo richiesto.`);
  }
  if (collection === 'speakers' && !String(data.fullName || '').trim())
    errors.push('Inserisci il nome completo.');
  if (
    collection === 'materials' &&
    new TextEncoder().encode(String(data.bodyMd || '')).length > 200 * 1024
  )
    errors.push(
      'Il Markdown supera 200 KiB UTF-8. Dividilo in più materiali; il testo non è stato troncato.'
    );
  const editorial = Object.fromEntries(
    Object.entries(data).filter(([k]) => !auditKeys.includes(k))
  );
  const entitySchema = (schema.properties as Record<string, unknown>)[collection] as {
    items: object;
  };
  if (
    !ajv.validate(
      {
        ...entitySchema.items,
        required: ['id', ...(collection === 'speakers' ? ['fullName'] : [])]
      },
      editorial
    )
  )
    errors.push(...(ajv.errors || []).map((e) => `${e.instancePath || '/'} ${e.message}`));
  return [...new Set(errors)];
}
export function prepareWrite(
  collection: Collection,
  incoming: Entity,
  existing: Entity | null,
  uid: string,
  now: Value
): Entity {
  const errors = validateEntity(collection, incoming);
  if (errors.length) throw new Error(errors.join('\n'));
  if (existing && incoming.id !== existing.id) throw new Error('ID immutabile.');
  if (existing && (incoming.revision ?? 0) !== (existing.revision ?? 0))
    throw new Error(
      'Conflitto: un altro membro ha modificato questo contenuto. Riapri la scheda e riapplica le tue modifiche.'
    );
  const clean = Object.fromEntries(
    Object.entries(incoming).filter(([k, v]) => v !== undefined && !auditKeys.includes(k))
  );
  return {
    ...clean,
    id: incoming.id,
    createdAt: existing?.createdAt ?? now,
    createdBy: existing?.createdBy ?? uid,
    updatedAt: now,
    updatedBy: uid,
    revision: (existing?.revision ?? 0) + 1
  };
}
export function renderMarkdown(text: string): string {
  return sanitizeHtml(marked.parse(text, { async: false }) as string, {
    allowedTags: sanitizeHtml.defaults.allowedTags,
    allowedAttributes: { a: ['href', 'title', 'rel', 'target'], code: ['class'] },
    allowedSchemes: ['https', 'http'],
    allowProtocolRelative: false,
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer' })
    }
  });
}
export function parseImport(text: string): ImportData {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error('JSON non valido: controlla virgole, virgolette e parentesi.');
  }
  if (!validateSchema(value))
    throw new Error(
      'Schema JSON non valido:\n' +
        (validateSchema.errors || [])
          .map(
            (e) =>
              `${e.instancePath || '/'} ${e.message}${e.params.additionalProperty ? `: ${e.params.additionalProperty}` : ''}`
          )
          .join('\n')
    );
  const result = value as ImportData;
  let count = 0;
  for (const collection of collections) {
    const seen = new Set<string>();
    for (const entity of result[collection] || []) {
      count++;
      if (seen.has(entity.id)) throw new Error(`ID duplicato in ${collection}: ${entity.id}`);
      seen.add(entity.id);
      const errors = validateEntity(collection, entity);
      if (errors.length) throw new Error(`${collection}/${entity.id}: ${errors.join('\n')}`);
    }
  }
  if (count > 400) throw new Error('Massimo 400 documenti per import atomico. Dividi il file.');
  if (result.targetSpeakerId) {
    const sourceIds = new Set(
      collections.flatMap((c) =>
        (result[c] || []).flatMap((e) =>
          typeof e.speakerId === 'string'
            ? [e.speakerId]
            : Array.isArray(e.speakerIds)
              ? e.speakerIds.filter((id): id is string => typeof id === 'string')
              : []
        )
      )
    );
    if (!result.speakers?.length && sourceIds.size > 1)
      throw new Error('Import ambiguo: targetSpeakerId richiede riferimenti a una sola persona.');
  }
  if (result.targetSpeakerId && (result.speakers?.length || 0) > 1)
    throw new Error('targetSpeakerId richiede al massimo uno speaker.');
  return result;
}
export type DiffField = {
  key: string;
  before: Value | undefined;
  after: Value | undefined;
  selected: boolean;
};
export type PreviewRow = {
  collection: Collection;
  id: string;
  existing: Entity | null;
  incoming: Entity;
  fields: DiffField[];
  warnings: string[];
  blocked: boolean;
  selected: boolean;
};
const normalize = (v: unknown) =>
  String(v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
const normalizeUrl = (v: unknown) =>
  String(v || '')
    .replace(/\/$/, '')
    .toLowerCase();
export function previewImport(input: ImportData, current: Dataset): PreviewRow[] {
  const rows: PreviewRow[] = [];
  const from = input.speakers?.[0]?.id;
  const target = input.targetSpeakerId;
  for (const collection of collections)
    for (const original of input[collection] || []) {
      const incoming: Entity = structuredClone(original);
      if (target) {
        if (collection === 'speakers') incoming.id = target;
        if (incoming.speakerId === from || (!from && incoming.speakerId))
          incoming.speakerId = target;
        if (Array.isArray(incoming.speakerIds))
          incoming.speakerIds = incoming.speakerIds.map((id) =>
            !from || id === from ? target : id
          );
        if (collection === 'interviewPlans' && incoming.id === from) incoming.id = target;
      }
      if (collection === 'questions') incoming.status = 'suggested';
      const existing = (current[collection] || []).find((e) => e.id === incoming.id) || null;
      const warnings: string[] = [];
      if (
        collection === 'speakers' &&
        [...(current.speakers || []), ...(input.speakers || [])].some(
          (e) => e.id !== incoming.id && normalize(e.fullName) === normalize(incoming.fullName)
        )
      )
        warnings.push('Nome simile già presente: controlla la persona. Nessuna unione automatica.');
      if (
        collection === 'sources' &&
        incoming.url &&
        [...(current.sources || []), ...(input.sources || [])].some(
          (e) => e.id !== incoming.id && normalizeUrl(e.url) === normalizeUrl(incoming.url)
        )
      )
        warnings.push('URL fonte già presente con un altro ID. Deseleziona per evitare duplicati.');
      const blocked = collection === 'questions' && !!existing && existing.status !== 'suggested';
      if (blocked)
        warnings.push('Domanda esistente protetta. Modificala manualmente dalla scheda.');
      const diffs = Object.keys(incoming)
        .filter(
          (k) =>
            k !== 'id' &&
            !auditKeys.includes(k) &&
            JSON.stringify(incoming[k]) !== JSON.stringify(existing?.[k])
        )
        .map((key) => ({
          key,
          before: existing?.[key],
          after: incoming[key],
          selected: !existing && !blocked
        }));
      rows.push({
        collection,
        id: incoming.id,
        existing,
        incoming,
        fields: diffs,
        warnings,
        blocked,
        selected: !existing && !blocked
      });
    }
  return rows;
}
export type Change = { collection: Collection; data: Entity; expectedRevision: number | null };
export function selectedChanges(rows: PreviewRow[]): Change[] {
  const changes: Change[] = [];
  for (const row of rows) {
    if (row.blocked) continue;
    if (!row.existing) {
      if (row.selected)
        changes.push({ collection: row.collection, data: row.incoming, expectedRevision: null });
      continue;
    }
    const selected = row.fields.filter((f) => f.selected);
    if (!selected.length) continue;
    const data = { ...row.existing };
    for (const f of selected) data[f.key] = f.after;
    if (row.collection === 'questions') data.status = 'suggested';
    changes.push({
      collection: row.collection,
      data,
      expectedRevision: row.existing.revision ?? 0
    });
  }
  return changes;
}
export function provenanceLabel(collection: Collection, entity: Entity): string {
  if (collection === 'questions' || entity.provenance === 'editorial_question')
    return 'Domanda editoriale';
  if (entity.provenance === 'ai_generated') return 'Testo AI · da verificare';
  if (entity.provenance === 'member_interpretation') return 'Interpretazione del membro';
  if (
    entity.provenance === 'reported_fact' ||
    collection === 'talks' ||
    collection === 'sources' ||
    entity.type === 'talk_abstract'
  )
    return 'Contenuto riportato · verificare le fonti';
  if (collection === 'insights') return 'Interpretazione · da verificare';
  return 'Provenienza non classificata · da verificare';
}
