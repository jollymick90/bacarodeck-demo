<script lang="ts">
  import { goto, preloadCode } from '$app/navigation';
  import { onMount } from 'svelte';
  let {
    speakerId,
    talkId = '',
    language = 'it',
    questionId = '',
    back = 'speaker',
    disabled = false
  }: {
    speakerId: string;
    talkId?: string;
    language?: 'it' | 'en';
    questionId?: string;
    back?: 'speaker' | 'scaletta' | 'gestione';
    disabled?: boolean;
  } = $props();
  let starting = $state(false);
  onMount(() => {
    void preloadCode(`/speaker/${encodeURIComponent(speakerId)}/intervista`).catch(() => {});
  });
  async function start() {
    if (starting || disabled) return;
    starting = true;
    try {
      // Fullscreen must be requested synchronously from the user's click, before routing.
      try {
        await document.documentElement.requestFullscreen?.();
      } catch {
        /* viewport fallback */
      }
      const params = new URLSearchParams({ lang: language, back });
      if (talkId) params.set('talk', talkId);
      if (questionId) params.set('question', questionId);
      await goto(`/speaker/${encodeURIComponent(speakerId)}/intervista?${params}`);
    } finally {
      starting = false;
    }
  }
</script>

<button class="primary" disabled={disabled || starting} onclick={start}>Avvia intervista</button>
