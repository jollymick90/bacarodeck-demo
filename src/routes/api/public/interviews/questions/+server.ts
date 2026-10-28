import { error, json } from '@sveltejs/kit';
import { getAdmin } from '$lib/server/firebase-admin';
import { createMissingQuestions } from '$lib/server/create-missing-questions';
import type { RequestHandler } from './$types';

export const config = { maxDuration: 300 };
const cors = { 'Access-Control-Allow-Origin': '*' };

export const POST: RequestHandler = async ({ request }) => {
  const text = await request.text();
  if (new TextEncoder().encode(text).length > 1024 * 1024)
    error(413, 'Import superiore a 1 MiB. Dividi il file.');
  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch {
    error(400, 'JSON non valido.');
  }
  const { db } = getAdmin();
  return json(await createMissingQuestions(db, input), { headers: cors });
};

export const OPTIONS: RequestHandler = () =>
  new Response(null, {
    status: 204,
    headers: {
      ...cors,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
