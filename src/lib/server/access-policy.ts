type Identity = {
  email?: string;
  email_verified?: boolean;
  bacaroPasswordLogin?: boolean;
  bacaroPasswordEmail?: string;
  bacaroPasswordVersion?: string;
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
    ((token.email_verified === true && token.firebase?.sign_in_provider === 'google.com') ||
      (token.firebase?.sign_in_provider === 'password' &&
        token.bacaroPasswordLogin === true &&
        token.bacaroPasswordEmail === token.email?.toLowerCase() &&
        typeof token.bacaroPasswordVersion === 'string' &&
        !!token.bacaroPasswordVersion)) &&
    typeof token.email === 'string' &&
    parseAllowList(raw).includes(token.email.toLowerCase())
  );
}
export function getAccessDenial(
  token: Identity,
  raw: string
): { status: 403 | 503; error: string } | null {
  if (!parseAllowList(raw).length)
    return {
      status: 503,
      error:
        'ALLOW_LIST è assente o vuota nel server di questo deployment. Su Vercel usa esattamente ALLOW_LIST (maiuscolo), seleziona l’ambiente corretto e crea un nuovo deploy.'
    };
  if (/^["'\[]/.test(raw.trim()) || /^ALLOW_LIST\s*=/.test(raw.trim()))
    return {
      status: 503,
      error:
        'Formato ALLOW_LIST non valido: nel Value di Vercel inserisci solo email separate da virgola, senza virgolette, parentesi o ALLOW_LIST=.'
    };
  const provider = token.firebase?.sign_in_provider;
  if (
    provider === 'password' &&
    (token.bacaroPasswordLogin !== true ||
      token.bacaroPasswordEmail !== token.email?.toLowerCase() ||
      typeof token.bacaroPasswordVersion !== 'string' ||
      !token.bacaroPasswordVersion)
  )
    return {
      status: 403,
      error: 'Accesso con password non abilitato per questo account. Chiedi al superadmin.'
    };
  if (provider !== 'google.com' && provider !== 'password')
    return {
      status: 403,
      error: 'Accedi con Google oppure con email e password abilitate dal superadmin.'
    };
  if ((provider === 'google.com' && token.email_verified !== true) || !token.email)
    return {
      status: 403,
      error: 'L’account Google non ha un’email verificata. Esci e accedi di nuovo con Google.'
    };
  if (!isAllowedIdentity(token, raw))
    return {
      status: 403,
      error: `L’account ${token.email} non è incluso in ALLOW_LIST di questo deployment. Esci per scegliere un altro account oppure aggiorna la lista e crea un nuovo deploy.`
    };
  return null;
}

export function isCurrentPasswordGrant(
  token: Identity,
  user: { email?: string; customClaims?: Record<string, unknown> }
): boolean {
  return (
    token.firebase?.sign_in_provider === 'password' &&
    isAllowedIdentity(token, user.email || '') &&
    user.customClaims?.bacaroPasswordLogin === true &&
    user.customClaims.bacaroPasswordEmail === token.bacaroPasswordEmail &&
    user.customClaims.bacaroPasswordVersion === token.bacaroPasswordVersion
  );
}
