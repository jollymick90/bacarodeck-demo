import { expect, it } from 'vitest';
import { prepareBriefUpdate, resolveBrief } from '../src/lib/conductor/brief';
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

it('preserves the selected order of additional optional questions', () => {
  const brief = {
    id: 'x',
    speakerId: 'g',
    mainQuestionIds: ['a'],
    optionalQuestionIds: ['c', 'b']
  };
  expect(prepareBriefUpdate(brief, data).optionalQuestionIds).toEqual(['c', 'b']);
});

it('rejects unavailable, duplicate and main questions in the optional selection', () => {
  for (const ids of [['gone'], ['b', 'b'], ['a']]) {
    expect(() =>
      prepareBriefUpdate(
        {
          id: 'x',
          speakerId: 'g',
          mainQuestionIds: ['a'],
          optionalQuestionIds: ids
        },
        data
      )
    ).toThrow();
  }
});

it('puts selected shared icebreakers before speaker questions without changing the closing question', () => {
  const brief = {
    id: 'x', speakerId: 'g',
    openingQuestionIds: ['icebreaker-talk', 'icebreaker-takeaway'],
    mainQuestionIds: ['a', 'b'], optionalQuestionIds: ['c']
  };
  expect(() => prepareBriefUpdate(brief, data)).not.toThrow();
  const result = resolveBrief({ ...data, conductorBriefs: [brief] }, 'g');
  expect(result.interviewQuestions.map(q => q.id)).toEqual([
    'icebreaker-talk', 'icebreaker-takeaway', 'a', 'c', 'b'
  ]);
  expect(result.interviewQuestions[0]).toMatchObject({
    textIt: 'Puoi raccontarci qualcosa del tuo talk?',
    textEn: 'Can you tell us a little about your talk?'
  });
  expect(result.interviewQuestions[1]).toMatchObject({
    textIt: 'Cosa vorresti che gli sviluppatori si portassero a casa dal tuo intervento?',
    textEn: 'What do you want developers to take away from your talk?'
  });
  expect(result.mainQuestions.map(q => q.id)).toEqual(['a', 'b']);
});

it('shares the same opening texts across speakers and supports an interview with only icebreakers', () => {
  const dataset = {
    speakers: [{ id: 'g' }, { id: 'other' }],
    conductorBriefs: ['g', 'other'].map(speakerId => ({
      id: speakerId, speakerId, mainQuestionIds: [],
      openingQuestionIds: ['icebreaker-idea', 'icebreaker-inspiration']
    }))
  };
  const opening = resolveBrief(dataset, 'g').interviewQuestions;
  expect(opening.map(q => [q.textIt, q.textEn])).toEqual([
    ["Qual è l'idea principale del tuo intervento?", "What's the main idea behind your talk?"],
    ['Cosa ti ha spinto a scegliere questo argomento?', 'What inspired you to talk about this topic?']
  ]);
  expect(resolveBrief(dataset, 'other').interviewQuestions).toEqual(opening);
  expect(resolveBrief(data, 'g').interviewQuestions.map(q => q.id)).toEqual(['a', 'b', 'c']);
});

it('rejects unknown and repeated icebreakers without requiring speaker-specific question documents', () => {
  for (const ids of [['a'], ['unknown'], ['icebreaker-talk', 'icebreaker-talk']]) {
    expect(() => prepareBriefUpdate({ id: 'x', speakerId: 'g', openingQuestionIds: ids }, data)).toThrow();
  }
  expect(() => prepareBriefUpdate({ id: 'x', speakerId: 'g', openingQuestionIds: [] }, data)).not.toThrow();
});
