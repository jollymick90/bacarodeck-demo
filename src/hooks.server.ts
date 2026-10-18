import { errorDiagnostic } from '$lib/server/error-diagnostics';
import { env } from '$env/dynamic/private';
import type { Handle, HandleServerError } from '@sveltejs/kit';

export const handleError: HandleServerError = ({ event, error }) => {
  const reference = crypto.randomUUID();
  const secrets = Object.entries(env)
    .filter(([key]) => /secret|token|password|credential|key|cookie/i.test(key))
    .map(([, value]) => value || '');
  // Include fields inside a service-account JSON, not only its serialized form.
  try {
    const account = JSON.parse(env.FIREBASE_ADMIN_KEY || '{}');
    for (const key of ['private_key', 'private_key_id', 'client_email']) {
      if (typeof account[key] === 'string') secrets.push(account[key]);
    }
  } catch {
    /* Invalid configuration is diagnosed without logging its contents. */
  }
  console.error('[server-error]', {
    reference,
    route: event.route.id,
    ...errorDiagnostic(error, secrets)
  });
  return { message: `Operazione non riuscita. Riprova. Riferimento: ${reference}` };
};

export const handle: Handle = async ({ event, resolve }) => {
  const response = await resolve(event);
  if (event.url.pathname.startsWith('/api/'))
    response.headers.set('Cache-Control', 'private, no-store');
  return response;
};
