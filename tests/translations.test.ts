import { expect, it } from 'vitest';
import { prepareTranslationImport } from '../src/lib/translations';
const source = {
  speakers: [
    {
      id: 'one',
      fullName: 'One',
      biographyMd: 'Original',
      biographyIt: 'Originale',
      biographyEn: 'Original',
      translationReviewed: false
    }
  ]
};
it('fills only missing translations and preserves reviewed/manual fields', () => {
  const result = prepareTranslationImport(source, {
    speakers: [
      {
        id: 'one',
        fullName: 'Current name',
        biographyMd: 'Original',
        biographyIt: 'Team text',
        translationReviewed: false,
        revision: 3
      }
    ]
  });
  expect(result.data.speakers).toEqual([
    { id: 'one', fullName: 'Current name', biographyEn: 'Original', translationReviewed: false }
  ]);
});
it('skips changed source text and never creates missing documents', () => {
  expect(prepareTranslationImport(source, {}).data.speakers).toEqual([]);
  const result = prepareTranslationImport(source, {
    speakers: [{ id: 'one', fullName: 'One', biographyMd: 'Changed' }]
  });
  expect(result.data.speakers).toEqual([]);
  expect(result.changedSources).toBe(1);
});
it('repeated import produces no changes once translations are filled', () => {
  expect(prepareTranslationImport(source, source).data.speakers).toEqual([]);
});

it('preserves documents already marked reviewed', () => {
  const result = prepareTranslationImport(source, {
    speakers: [{ id: 'one', fullName: 'One', biographyMd: 'Original', translationReviewed: true }]
  });
  expect(result.data.speakers).toEqual([]);
  expect(result.reviewedSkipped).toBe(1);
});

import catalog from '../data/seed/catalog.json';
import original from '../BacaroTech_Schede_Speaker_2026/import/00_tutti_gli_speaker.json';
import seed from '../data/seed/seed_five.json';
import originalSeed from '../seed_five.json';
import { parseImport } from '../src/lib/domain';
it('provides both languages for all 81 biographies and 27 abstracts without changing originals', () => {
  let biographies = 0,
    abstracts = 0;
  for (const [data, baseline] of [
    [catalog, original],
    [seed, originalSeed]
  ]) {
    for (const [collection, prefix] of [
      ['speakers', 'biography'],
      ['talks', 'abstract']
    ] as const) {
      for (const item of data[collection] as Record<string, unknown>[]) {
        const previous = (baseline[collection] as Record<string, unknown>[]).find(
          (entry) => entry.id === item.id
        )!;
        expect(item[prefix + 'Md']).toBe(previous[prefix + 'Md']);
        if (!item[prefix + 'Md']) continue;
        expect(typeof item[prefix + 'It']).toBe('string');
        expect(String(item[prefix + 'It']).trim().length).toBeGreaterThan(0);
        expect(typeof item[prefix + 'En']).toBe('string');
        expect(String(item[prefix + 'En']).trim().length).toBeGreaterThan(0);
        expect(item.translationReviewed).toBe(false);
        if (data === catalog) {
          if (collection === 'speakers') biographies++;
          else abstracts++;
        }
      }
    }
    expect(() => parseImport(JSON.stringify(data))).not.toThrow();
  }
  expect(biographies).toBe(81);
  expect(abstracts).toBe(27);
});

import translationPackage from '../data/seed/translations.json';
it('validates the standalone translation package', () => {
  const parsed = parseImport(JSON.stringify(translationPackage));
  expect(parsed.speakers).toHaveLength(81);
  expect(parsed.talks).toHaveLength(27);
});
