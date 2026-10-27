import { expect, it } from 'vitest';
import { collectionPage, collectionVersion } from '../src/lib/server/offline-package';

it('bounds pages by count and encoded bytes, preserving all records', () => {
  const entities = Array.from({ length: 120 }, (_, i) => ({
    id: String(i),
    bodyMd: 'é'.repeat(30000)
  }));
  let offset: number | null = 0;
  const result = [];
  while (offset !== null) {
    const page = collectionPage(entities, offset);
    expect(page.entities.length).toBeLessThanOrEqual(50);
    expect(Buffer.byteLength(JSON.stringify(page.entities))).toBeLessThan(1_100_000);
    result.push(...page.entities);
    offset = page.next;
  }
  expect(result).toEqual(entities);
});

it('detects changes including deletions and rejects invalid offsets', () => {
  expect(collectionVersion([{ id: 'x', title: 'old' }])).not.toBe(
    collectionVersion([{ id: 'x', title: 'new' }])
  );
  expect(collectionVersion([{ id: 'x' }])).not.toBe(collectionVersion([]));
  expect(() => collectionPage([], -1)).toThrow();
  expect(() => collectionPage([], NaN)).toThrow();
});
