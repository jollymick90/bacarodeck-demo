import { expect, it } from 'vitest';
import { groupSpeakers, firstSpeakerTalk, sortSpeakersByTalk } from '../src/lib/conductor/home';
it('keeps saved assigned speakers first and does not repeat them', () => {
  const result = groupSpeakers(
    [{ id: 'g' }, { id: 'l', tags: ['AI'] }, { id: 'm', tags: ['Cloud'] }],
    [{ id: '1', speakerId: 'g', memberUid: 'me' }],
    [{ id: 'p', speakerId: 'g', assignedTeamId: 'alberto' }],
    'me',
    'AI'
  );
  expect(result.saved.map((s) => s.id)).toEqual(['g']);
  expect(result.unassigned.map((s) => s.id)).toEqual(['l']);
});

it('orders speakers by the earliest scheduled talk across days, then name, with unknown times last', () => {
  const speakers = [
    { id: 'late', fullName: 'Late' },
    { id: 'early', fullName: 'Ada' },
    { id: 'missing', fullName: 'Berto' },
    { id: 'first', fullName: 'First' },
    { id: 'partial', fullName: 'Anna' },
    { id: 'invalid', fullName: 'Carlo' },
    { id: 'tie', fullName: 'Zoe' }
  ];
  const talks = [
    { id: 'late-talk', speakerIds: ['late'], day: '2026-10-29', time: '09:00' },
    { id: 'early-later', speakerIds: ['early'], day: '2026-10-28', time: '16:00' },
    { id: 'early-first', speakerIds: ['early'], day: '2026-10-28', time: '11:20' },
    { id: 'first-talk', speakerIds: ['first'], day: '2026-10-28', time: '09:00' },
    { id: 'partial-talk', speakerIds: ['partial'], day: '2026-10-28' },
    { id: 'invalid-talk', speakerIds: ['invalid'], day: '2026-02-30', time: '11:00' },
    { id: 'tie-talk', speakerIds: ['tie'], day: '2026-10-28', time: '11:20' }
  ];
  const before = JSON.stringify({ speakers, talks });
  expect(sortSpeakersByTalk(speakers, { speakers, talks }).map((s) => s.id)).toEqual([
    'first',
    'early',
    'tie',
    'late',
    'partial',
    'missing',
    'invalid'
  ]);
  expect(firstSpeakerTalk('early', { speakers, talks })?.id).toBe('early-first');
  expect(JSON.stringify({ speakers, talks })).toBe(before);
});

it('uses the same default schedule as talk details while respecting deliberately cleared times', () => {
  const speaker = { id: 'reviewer', fullName: 'Abiodun Olowode' };
  const talk = {
    id: 'review',
    speakerIds: ['reviewer'],
    title: 'We Review Code. Why Won’t We Review Each Other?'
  };
  const data = { speakers: [speaker], talks: [talk] };
  expect(firstSpeakerTalk('reviewer', data)).toMatchObject({ day: '2026-10-28', time: '11:20' });
  expect(
    firstSpeakerTalk('reviewer', { ...data, talks: [{ ...talk, agendaSessionId: '' }] })
  ).not.toHaveProperty('time');
});

it('combines personal interests and assignments without requiring an interest or duplicating speakers', () => {
  const result = groupSpeakers(
    [
      { id: 'saved' },
      { id: 'assigned', inInterviewList: false },
      { id: 'both' },
      { id: 'other' },
      { id: 'free' }
    ],
    [
      { id: 'i1', speakerId: 'saved', memberUid: 'me' },
      { id: 'i2', speakerId: 'both', memberUid: 'me' }
    ],
    [
      { id: 'p1', speakerId: 'assigned', assignedTeamId: 'michele', assignedToUid: '' },
      { id: 'p2', speakerId: 'both', assignedToUid: 'me' },
      { id: 'p3', speakerId: 'other', assignedTeamId: 'lorenzo', assignedToUid: 'someone' }
    ],
    'me',
    '',
    [
      { id: 'michele', uid: 'me' },
      { id: 'lorenzo', uid: 'someone' }
    ]
  );
  expect(result.personal?.map((s) => s.id)).toEqual(['saved', 'assigned', 'both']);
  expect(result.assigned?.map((s) => s.id)).toEqual(['assigned', 'both']);
  expect(result.saved.map((s) => s.id)).toEqual(['saved', 'both']);
  expect(result.unassigned.map((s) => s.id)).toEqual(['free']);
});

it('does not attribute assignments from empty UIDs, names or a stale UID after reassignment', () => {
  const plans = [
    { id: 'p1', speakerId: 'empty', assignedToUid: '' },
    { id: 'p2', speakerId: 'name', assignedToName: 'Same name' },
    { id: 'p3', speakerId: 'stale', assignedTeamId: 'other', assignedToUid: 'me' }
  ];
  const speakers = [{ id: 'empty' }, { id: 'name' }, { id: 'stale' }];
  const directory = [
    { id: 'other', uid: 'someone' },
    { id: 'mine', uid: 'me' }
  ];
  expect(groupSpeakers(speakers, [], plans, 'me', '', directory).assigned).toEqual([]);
  expect(groupSpeakers(speakers, [], plans, '', '', directory).assigned).toEqual([]);
});

it('hides completed interviews by default and restores them on request without losing personal links', () => {
  const speakers = [{ id: 'saved' }, { id: 'assigned' }, { id: 'active' }, { id: 'other' }];
  const interests = [{ id: 'i', speakerId: 'saved', memberUid: 'me' }];
  const plans = [
    { id: 'p1', speakerId: 'saved', interviewStatus: 'completed' },
    { id: 'p2', speakerId: 'assigned', assignedToUid: 'me', interviewStatus: 'completed' },
    {
      id: 'p3',
      speakerId: 'active',
      assignedToUid: 'me',
      status: 'done',
      interviewStatus: 'confirmed'
    },
    { id: 'p4', speakerId: 'other', interviewStatus: 'completed' }
  ];
  const active = groupSpeakers(speakers, interests, plans, 'me');
  expect(active.personal.map((s) => s.id)).toEqual(['active']);
  expect(active.saved).toEqual([]);
  expect(active.assigned.map((s) => s.id)).toEqual(['active']);
  expect(active.all.map((s) => s.id)).toEqual(['active']);
  expect(active.completed?.map((s) => s.id)).toEqual(['saved', 'assigned']);
  const all = groupSpeakers(speakers, interests, plans, 'me', '', [], true);
  expect(all.personal.map((s) => s.id)).toEqual(['saved', 'assigned', 'active']);
  expect(all.saved.map((s) => s.id)).toEqual(['saved']);
  expect(all.assigned.map((s) => s.id)).toEqual(['assigned', 'active']);
  expect(all.unassigned).toEqual([]);
});
