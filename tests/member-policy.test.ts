import { expect, it } from 'vitest';
import { memberPolicy } from '../src/lib/member-policy';
it('blocks configured members but cannot remove permanent administrators', () => {
  expect(memberPolicy('a@example.test', 'a@example.test', '', [], ['a@example.test']).allowed).toBe(
    false
  );
  expect(memberPolicy('a@example.test', '', 'a@example.test', [], ['a@example.test'])).toEqual({
    allowed: true,
    superadmin: true
  });
  expect(memberPolicy('b@example.test', '', '', ['b@example.test'], []).allowed).toBe(true);
  expect(memberPolicy('c@example.test', '', '', [], []).allowed).toBe(false);
});
