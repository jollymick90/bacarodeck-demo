import { expect, it } from 'vitest';
import {
  nextInterview,
  nextInterviewChanges,
  validateNextInterview
} from '../src/lib/conductor/next-interview';
import { prepareWrite, parseImport } from '../src/lib/domain';
import type { Dataset } from '../src/lib/fields';

const data: Dataset = {
  speakers: [
    { id: 'a', fullName: 'Ada' },
    { id: 'b', fullName: 'Berto', inInterviewList: false }
  ],
  interviewPlans: [
    {
      id: 'plan-a',
      speakerId: 'a',
      revision: 3,
      nextInterview: true,
      assignedToUid: 'colleague',
      interviewStatus: 'confirmed',
      notesMd: 'Keep me'
    },
    { id: 'plan-b', speakerId: 'b', revision: 2, assignedToUid: 'me', cameraId: 'lorenzo' }
  ]
};

it('switches the next interview atomically without changing assignments or preparation', () => {
  const before = JSON.stringify(data);
  const changes = nextInterviewChanges(data, 'b', true);
  expect(changes).toEqual([
    {
      collection: 'interviewPlans',
      expectedRevision: 3,
      data: { ...data.interviewPlans![0], nextInterview: false }
    },
    {
      collection: 'interviewPlans',
      expectedRevision: 2,
      data: { ...data.interviewPlans![1], nextInterview: true }
    }
  ]);
  const updated = { ...data, interviewPlans: changes.map((change) => change.data) };
  expect(nextInterview(updated)?.id).toBe('b');
  expect(() => validateNextInterview(updated)).not.toThrow();
  expect(JSON.stringify(data)).toBe(before);
});

it('clears just the selected speaker and creates a plan when needed', () => {
  expect(nextInterviewChanges(data, 'a', false)).toEqual([
    {
      collection: 'interviewPlans',
      expectedRevision: 3,
      data: { ...data.interviewPlans![0], nextInterview: false }
    }
  ]);
  expect(nextInterviewChanges(data, 'b', false)).toEqual([]);
  expect(nextInterviewChanges({ speakers: [{ id: 'new' }] }, 'new', true)).toEqual([
    {
      collection: 'interviewPlans',
      expectedRevision: null,
      data: { id: 'new', speakerId: 'new', nextInterview: true }
    }
  ]);
});

it('rejects multiple next speakers, missing speakers and completed interviews', () => {
  expect(() =>
    validateNextInterview({
      ...data,
      interviewPlans: data.interviewPlans!.map((p) => ({ ...p, nextInterview: true }))
    })
  ).toThrow('Conflitto');
  expect(() => nextInterviewChanges(data, 'missing', true)).toThrow();
  const completed = {
    ...data,
    interviewPlans: [{ id: 'b', speakerId: 'b', interviewStatus: 'completed' }]
  };
  expect(() => nextInterviewChanges(completed, 'b', true)).toThrow();
  expect(
    nextInterview({
      ...data,
      interviewPlans: [
        { id: 'a', speakerId: 'a', nextInterview: true, interviewStatus: 'completed' }
      ]
    })
  ).toBeUndefined();
  expect(
    nextInterview({
      interviewPlans: [{ id: 'missing', speakerId: 'missing', nextInterview: true }]
    })
  ).toBeUndefined();
});

it('clears the next marker when completing an interview and does not restore it on undo', () => {
  const existing = data.interviewPlans![0];
  const completed = prepareWrite(
    'interviewPlans',
    { ...existing, interviewStatus: 'completed' },
    existing,
    'me',
    1000
  );
  expect(completed).toMatchObject({
    nextInterview: false,
    interviewStatus: 'completed',
    assignedToUid: 'colleague',
    notesMd: 'Keep me',
    revision: 4
  });
  const undone = prepareWrite(
    'interviewPlans',
    { ...completed, interviewStatus: 'unconfirmed' },
    completed,
    'me',
    2000
  );
  expect(undone.nextInterview).toBe(false);
  expect(
    parseImport(
      JSON.stringify({
        schemaVersion: 1,
        interviewPlans: [{ id: 'p', speakerId: 'a', nextInterview: true }]
      })
    ).interviewPlans![0].nextInterview
  ).toBe(true);
});
