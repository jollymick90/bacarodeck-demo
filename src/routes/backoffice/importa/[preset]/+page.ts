import { error, redirect } from '@sveltejs/kit';
export function load({ params, url }: { params: { preset?: string }; url: URL }) {
  if (
    params.preset &&
    !['catalogo', 'traduzioni', 'esempio', 'domande', 'orari'].includes(params.preset)
  )
    error(404, 'Importazione non trovata');
  if (params.preset === 'domande') {
    const speakerId = url.searchParams.get('speaker');
    if (!speakerId) error(400, 'Scegli uno speaker per preparare le domande.');
    redirect(
      307,
      '/backoffice/speaker/' + encodeURIComponent(speakerId) + '/strumenti?prompt=domande'
    );
  }
  return { preset: params.preset || '', speakerId: url.searchParams.get('speaker') || '' };
}
