import { offlineAccess, type OfflineSnapshot } from './snapshot';
export function offlineRecovery(
  snapshot: OfflineSnapshot | null,
  scope: string,
  uid: string | null,
  status: number,
  now = Date.now()
): 'read' | 'clear' | 'blocked' {
  if (status === 403 || (uid && snapshot && uid !== snapshot.identity.uid)) return 'clear';
  return offlineAccess(snapshot, scope, uid, now) ? 'read' : 'blocked';
}
