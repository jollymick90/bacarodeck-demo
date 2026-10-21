import type { Collection, Dataset, Entity } from './fields';

export type ResearchEntry = { collection: Collection; entity: Entity };

// Presentation only: never merge records or rewrite their original identities.
export function researchEntries(data: Dataset, speakerId: string): ResearchEntry[] {
  const linked = (entity: Entity) =>
    entity.speakerId === speakerId || ((entity.speakerIds as string[]) || []).includes(speakerId);
  const materials = (data.materials || []).filter(linked);
  const materialIds = new Set(materials.map((entity) => entity.id));
  const insights = (data.insights || []).filter(
    (entity) =>
      linked(entity) || ((entity.materialIds as string[]) || []).some((id) => materialIds.has(id))
  );
  const speaker = data.speakers?.find((entity) => entity.id === speakerId);
  const sourceIds = new Set([
    ...((speaker?.sourceIds as string[]) || []),
    ...[...materials, ...insights].flatMap((entity) => (entity.sourceIds as string[]) || [])
  ]);
  const sources = (data.sources || []).filter(
    (entity) => linked(entity) || sourceIds.has(entity.id)
  );
  return [
    ...materials.map((entity) => ({ collection: 'materials' as const, entity })),
    ...insights.map((entity) => ({ collection: 'insights' as const, entity })),
    ...sources.map((entity) => ({ collection: 'sources' as const, entity }))
  ];
}
