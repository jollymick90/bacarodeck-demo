import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ url }) => {
  const speakerId = url.searchParams.get('speaker');
  if (speakerId) {
    const params = new URLSearchParams(url.searchParams);
    params.delete('speaker');
    const query = params.toString();
    redirect(307, `/speaker/${encodeURIComponent(speakerId)}${query ? `?${query}` : ''}`);
  }
};
