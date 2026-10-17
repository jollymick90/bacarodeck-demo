import { parseAllowList } from './server/access-policy';
export function memberPolicy(
  email: string,
  configured: string,
  permanent: string,
  added: string[],
  blocked: string[]
) {
  const normalized = email.trim().toLowerCase();
  const superadmin = parseAllowList(permanent).includes(normalized);
  return {
    superadmin,
    allowed:
      superadmin ||
      (!blocked.includes(normalized) &&
        [...parseAllowList(configured), ...added].includes(normalized))
  };
}
