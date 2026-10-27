import { collections, type Dataset, type Entity } from '../fields';
export const offlineCollections = [...collections, 'members'] as const;
export type OfflineCollection = (typeof offlineCollections)[number];
export const offlineLifetime = 30 * 24 * 60 * 60 * 1000;
export type OfflineIdentity = { uid: string; displayName: string | null; email: string | null };
export type OfflineSnapshot = {
  version: 1;
  scope: string;
  identity: OfflineIdentity;
  verifiedAt: number;
  downloadedAt: number;
  data: Dataset;
  members: Entity[];
};
export function validSnapshot(value: unknown): value is OfflineSnapshot {
  const s = value as OfflineSnapshot | null;
  return Boolean(
    s &&
    s.version === 1 &&
    typeof s.scope === 'string' &&
    typeof s.identity?.uid === 'string' &&
    s.identity.uid &&
    Number.isFinite(s.verifiedAt) &&
    Number.isFinite(s.downloadedAt) &&
    Array.isArray(s.members) &&
    collections.every((c) => Array.isArray(s.data?.[c]))
  );
}
export function offlineAccess(
  s: OfflineSnapshot | null,
  scope: string,
  uid: string | null,
  now = Date.now()
) {
  return (
    validSnapshot(s) &&
    s.scope === scope &&
    (!uid || uid === s.identity.uid) &&
    now >= s.verifiedAt &&
    now < s.verifiedAt + offlineLifetime
  );
}
