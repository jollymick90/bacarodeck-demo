import { redirect } from '@sveltejs/kit';
export function load({ url }: { url: URL }) {
  const speaker = url.searchParams.get('speaker');
  if (speaker) redirect(307, '/backoffice/speaker/' + encodeURIComponent(speaker));
}
