import { env } from '$env/dynamic/private';
import { accessConfiguration } from '$lib/assignees';
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
  const config = accessConfiguration(env);
  return memberPolicy(
    email,
    config.configured,
    config.permanent,
    data?.added || [],
    data?.blocked || []
  );
}
