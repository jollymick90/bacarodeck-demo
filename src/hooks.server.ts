import { accessDiagnostic } from '$lib/server/access-diagnostics';
import type { Handle, HandleServerError } from '@sveltejs/kit';

export const handleError: HandleServerError = ({ event, error }) => {
  const reference = crypto.randomUUID();
  // Never log Firebase error payloads, credentials, request bodies or tokens.
  console.error('[server-error]', { reference, route: event.route.id, ...accessDiagnostic(error) });
  return { message: `Operazione non riuscita. Riprova. Riferimento: ${reference}` };
};

export const handle: Handle = async ({ event, resolve }) => {
  const response = await resolve(event);
  if (event.url.pathname.startsWith('/api/'))
    response.headers.set('Cache-Control', 'private, no-store');
  return response;
};
