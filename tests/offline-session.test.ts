import { expect, it } from 'vitest';
import { offlineRecovery } from '../src/lib/offline/session';
import { collections } from '../src/lib/fields';
import type { OfflineSnapshot } from '../src/lib/offline/snapshot';
const now = Date.now();
const snapshot: OfflineSnapshot = {
  version: 1,
  scope: 's',
  identity: { uid: 'u', displayName: 'Member', email: null },
  verifiedAt: now,
  downloadedAt: now,
  data: Object.fromEntries(collections.map((c) => [c, []])),
  members: []
};
it('keeps authorized local reading for network errors, 401 and 5xx without renewing', () => {
  for (const status of [0, 401, 500, 503])
    expect(offlineRecovery(snapshot, 's', 'u', status, now + 1000)).toBe('read');
  expect(snapshot.verifiedAt).toBe(now);
});
it('revocation, expiry and different accounts never expose the cached data', () => {
  expect(offlineRecovery(snapshot, 's', 'u', 403, now)).toBe('clear');
  expect(offlineRecovery(snapshot, 's', 'other', 0, now)).toBe('clear');
  expect(offlineRecovery(snapshot, 's', null, 0, now + 30 * 86400000)).toBe('blocked');
});
