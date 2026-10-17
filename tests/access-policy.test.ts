import { it, expect } from 'vitest';
import { parseAllowList, isAllowedIdentity } from '../src/lib/server/access-policy';
it('normalizes exact email entries and fails closed for empty configuration', () => {
  expect(parseAllowList(' Alice@Example.test,\n bob@example.test,alice@example.test ')).toEqual([
    'alice@example.test',
    'bob@example.test'
  ]);
  expect(
    isAllowedIdentity(
      {
        email: 'alice@example.test',
        email_verified: true,
        firebase: { sign_in_provider: 'google.com' }
      },
      ''
    )
  ).toBe(false);
});
it('requires verified Google identity and exact email membership', () => {
  const token = {
    email: 'Alice@Example.test',
    email_verified: true,
    firebase: { sign_in_provider: 'google.com' }
  };
  expect(isAllowedIdentity(token, 'alice@example.test')).toBe(true);
  expect(isAllowedIdentity({ ...token, email_verified: false }, 'alice@example.test')).toBe(false);
  expect(
    isAllowedIdentity(
      { ...token, firebase: { sign_in_provider: 'password' } },
      'alice@example.test'
    )
  ).toBe(false);
  expect(
    isAllowedIdentity({ ...token, email: 'alice@example.test.attacker.test' }, 'alice@example.test')
  ).toBe(false);
});

it('distinguishes missing configuration from a different Google account without exposing the list', async () => {
  const { getAccessDenial } = await import('../src/lib/server/access-policy');
  const identity = {
    email: 'signed-in@example.test',
    email_verified: true,
    firebase: { sign_in_provider: 'google.com' }
  };
  expect(getAccessDenial(identity, '')).toMatchObject({ status: 503 });
  expect(getAccessDenial(identity, '"signed-in@example.test"')).toMatchObject({ status: 503 });
  const denial = getAccessDenial(identity, 'allowed@example.test');
  expect(denial?.error).toContain('signed-in@example.test');
  expect(denial?.error).not.toContain('allowed@example.test');
  expect(getAccessDenial(identity, 'signed-in@example.test')).toBeNull();
  expect(
    getAccessDenial({ ...identity, email_verified: false }, 'signed-in@example.test')?.error
  ).toContain('verificata');
});
