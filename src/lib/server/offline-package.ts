import { createHash } from 'node:crypto';
import type { Entity } from '../fields';
export function collectionVersion(entities: Entity[]) {
  return createHash('sha256').update(JSON.stringify(entities)).digest('hex');
}
export function collectionPage(entities: Entity[], offset: number) {
  if (!Number.isInteger(offset) || offset < 0 || offset > entities.length)
    throw new Error('Offset non valido.');
  const page: Entity[] = [];
  let bytes = 2;
  for (const entity of entities.slice(offset, offset + 50)) {
    const size = Buffer.byteLength(JSON.stringify(entity)) + 1;
    if (page.length && bytes + size > 1_000_000) break;
    if (size > 2_000_000) throw new Error('Documento troppo grande per il download offline.');
    bytes += size;
    page.push(entity);
  }
  const next = offset + page.length;
  return { entities: page, next: next < entities.length ? next : null };
}
