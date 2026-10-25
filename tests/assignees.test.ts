import { expect, it } from 'vitest';
import { accessConfiguration, accessEntries, assignmentDirectory } from '../src/lib/assignees';
it('defaults to the six requested emails with Michele as permanent administrator', () => {
  const config = accessConfiguration({});
  const entries = accessEntries(config, {});
  expect(entries).toHaveLength(6);
  expect(entries.every((e) => e.enabled)).toBe(true);
  expect(entries.find((e) => e.email === 'scarpa.michele.90@gmail.com')?.permanent).toBe(true);
  expect(
    assignmentDirectory(config, {})
      .map((e) => e.id)
      .sort()
  ).toEqual(['alberto', 'danilo', 'giorgio', 'lorenzo', 'martin', 'michele']);
});
it('uses explicit configuration, including empty configuration, instead of defaults', () => {
  expect(accessEntries(accessConfiguration({ ALLOW_LIST: '', SUPERADMIN_EMAILS: '' }), {})).toEqual(
    []
  );
});
it('includes enabled users before login, omits revoked users and keeps permanent users', () => {
  const config = accessConfiguration({});
  const state = {
    added: ['new@example.test'],
    blocked: ['danxivdan@gmail.com', 'scarpa.michele.90@gmail.com']
  };
  const members = [
    { id: 'old-uid', email: 'danxivdan@gmail.com', displayName: 'Danilo' },
    { id: 'new-uid', email: 'new@example.test', displayName: 'Nuovo' }
  ];
  const directory = assignmentDirectory(config, state, members);
  expect(directory.some((e) => e.id === 'danilo')).toBe(false);
  expect(directory.some((e) => e.id === 'michele')).toBe(true);
  expect(directory.find((e) => e.email === 'new@example.test')).toMatchObject({
    id: 'new@example.test',
    displayName: 'Nuovo',
    uid: 'new-uid'
  });
  expect(assignmentDirectory(config, state).find((e) => e.email === 'new@example.test')?.id).toBe(
    'new@example.test'
  );
  expect(
    accessEntries(config, state)
      .filter((e) => e.enabled)
      .map((e) => e.email)
      .sort()
  ).toEqual(directory.map((e) => e.email).sort());
});
