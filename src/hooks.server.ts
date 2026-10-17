import type { HandleServerError } from '@sveltejs/kit';

export const handleError: HandleServerError = ({ event }) => {
  const reference = crypto.randomUUID();
  // Never log Firebase error payloads, credentials, request bodies or tokens.
  console.error('[server-error]', { reference, route: event.route.id });
  return { message: `Operazione non riuscita. Riprova. Riferimento: ${reference}` };
};
