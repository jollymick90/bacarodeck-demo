import { expect, it } from 'vitest';
import { assignmentChanges } from '../src/lib/conductor/assignment';
import { accessConfiguration, assignmentDirectory } from '../src/lib/assignees';
const assignees = assignmentDirectory(accessConfiguration({}), {});
const data = {
  speakers: [{ id: 'g', fullName: 'Giulia' }],
  interviewPlans: [{ id: 'g', speakerId: 'g', assignedTeamId: 'alberto', revision: 2 }],
  interviewSlots: [{ id: 's', primarySpeaker: 'Giulia', interviewerId: 'alberto', revision: 3 }]
};
it('requires informed confirmation and rejects a changed owner', () => {
  expect(() => assignmentChanges(data, 'g', 'martin', 'alberto', false, assignees)).toThrow();
  expect(() => assignmentChanges(data, 'g', 'martin', 'michele', true, assignees)).toThrow();
  const changes = assignmentChanges(data, 'g', 'martin', 'alberto', true, assignees);
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
    true,
    assignees
  );
  expect(changes).toHaveLength(1);
});
it('materializes an agenda slot when assigning before the slot has ever been saved', () => {
  const changes = assignmentChanges(
    { speakers: [{ id: 'alexio-cassani', fullName: 'Alexio Cassani' }] },
    'alexio-cassani',
    'martin',
    '',
    false,
    assignees
  );
  const slots = changes.filter((c) => c.collection === 'interviewSlots');
  expect(slots.length).toBeGreaterThan(0);
  expect(slots[0].expectedRevision).toBeNull();
  expect(slots[0].data.interviewerId).toBe('martin');
});

it('accepts any enabled account and rejects a revoked target', () => {
  expect(
    assignmentChanges(data, 'g', 'danilo', 'alberto', true, assignees)[0].data.assignedToName
  ).toBe('Danilo');
  expect(() =>
    assignmentChanges(
      data,
      'g',
      'martin',
      'alberto',
      true,
      assignees.filter((m) => m.id !== 'martin')
    )
  ).toThrow('non valido');
});
