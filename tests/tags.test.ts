import { expect, it } from 'vitest';
import { suggestSpeakerTags } from '../src/lib/tags';
it('uses related talk content and preserves custom tags without case duplicates', () => {
  const data = {
    speakers: [{ id: 'a', fullName: 'A', tags: ['My tag', 'ai'] }],
    talks: [
      {
        id: 't',
        speakerIds: ['a'],
        title: 'LLM agents on Kubernetes',
        abstractMd: 'Deploy to the cloud with CI/CD.'
      }
    ]
  };
  const result = suggestSpeakerTags(data);
  expect(result[0].additions).toEqual(['Cloud', 'DevOps']);
  expect(result[0].speaker.tags).toEqual(['My tag', 'ai']);
});
it('does not classify unrelated talks, short substrings or empty profiles', () => {
  const data = {
    speakers: [{ id: 'a', fullName: 'Cloud Person', organization: 'AI Inc' }],
    talks: [
      { id: 't', speakerIds: ['b'], title: 'AI security' },
      { id: 'x', speakerIds: ['a'], title: 'Fair trails and details' }
    ]
  };
  expect(suggestSpeakerTags(data)).toEqual([]);
});
it('supports Italian text and repeats without proposing existing tags', () => {
  const speaker = { id: 'a', fullName: 'A', tags: [] };
  const talk = {
    id: 't',
    speakerIds: ['a'],
    abstractIt: 'Intelligenza artificiale e sicurezza dei dati con SQL'
  };
  const first = suggestSpeakerTags({ speakers: [speaker], talks: [talk] });
  expect(first[0].additions).toEqual(['AI', 'Sicurezza', 'Dati']);
  expect(
    suggestSpeakerTags({ speakers: [{ ...speaker, tags: first[0].additions }], talks: [talk] })
  ).toEqual([]);
});
