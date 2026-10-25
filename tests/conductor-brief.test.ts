import { expect, it } from 'vitest';
import { prepareBriefUpdate } from '../src/lib/conductor/brief';
const data = {
  speakers: [{ id: 'g' }],
  questions: [
    { id: 'a', speakerId: 'g', textIt: 'IT', textEn: 'EN' },
    { id: 'b', speakerId: 'g' },
    { id: 'c', speakerId: 'g' }
  ]
};
it('replaces and reorders references without changing question text', () => {
  const result = prepareBriefUpdate({ id: 'x', speakerId: 'g', mainQuestionIds: ['c', 'a'] }, data);
  expect(result.mainQuestionIds).toEqual(['c', 'a']);
  expect(data.questions[0].textEn).toBe('EN');
});
it('rejects a question removed before save', () => {
  expect(() =>
    prepareBriefUpdate({ id: 'x', speakerId: 'g', mainQuestionIds: ['gone'] }, data)
  ).toThrow();
});
