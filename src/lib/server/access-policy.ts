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
  if (token.firebase?.sign_in_provider !== 'google.com')
    return { status: 403, error: 'Questa sessione non usa Google. Esci e accedi con Google.' };
  if (token.email_verified !== true || !token.email)
    return {
      status: 403,
      error: 'L’account Google non ha un’email verificata. Esci e accedi di nuovo con Google.'
    };
  if (!isAllowedIdentity(token, raw))
    return {
      status: 403,
      error: `L’account Google ${token.email} non è incluso in ALLOW_LIST di questo deployment. Esci per scegliere un altro account oppure aggiorna la lista e crea un nuovo deploy.`
    };
  return null;
}
