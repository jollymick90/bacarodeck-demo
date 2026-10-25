import { expect, it } from 'vitest';
import { researchPrompt, questionsPrompt, audioPrompt } from '../src/lib/research-prompts';
import type { Dataset } from '../src/lib/fields';

const speaker = { id: 's', fullName: 'Test Speaker', updatedBy: 'private-uid' };
const data: Dataset = {
  talks: [
    { id: 't', speakerIds: ['s'], title: 'My talk' },
    { id: 'other', title: 'Unrelated talk' }
  ],
  interviewPlans: [{ id: 's', speakerId: 's', interviewLanguage: 'english_possible' }],
  questions: [
    { id: 'q', speakerId: 's', textIt: 'Existing question' },
    { id: 'other', speakerId: 'other', textIt: 'Unrelated question' }
  ]
};
it('research prompt includes relevant context, bilingual structure and evidence constraints', () => {
  const prompt = researchPrompt(speaker, data);
  expect(prompt).toContain('My talk');
  expect(prompt).toContain('Forse in inglese');
  expect(prompt).toContain('Punti chiave IT / EN');
  expect(prompt).toContain('Non inventare');
  expect(prompt).not.toContain('Unrelated talk');
  expect(prompt).not.toContain('private-uid');
});
it('question prompt includes only selected research and existing speaker questions', () => {
  const prompt = questionsPrompt(speaker, data, [
    {
      collection: 'materials',
      entity: {
        id: 'm',
        bodyMd: 'Selected content',
        updatedBy: 'private-uid',
        provenance: 'ai_generated'
      }
    }
  ]);
  expect(prompt).toContain('[R1] materials/m');
  expect(prompt).toContain('Selected content');
  expect(prompt).toContain('ai_generated');
  expect(prompt).toContain('Existing question');
  expect(prompt).toContain('Question EN');
  expect(prompt).not.toContain('Unrelated question');
  expect(prompt).not.toContain('private-uid');
});

it.each(['it', 'en'] as const)(
  'audio prompt targets only the current speaker in %s',
  (language) => {
    const prompt = audioPrompt(speaker, language);
    expect(prompt).toContain('Test Speaker');
    expect(prompt).not.toContain('private-uid');
    expect(prompt).not.toMatch(/\[NOME|\[NAME/);
    expect(prompt).toContain(
      language === 'it' ? 'Lingua dell’audio: Italiano' : 'Audio language: English'
    );
  }
);
