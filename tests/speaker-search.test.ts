import { expect, it } from 'vitest';
import { searchSpeakers } from '../src/lib/speaker-search';
it('searches name, organization and tags ignoring case, whitespace and accents', () => {
  const people = [
    { id: 'a', fullName: 'José Rossi', organization: 'Acme', tags: ['AI'] },
    { id: 'b', fullName: 'Anna' }
  ];
  expect(searchSpeakers(people, ' JOSE ')).toEqual([people[0]]);
  expect(searchSpeakers(people, 'acme')).toEqual([people[0]]);
  expect(searchSpeakers(people, 'AI')).toEqual([people[0]]);
  expect(searchSpeakers(people, 'missing')).toEqual([]);
  expect(searchSpeakers(people, '')).toHaveLength(2);
});
