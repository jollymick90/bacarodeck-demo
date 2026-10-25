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
