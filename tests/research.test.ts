import { expect, it } from 'vitest';
import { researchEntries } from '../src/lib/research';
import type { Dataset } from '../src/lib/fields';

it('preserves distinct records with identical IDs and original collection routing', () => {
  const data: Dataset = {
    materials: [{ id: 'same', speakerIds: ['s'], bodyMd: 'My notes' }],
    sources: [{ id: 'same', speakerIds: ['s'], notesMd: 'My source' }],
    insights: [{ id: 'same', speakerIds: ['s'], bodyMd: 'My insight' }]
  };
  const before = JSON.stringify(data);
  const result = researchEntries(data, 's');
  expect(result).toHaveLength(3);
  for (const { collection, entity } of result) expect(entity).toBe(data[collection]![0]);
  expect(JSON.stringify(data)).toBe(before);
});

it('includes sources and insights referenced by this speaker without leaking unrelated research', () => {
  const data: Dataset = {
    speakers: [{ id: 's', sourceIds: ['shared'] }],
    materials: [{ id: 'm', speakerIds: ['s'], sourceIds: ['reference'] }],
    insights: [
      { id: 'i', materialIds: ['m'], sourceIds: ['insight-source'] },
      { id: 'other', speakerIds: ['other'] }
    ],
    sources: [
      { id: 'shared', speakerIds: ['s'] },
      { id: 'reference' },
      { id: 'insight-source' },
      { id: 'unrelated' }
    ]
  };
  expect(researchEntries(data, 's').map(({ entity }) => entity.id)).toEqual([
    'm',
    'i',
    'shared',
    'reference',
    'insight-source'
  ]);
  expect(researchEntries(data, 'missing')).toEqual([]);
});
