import { it, expect } from 'vitest';
import {
  parseAllowList,
  isAllowedIdentity,
  isCurrentPasswordGrant
} from '../src/lib/server/access-policy';
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

it('accepts password login only when individually enabled by an administrator', async () => {
  const { getAccessDenial } = await import('../src/lib/server/access-policy');
  const token = {
    email: 'person@example.test',
    email_verified: false,
    bacaroPasswordLogin: true,
    bacaroPasswordEmail: 'person@example.test',
    bacaroPasswordVersion: 'grant-one',
    firebase: { sign_in_provider: 'password' }
  };
  expect(isAllowedIdentity(token, 'person@example.test')).toBe(true);
  expect(getAccessDenial(token, 'person@example.test')).toBeNull();
  expect(
    isAllowedIdentity(
      { ...token, bacaroPasswordLogin: false, email_verified: true },
      'person@example.test'
    )
  ).toBe(false);
  expect(
    getAccessDenial({ ...token, bacaroPasswordLogin: false }, 'person@example.test')?.status
  ).toBe(403);
  expect(isAllowedIdentity(token, 'other@example.test')).toBe(false);
  expect(
    isAllowedIdentity(
      { ...token, firebase: { sign_in_provider: 'anonymous' } },
      'person@example.test'
    )
  ).toBe(false);
});

it('binds password access to the email approved by the admin even if Firebase email changes', async () => {
  const { getAccessDenial } = await import('../src/lib/server/access-policy');
  const changed = {
    email: 'admin@example.test',
    email_verified: true,
    bacaroPasswordLogin: true,
    bacaroPasswordEmail: 'member@example.test',
    bacaroPasswordVersion: 'grant-one',
    firebase: { sign_in_provider: 'password' }
  };
  expect(isAllowedIdentity(changed, 'admin@example.test')).toBe(false);
  expect(getAccessDenial(changed, 'admin@example.test')?.status).toBe(403);
  expect(
    isAllowedIdentity({ ...changed, bacaroPasswordEmail: undefined }, 'admin@example.test')
  ).toBe(false);
});

it('rejects tokens from a previous password or a disabled grant immediately', () => {
  const token = {
    email: 'member@example.test',
    bacaroPasswordLogin: true,
    bacaroPasswordEmail: 'member@example.test',
    bacaroPasswordVersion: 'one',
    firebase: { sign_in_provider: 'password' }
  };
  expect(isCurrentPasswordGrant(token, { email: token.email, customClaims: { ...token } })).toBe(
    true
  );
  expect(
    isCurrentPasswordGrant(token, {
      email: token.email,
      customClaims: { ...token, bacaroPasswordVersion: 'two' }
    })
  ).toBe(false);
  expect(isCurrentPasswordGrant(token, { email: token.email, customClaims: {} })).toBe(false);
  expect(
    isCurrentPasswordGrant(token, { email: 'other@example.test', customClaims: { ...token } })
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
