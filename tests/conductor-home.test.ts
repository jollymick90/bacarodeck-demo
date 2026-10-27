import { expect, it } from 'vitest';
import { groupSpeakers } from '../src/lib/conductor/home';
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
