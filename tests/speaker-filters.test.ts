import { expect, it } from 'vitest';
import type { Entity } from '../src/lib/fields';
import { filterSpeakers, readSpeakerFilters } from '../src/lib/speaker-filters';

const assignees = [
  { id: 'mine', uid: 'me', displayName: 'Michele' },
  { id: 'other', uid: 'someone', displayName: 'Alberto' }
];

it('filters interview completion independently from preparation and supports legacy links', () => {
  const speakers = [{ id: 'completed' }, { id: 'prepared' }, { id: 'free' }];
  const plans = [
    { id: 'p1', speakerId: 'completed', interviewStatus: 'completed' },
    { id: 'p2', speakerId: 'prepared', status: 'done', interviewStatus: 'confirmed' }
  ];
  const pending = readSpeakerFilters(new URLSearchParams(), 'pending');
  expect(filterSpeakers(speakers, plans, 'me', assignees, pending).map((s) => s.id)).toEqual([
    'prepared',
    'free'
  ]);
  const completed = readSpeakerFilters(new URLSearchParams('intervista=completed'));
  expect(filterSpeakers(speakers, plans, 'me', assignees, completed).map((s) => s.id)).toEqual([
    'completed'
  ]);
  expect(readSpeakerFilters(new URLSearchParams('fatte=1'), 'pending').interview).toBe('all');
  expect(readSpeakerFilters(new URLSearchParams('fatte=1&intervista=completed')).interview).toBe(
    'completed'
  );
});

it('resolves self and others using canonical ownership before legacy UID and unique name', () => {
  const plans: Entity[] = [
    { id: 'p1', speakerId: 'canonical-self', assignedTeamId: 'mine', assignedToUid: 'someone' },
    { id: 'p2', speakerId: 'canonical-other', assignedTeamId: 'other', assignedToUid: 'me' },
    { id: 'p3', speakerId: 'uid-self', assignedToUid: 'me' },
    { id: 'p4', speakerId: 'uid-other', assignedToUid: 'someone' },
    { id: 'p5', speakerId: 'name-self', assignedToName: ' michele ' },
    { id: 'p6', speakerId: 'name-other', assignedToName: 'Alberto' },
    { id: 'p7', speakerId: 'unknown-name', assignedToName: 'Unknown' },
    { id: 'p8', speakerId: 'unassigned' }
  ];
  const speakers = plans.map((p) => ({ id: String(p.speakerId) }));
  expect(
    filterSpeakers(speakers, plans, 'me', assignees, { interview: 'all', assignment: 'self' }).map(
      (s) => s.id
    )
  ).toEqual(['canonical-self', 'uid-self', 'name-self']);
  expect(
    filterSpeakers(speakers, plans, 'me', assignees, {
      interview: 'all',
      assignment: 'others'
    }).map((s) => s.id)
  ).toEqual(['canonical-other', 'uid-other', 'name-other']);
  expect(
    filterSpeakers(speakers, plans, 'me', assignees, {
      interview: 'all',
      assignment: 'unassigned'
    }).map((s) => s.id)
  ).toEqual(['unassigned']);
  expect(
    filterSpeakers(speakers, plans, '', assignees, { interview: 'all', assignment: 'others' })
  ).toEqual([]);
  expect(
    filterSpeakers(
      [{ id: 'name-self' }],
      plans,
      'me',
      [...assignees, { id: 'duplicate', uid: 'someone', displayName: 'Michele' }],
      { interview: 'all', assignment: 'others' }
    )
  ).toEqual([]);
});

it('combines completion and assignment filters without mutating workspace records', () => {
  const speakers = [
    { id: 'done-other' },
    { id: 'pending-other' },
    { id: 'done-self' },
    { id: 'done-free' }
  ];
  const plans = [
    { id: 'p1', speakerId: 'done-other', assignedTeamId: 'other', interviewStatus: 'completed' },
    { id: 'p2', speakerId: 'pending-other', assignedTeamId: 'other', status: 'done' },
    { id: 'p3', speakerId: 'done-self', assignedTeamId: 'mine', interviewStatus: 'completed' },
    { id: 'p4', speakerId: 'done-free', interviewStatus: 'completed' }
  ];
  const before = JSON.stringify({ speakers, plans, assignees });
  const filters = readSpeakerFilters(
    new URLSearchParams('intervista=completed&assegnazione=others&tag=AI')
  );
  expect(filterSpeakers(speakers, plans, 'me', assignees, filters).map((s) => s.id)).toEqual([
    'done-other'
  ]);
  expect(JSON.stringify({ speakers, plans, assignees })).toBe(before);
});
