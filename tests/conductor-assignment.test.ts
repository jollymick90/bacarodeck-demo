import { expect, it } from 'vitest';
import { assignmentChanges } from '../src/lib/conductor/assignment';
const data = {
  speakers: [{ id: 'g', fullName: 'Giulia' }],
  interviewPlans: [{ id: 'g', speakerId: 'g', assignedTeamId: 'alberto', revision: 2 }],
  interviewSlots: [{ id: 's', primarySpeaker: 'Giulia', interviewerId: 'alberto', revision: 3 }]
};
it('requires informed confirmation and rejects a changed owner', () => {
  expect(() => assignmentChanges(data, 'g', 'martin', 'alberto', false)).toThrow();
  expect(() => assignmentChanges(data, 'g', 'martin', 'michele', true)).toThrow();
  const changes = assignmentChanges(data, 'g', 'martin', 'alberto', true);
  expect(changes[0].data.assignedTeamId).toBe('martin');
  expect(changes[1].data.interviewerId).toBe('martin');
  expect(changes[1].data.primarySpeakerId).toBe('g');
});
it('does not associate ambiguous legacy names with a slot', () => {
  const changes = assignmentChanges(
    { ...data, speakers: [...data.speakers, { id: 'g2', fullName: 'Giulia' }] },
    'g',
    'martin',
    'alberto',
    true
  );
  expect(changes).toHaveLength(1);
});
it('materializes an agenda slot when assigning before the slot has ever been saved', () => {
  const changes = assignmentChanges(
    { speakers: [{ id: 'alexio-cassani', fullName: 'Alexio Cassani' }] },
    'alexio-cassani',
    'martin',
    '',
    false
  );
  const slots = changes.filter((c) => c.collection === 'interviewSlots');
  expect(slots.length).toBeGreaterThan(0);
  expect(slots[0].expectedRevision).toBeNull();
  expect(slots[0].data.interviewerId).toBe('martin');
});
