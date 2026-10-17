import type { Dataset, Entity } from './fields';
import type { ImportData } from './domain';

export function prepareTranslationImport(source: Dataset, current: Dataset) {
  const data: ImportData = { schemaVersion: 1, speakers: [], talks: [] };
  let changedSources = 0;
  let reviewedSkipped = 0;
  for (const collection of ['speakers', 'talks'] as const) {
    const prefix = collection === 'speakers' ? 'biography' : 'abstract';
    for (const original of source[collection] || []) {
      const existing = current[collection]?.find((item) => item.id === original.id);
      if (!existing || !original[prefix + 'Md']) continue;
      if (existing.translationReviewed === true) {
        reviewedSkipped++;
        continue;
      }
      if (existing[prefix + 'Md'] !== original[prefix + 'Md']) {
        changedSources++;
        continue;
      }
      const patch: Entity = { id: existing.id };
      let added = false;
      for (const suffix of ['It', 'En']) {
        const key = prefix + suffix;
        if (!String(existing[key] || '').trim() && original[key]) {
          patch[key] = original[key];
          added = true;
        }
      }
      if (!added) continue;
      patch.translationReviewed = false;
      if (collection === 'speakers') patch.fullName = existing.fullName;
      data[collection]!.push(patch);
    }
  }
  return { data, changedSources, reviewedSkipped };
}
