<script lang="ts">
  import { page } from '$app/state';
  import InterviewMode from '$lib/components/conductor/InterviewMode.svelte';
</script>

{#key `${page.params.speakerId}:${page.url.search}`}
  <InterviewMode
    speakerId={page.params.speakerId || ''}
    talkId={page.url.searchParams.get('talk') || ''}
    language={page.url.searchParams.get('lang') === 'en' ? 'en' : 'it'}
    questionId={page.url.searchParams.get('question') || ''}
    back={page.url.searchParams.get('back') || 'speaker'}
  />
{/key}
