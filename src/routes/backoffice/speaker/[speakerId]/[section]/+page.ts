import { error } from '@sveltejs/kit';
import type { Collection } from '$lib/fields';
export function load({ params }: { params: { speakerId: string; section?: string } }) {
  const tabs: Record<string, Collection> = {
    ricerca: 'materials',
    domande: 'questions',
    intervista: 'interviewPlans',
    talk: 'talks'
  };
  const tab = params.section ? tabs[params.section] : 'materials';
  if (!tab) error(404, 'Sezione non trovata');
  return { speakerId: params.speakerId, tab };
}
