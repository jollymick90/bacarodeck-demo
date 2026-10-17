import { env } from '$env/dynamic/private';
import { memberPolicy } from '$lib/member-policy';
import { getAdmin } from './firebase-admin';
export const accessDocument = 'workspaces/codemotion-milano-2026/access/members';
export async function getAccessState(email: string) {
  const { db } = getAdmin();
  const snapshot = await db.doc(accessDocument).get();
  const data = snapshot.data();
  return memberPolicy(
    email,
    env.ALLOW_LIST || '',
    env.SUPERADMIN_EMAILS || '',
    data?.added || [],
    data?.blocked || []
  );
}
