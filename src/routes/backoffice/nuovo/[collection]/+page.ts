import { error } from '@sveltejs/kit';
import { collections, type Collection } from '$lib/fields';
export function load({ params, url }: { params: { collection: string; id?: string }; url: URL }) {
  if (!collections.includes(params.collection as Collection))
    error(404, 'Tipo di contenuto non trovato');
  return {
    collection: params.collection as Collection,
    id: params.id,
    speakerId: url.searchParams.get('speaker') || ''
  };
}
