import { error, redirect } from '@sveltejs/kit';
import type { Collection } from '$lib/fields';
import type { PageLoad } from './$types';
export const load: PageLoad = ({ params, url }) => {
  if (params.section === 'domande' || params.section === 'ricerca')
    redirect(
      307,
      '/backoffice/speaker/' +
        encodeURIComponent(params.speakerId) +
        (params.section === 'ricerca' ? '/note' : '/intervista') +
        url.search
    );
  const tabs: Record<string, Collection> = {
    info: 'speakers',
    note: 'materials',
    strumenti: 'materials',
    intervista: 'questions',
    talk: 'talks'
  };
  const tab = tabs[params.section];
  if (!tab) error(404, 'Sezione non trovata');
  return { speakerId: params.speakerId, tab, tools: params.section === 'strumenti' };
};
