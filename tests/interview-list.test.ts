import { expect, it } from 'vitest';
import { readdirSync } from 'node:fs';
import { isInInterviewList } from '../src/lib/interview-list';
import catalog from '../data/seed/catalog.json';
it('uses the interview folder list rather than the conference directory snapshot', () => {
  const expected = readdirSync('BacaroTech_Schede_Speaker_2026/01_speaker_in_elenco', {
    withFileTypes: true
  })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const actual = catalog.speakers
    .filter(isInInterviewList)
    .map((speaker) => speaker.id)
    .sort();
  expect(actual).toEqual(expected);
  expect(actual).toHaveLength(29);
  expect(catalog.speakers.filter((speaker) => !isInInterviewList(speaker))).toHaveLength(55);
});
it('does not confuse mutable priority or directory presence with interview selection', () => {
  expect(isInInterviewList({ id: 'unknown', priority: true, inDirectorySnapshot: true })).toBe(
    false
  );
  expect(
    isInInterviewList({ id: 'andrey-breslav', priority: false, inDirectorySnapshot: false })
  ).toBe(true);
});

it('explicit choices override the original list in both directions', () => {
  expect(isInInterviewList({ id: 'andrey-breslav', inInterviewList: false })).toBe(false);
  expect(isInInterviewList({ id: 'unknown', inInterviewList: true })).toBe(true);
  expect(isInInterviewList({ id: 'unknown', isKeynote: true })).toBe(false);
});
