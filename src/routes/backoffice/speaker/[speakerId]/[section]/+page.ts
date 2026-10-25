import { error, redirect } from '@sveltejs/kit';
import type { Collection } from '$lib/fields';
import type { PageLoad } from './$types';
export const load: PageLoad = ({ params, url }) => {
  if (params.section === 'domande')
    redirect(
      307,
      '/backoffice/speaker/' + encodeURIComponent(params.speakerId) + '/intervista' + url.search
    );
  const tabs: Record<string, Collection> = {
    info: 'speakers',
    ricerca: 'materials',
    intervista: 'questions',
    talk: 'talks'
  };
  const tab = tabs[params.section];
  if (!tab) error(404, 'Sezione non trovata');
  return { speakerId: params.speakerId, tab };
};
