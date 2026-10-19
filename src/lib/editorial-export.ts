import {
  auditKeys,
  collections,
  type Collection,
  type Dataset,
  type Entity,
  type Value
} from './fields';
import type { ImportData } from './domain';

export type ExportRow = {
  collection: Collection;
  entity: Entity;
  patch: boolean;
  uncertain: boolean;
  fields: { key: string; value: Value; selected: boolean }[];
};
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const contentKeys = (entity: Entity) =>
  Object.keys(entity).filter(
    (key) => key !== 'id' && !auditKeys.includes(key) && entity[key] !== undefined
  );
const empty = (value: unknown) =>
  value === null || value === '' || (Array.isArray(value) && !value.length);

export function trackEditorialFields(
  incoming: Entity,
  existing: Entity | null,
  origin: 'manual' | 'import'
) {
  const manual = new Set((existing?.manualFields as string[] | undefined) || []);
  for (const key of contentKeys(incoming)) {
    if (same(incoming[key], existing?.[key])) continue;
    if (origin === 'manual') manual.add(key);
    else manual.delete(key);
  }
  return {
    ...(existing?.entryOrigin
      ? { entryOrigin: existing.entryOrigin }
      : !existing
        ? { entryOrigin: origin }
        : {}),
    manualFields: [...manual].sort()
  };
}

/** Legacy differences are suggestions, never proof of manual authorship. */
export function exportCandidates(current: Dataset, baselines: Dataset[]): ExportRow[] {
  const rows: ExportRow[] = [];
  for (const collection of collections) {
    for (const entity of current[collection] || []) {
      const known = baselines.flatMap((base) =>
        (base[collection] || []).filter((item) => item.id === entity.id)
      );
      const manual = new Set(
        (entity.manualFields as string[] | undefined) ||
          (entity.entryOrigin === 'manual' ? contentKeys(entity) : [])
      );
      const fields = contentKeys(entity)
        .filter((key) => {
          if (manual.has(key)) return true;
          if (entity.entryOrigin === 'manual') return false;
          if (entity.entryOrigin === 'import') return false;
          if (!known.length) return true;
          const variants = known.filter((item) => item[key] !== undefined);
          return variants.length
            ? !variants.some((item) => same(item[key], entity[key]))
            : !empty(entity[key]);
        })
        .map((key) => ({
          key,
          value: entity[key] as Value,
          selected: manual.has(key)
        }));
      if (!fields.length) continue;
      rows.push({
        collection,
        entity,
        patch:
          entity.entryOrigin !== 'manual' && (entity.entryOrigin === 'import' || known.length > 0),
        uncertain: !entity.entryOrigin,
        fields
      });
    }
  }
  return rows;
}

export function buildEditorialExport(
  rows: ExportRow[],
  personalRatings: NonNullable<ImportData['personalRatings']> = []
): ImportData {
  const result: ImportData = {
    schemaVersion: 1,
    exportKind: 'editorial-work',
    requiredDocuments: []
  };
  const dependencies = new Map<string, { collection: Collection; id: string }>();
  const addDependency = (collection: Collection, id: string) =>
    dependencies.set(`${collection}/${id}`, { collection, id });
  const created = new Set<string>();
  for (const row of rows) {
    const selected = row.fields.filter((field) => field.selected);
    if (!selected.length) continue;
    const entity: Entity = { id: row.entity.id };
    for (const field of selected) entity[field.key] = field.value;
    if (row.collection === 'speakers') entity.fullName = row.entity.fullName;
    if (row.collection === 'interviewSlots') {
      entity.status = row.entity.status;
      if (row.entity.status === 'confirmed') entity.chosenStart = row.entity.chosenStart;
    }
    if (!row.patch) {
      for (const key of ['speakerId', 'speakerIds', 'sourceIds', 'materialIds']) {
        if (row.entity[key] !== undefined) entity[key] = row.entity[key];
      }
    }
    (result[row.collection] ||= []).push(entity);
    if (row.patch) addDependency(row.collection, row.entity.id);
    else created.add(`${row.collection}/${row.entity.id}`);
    // Links require the original catalog or separately selected manual documents.
    for (const [field, collection] of [
      ['speakerIds', 'speakers'],
      ['sourceIds', 'sources'],
      ['materialIds', 'materials']
    ] as const) {
      for (const id of (entity[field] as string[] | undefined) || []) addDependency(collection, id);
    }
    if (typeof entity.speakerId === 'string') addDependency('speakers', entity.speakerId);
  }
  if (personalRatings.length) {
    result.personalRatings = personalRatings;
  }
  result.requiredDocuments = [...dependencies.values()].filter(
    (item) => !created.has(`${item.collection}/${item.id}`)
  );
  return result;
}
