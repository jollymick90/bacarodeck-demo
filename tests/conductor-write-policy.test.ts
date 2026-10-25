import { expect, it } from 'vitest';
import { guardConductorWrite, guardConductorDelete } from '../src/lib/conductor/write-policy';
it('prevents generic writes from impersonating interests or silently reassigning', () => {
  expect(() =>
    guardConductorWrite('speakerInterests', { id: 'i', memberUid: 'other' }, null)
  ).toThrow();
  expect(() =>
    guardConductorWrite(
      'interviewPlans',
      { id: 'p', assignedToUid: 'martin' },
      { id: 'p', assignedToUid: 'alberto' }
    )
  ).toThrow();
  expect(() =>
    guardConductorWrite(
      'interviewSlots',
      { id: 's', interviewerId: 'martin' },
      { id: 's', interviewerId: 'alberto' }
    )
  ).toThrow();
  expect(() =>
    guardConductorWrite(
      'interviewPlans',
      { id: 'p', assignedTeamId: 'alberto', notesMd: 'New' },
      { id: 'p', assignedTeamId: 'alberto' }
    )
  ).not.toThrow();
});
it('blocks deleting assigned plans and slots through generic CRUD', () => {
  expect(() =>
    guardConductorDelete('interviewPlans', { id: 'p', assignedTeamId: 'martin' })
  ).toThrow();
  expect(() =>
    guardConductorDelete('interviewSlots', { id: 's', interviewerId: 'martin' })
  ).toThrow();
  expect(() =>
    guardConductorDelete('interviewPlans', { id: 'p', status: 'researching' })
  ).not.toThrow();
});
