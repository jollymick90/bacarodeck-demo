import { parseAllowList } from './server/access-policy';
import { memberPolicy } from './member-policy';
import type { Entity } from './fields';

const defaults = [
  { id: 'alberto', displayName: 'Alberto', email: 'alberto.pesce98@gmail.com' },
  { id: 'danilo', displayName: 'Danilo', email: 'danxivdan@gmail.com' },
  { id: 'giorgio', displayName: 'Giorgio', email: 'giorgiobasile631@gmail.com' },
  { id: 'martin', displayName: 'Martin', email: 'martintodorovdev@gmail.com' },
  { id: 'michele', displayName: 'Michele', email: 'scarpa.michele.90@gmail.com' },
  { id: 'lorenzo', displayName: 'Lorenzo', email: 'this.lorenzo.99@gmail.com' }
];
export type AccessConfig = { configured: string; permanent: string };
export type AccessMembers = { added?: string[]; blocked?: string[] };
export type Assignee = Entity & { email: string; displayName: string; uid: string };
export function accessConfiguration(env: {
  ALLOW_LIST?: string;
  SUPERADMIN_EMAILS?: string;
}): AccessConfig {
  return {
    configured: env.ALLOW_LIST ?? defaults.map((m) => m.email).join(','),
    permanent: env.SUPERADMIN_EMAILS ?? 'scarpa.michele.90@gmail.com'
  };
}
export function accessEntries(config: AccessConfig, state: AccessMembers) {
  const added = parseAllowList((state.added || []).join(','));
  const blocked = parseAllowList((state.blocked || []).join(','));
  const emails = parseAllowList(
    [config.configured, config.permanent, ...added, ...blocked].join(',')
  );
  return emails.map((email) => {
    const policy = memberPolicy(email, config.configured, config.permanent, added, blocked);
    return { email, enabled: policy.allowed, permanent: policy.superadmin };
  });
}
export function assignmentDirectory(
  config: AccessConfig,
  state: AccessMembers,
  members: Entity[] = []
): Assignee[] {
  return accessEntries(config, state)
    .filter((entry) => entry.enabled)
    .map(({ email }) => {
      const known = defaults.find((member) => member.email === email);
      const member = members.find(
        (member) =>
          String(member.email || '')
            .trim()
            .toLowerCase() === email
      );
      return {
        id: known?.id || email,
        email,
        displayName: known?.displayName || String(member?.displayName || email.split('@')[0]),
        uid: member?.id || ''
      };
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'it'));
}
