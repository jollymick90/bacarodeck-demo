import { describe, expect, it } from 'vitest';
import { resolveBrief, validateBrief, briefId } from '../src/lib/conductor/brief';
import type { Dataset } from '../src/lib/fields';
const data: Dataset = {
  speakers: [{ id: 'g', fullName: 'Giulia' }],
  talks: [
    { id: 'a', speakerIds: ['g'], title: 'Uno', abstractIt: 'Contesto.' },
    { id: 'b', speakerIds: ['g'], title: 'Due' }
  ],
  questions: [
    { id: 'q1', speakerId: 'g', textIt: 'Prima?', order: 1 },
    { id: 'q2', speakerId: 'g', textIt: 'Seconda?', order: 2 },
    { id: 'bad', speakerId: 'other' },
    { id: 'reject', speakerId: 'g', status: 'rejected' }
  ]
};
describe('shared conductor brief', () => {
  it('uses bounded stable IDs even for maximum length source IDs', () => {
    const id = briefId('s'.repeat(128), 't'.repeat(128));
    expect(id.length).toBeLessThanOrEqual(128);
    expect(id).not.toBe(briefId('s'.repeat(128), 't'.repeat(127) + 'x'));
  });
  it('offers legacy questions without pretending an editorial choice', () => {
    const result = resolveBrief(data, 'g', 'a');
    expect(result.mainQuestions.map((q) => q.id)).toEqual(['q1', 'q2']);
    expect(result.selectionOrigin).toBe('legacy_proposal');
    expect(result.summaryOrigin).toBe('abstract_excerpt');
  });
  it('rejects duplicates, unavailable and another speaker questions', () => {
    for (const ids of [['q1', 'q1'], ['missing'], ['reject'], ['bad']]) {
      expect(() =>
        validateBrief({ id: 'x', speakerId: 'g', talkId: 'a', mainQuestionIds: ids }, data)
      ).toThrow();
    }
    expect(() =>
      validateBrief({ id: 'x', speakerId: 'g', talkId: 'b', mainQuestionIds: [] }, data)
    ).not.toThrow();
  });
  it('accepts more than three main questions and preserves their editorial order', () => {
    const dataset: Dataset = {
      ...data,
      questions: [1, 2, 3, 4, 5].map((n) => ({ id: `q${n}`, speakerId: 'g', order: n }))
    };
    const brief = {
      id: 'extended',
      speakerId: 'g',
      talkId: 'a',
      mainQuestionIds: ['q4', 'q1', 'q3', 'q2'],
      optionalQuestionIds: ['q5']
    };
    expect(() => validateBrief(brief, dataset)).not.toThrow();
    const resolved = resolveBrief({ ...dataset, conductorBriefs: [brief] }, 'g', 'a');
    expect(resolved.mainQuestions.map((q) => q.id)).toEqual(brief.mainQuestionIds);
    expect(resolved.interviewQuestions.map((q) => q.id)).toEqual(['q4', 'q1', 'q3', 'q5', 'q2']);
  });
  it('offers all available legacy questions without truncating the interview', () => {
    const dataset: Dataset = {
      ...data,
      questions: [4, 2, 1, 3].map((n) => ({ id: `q${n}`, speakerId: 'g', order: n }))
    };
    expect(resolveBrief(dataset, 'g', 'a').mainQuestions.map((q) => q.id)).toEqual([
      'q1',
      'q2',
      'q3',
      'q4'
    ]);
  });
  it('does not borrow editorial choices from another talk', () => {
    const dataset = {
      ...data,
      conductorBriefs: [{ id: 'b1', speakerId: 'g', talkId: 'a', mainQuestionIds: ['q2'] }]
    };
    expect(resolveBrief(dataset, 'g', 'a').mainQuestions.map((q) => q.id)).toEqual(['q2']);
    expect(resolveBrief(dataset, 'g', 'b').selectionOrigin).toBe('legacy_proposal');
  });
});

it('resolves optional questions in editorial order without adding unselected questions', () => {
  const dataset: Dataset = {
    ...data,
    conductorBriefs: [
      {
        id: 'b',
        speakerId: 'g',
        talkId: 'a',
        mainQuestionIds: ['q1'],
        optionalQuestionIds: ['q2', 'bad', 'reject', 'missing']
      }
    ]
  };
  expect(resolveBrief(dataset, 'g', 'a').optionalQuestions.map((q) => q.id)).toEqual(['q2']);
  expect(resolveBrief(data, 'g', 'a').optionalQuestions).toEqual([]);
});

it('places optional questions before the last main question and preserves the main selection', () => {
  const dataset: Dataset = {
    speakers: [{ id: 'g' }],
    questions: [1, 2, 3, 4, 5].map((n) => ({ id: `q${n}`, speakerId: 'g', order: n })),
    conductorBriefs: [
      {
        id: 'b',
        speakerId: 'g',
        mainQuestionIds: ['q1', 'q2', 'q3'],
        optionalQuestionIds: ['q5', 'q4']
      }
    ]
  };
  const brief = resolveBrief(dataset, 'g');
  expect(brief.mainQuestions.map((q) => q.id)).toEqual(['q1', 'q2', 'q3']);
  expect(brief.interviewQuestions.map((q) => q.id)).toEqual(['q1', 'q2', 'q5', 'q4', 'q3']);
  expect(
    resolveBrief(
      { ...dataset, conductorBriefs: [{ id: 'b', speakerId: 'g', mainQuestionIds: ['q1', 'q3'] }] },
      'g'
    ).interviewQuestions.map((q) => q.id)
  ).toEqual(['q1', 'q3']);
});

it('keeps the only main question last when optional questions are selected', () => {
  const dataset: Dataset = {
    ...data,
    conductorBriefs: [
      { id: 'b', speakerId: 'g', talkId: 'a', mainQuestionIds: ['q1'], optionalQuestionIds: ['q2'] }
    ]
  };
  expect(resolveBrief(dataset, 'g', 'a').interviewQuestions.map((q) => q.id)).toEqual(['q2', 'q1']);
});
