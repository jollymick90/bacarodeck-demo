import { env } from '$env/dynamic/private';
import { memberPolicy } from '$lib/member-policy';
import { firestoreCache } from './firestore-cache';
import { getAdmin } from './firebase-admin';
export const accessDocument = 'workspaces/codemotion-milano-2026/access/members';
export async function readAccessMembers(fresh = false) {
  const { db } = getAdmin();
  const load = async () => (await db.doc(accessDocument).get()).data() || {};
  return fresh ? load() : firestoreCache(db).read('access-members', 30 * 60, load);
}
export async function getAccessState(email: string, fresh = false) {
  const data = await readAccessMembers(fresh);
  return memberPolicy(
    email,
    env.ALLOW_LIST || '',
    env.SUPERADMIN_EMAILS || '',
    data?.added || [],
    data?.blocked || []
  );
}
