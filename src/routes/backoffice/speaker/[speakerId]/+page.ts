import type { PageLoad } from './$types';
export const load: PageLoad = ({ params }) => ({
  speakerId: params.speakerId,
  tab: 'speakers' as const
});
