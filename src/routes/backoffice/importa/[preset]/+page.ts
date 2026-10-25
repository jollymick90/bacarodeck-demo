import { error } from '@sveltejs/kit';
export function load({ params, url }: { params: { preset?: string }; url: URL }) {
  if (params.preset && !['catalogo', 'traduzioni', 'esempio', 'domande'].includes(params.preset))
    error(404, 'Importazione non trovata');
  return { preset: params.preset || '', speakerId: url.searchParams.get('speaker') || '' };
}
