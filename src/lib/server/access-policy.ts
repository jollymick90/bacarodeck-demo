type Identity = {
  email?: string;
  email_verified?: boolean;
  firebase?: { sign_in_provider?: string };
};
export function parseAllowList(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(/[,;\n]/)
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean)
    )
  ].sort();
}
export function isAllowedIdentity(token: Identity, raw: string): boolean {
  return (
    token.email_verified === true &&
    token.firebase?.sign_in_provider === 'google.com' &&
    typeof token.email === 'string' &&
    parseAllowList(raw).includes(token.email.toLowerCase())
  );
}
