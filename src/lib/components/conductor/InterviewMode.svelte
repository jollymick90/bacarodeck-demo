<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { goto } from '$app/navigation';
  import { getWorkspace } from '$lib/workspace.svelte';
  import { resolveBrief } from '$lib/conductor/brief';
  import Markdown from '../Markdown.svelte';
  let {
    speakerId,
    talkId = '',
    language = 'it',
    questionId = '',
    back = 'speaker'
  }: {
    speakerId: string;
    talkId?: string;
    language?: 'it' | 'en';
    questionId?: string;
    back?: string;
  } = $props();
  const workspace = getWorkspace();
  // Freeze the prepared cards for this interview, even if the team edits the shared data.
  const cards = untrack(() => {
    const data = workspace.data;
    const talk =
      data.talks?.find(
        (t) => t.id === talkId && ((t.speakerIds as string[]) || []).includes(speakerId)
      ) || data.talks?.find((t) => ((t.speakerIds as string[]) || []).includes(speakerId));
    return resolveBrief(data, speakerId, talk?.id || '', language).mainQuestions.map((q) => ({
      id: q.id,
      text: String(
        q[language === 'it' ? 'textIt' : 'textEn'] || q.textIt || q.textEn || 'Domanda senza testo.'
      )
    }));
  });
  const returnHref = untrack(() => {
    const params = new URLSearchParams({ lang: language });
    if (talkId) params.set('talk', talkId);
    if (back === 'scaletta' && questionId) params.set('question', questionId);
    const base =
      back === 'gestione'
        ? `/backoffice/speaker/${encodeURIComponent(speakerId)}/intervista`
        : `/speaker/${encodeURIComponent(speakerId)}${back === 'scaletta' ? '/scaletta' : ''}`;
    return base + '?' + params;
  });
  let index = $state(
    untrack(() =>
      Math.max(
        0,
        cards.findIndex((q) => q.id === questionId)
      )
    )
  );
  let leaving = $state(false);
  async function leave() {
    if (leaving) return;
    leaving = true;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch {
      /* Already exited by browser. */
    }
    await goto(returnHref);
  }
  function next() {
    if (index < cards.length - 1) index++;
  }
  onMount(() => {
    let wasFullscreen = Boolean(document.fullscreenElement);
    const changed = () => {
      if (wasFullscreen && !document.fullscreenElement) void leave();
      wasFullscreen = Boolean(document.fullscreenElement);
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        void leave();
      }
      if (event.key === 'ArrowRight' || event.key === 'PageDown') {
        event.preventDefault();
        next();
      }
    };
    document.addEventListener('fullscreenchange', changed);
    window.addEventListener('keydown', keyboard);
    return () => {
      document.removeEventListener('fullscreenchange', changed);
      window.removeEventListener('keydown', keyboard);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    };
  });
</script>

<svelte:head><title>Modalità intervista · BacaroTech</title></svelte:head>
<section class="interview-mode" aria-label="Modalità intervista">
  <div class="question" aria-live="polite" aria-atomic="true">
    <div class="question-text">
      <Markdown text={cards[index]?.text || 'Nessuna domanda nella scaletta.'} />
    </div>
  </div>
  <div class="controls">
    <button class="exit" onclick={leave} disabled={leaving}>Esci</button>
    <button class="next" onclick={next} disabled={leaving || index >= cards.length - 1}
      >Prossima domanda</button
    >
  </div>
</section>

<style>
  .interview-mode {
    position: fixed;
    inset: 0;
    z-index: 200;
    height: 100dvh;
    background: #13243b;
    color: #fffdf7;
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    padding: max(16px, env(safe-area-inset-top)) max(20px, env(safe-area-inset-right))
      max(16px, env(safe-area-inset-bottom)) max(20px, env(safe-area-inset-left));
  }
  .question {
    overflow: auto;
    min-height: 0;
    display: grid;
    align-items: safe center;
    overscroll-behavior: contain;
    padding: clamp(12px, 3vmin, 32px) 0;
  }
  .question-text {
    width: 100%;
    max-width: 1100px;
    margin: auto;
    font-size: clamp(1.6rem, 5.3vmin, 4rem);
    font-weight: 600;
    line-height: 1.3;
    overflow-wrap: anywhere;
  }
  .question-text :global(.markdown) {
    font-size: inherit;
    line-height: inherit;
  }
  .question-text :global(p) {
    margin: 0.3em 0;
  }
  .question-text :global(a) {
    color: inherit;
  }
  .controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding-top: 12px;
  }
  button {
    min-height: 52px;
    padding: 12px 20px;
    font-size: 1rem;
    touch-action: manipulation;
    border-radius: 10px;
  }
  .exit {
    background: transparent;
    border: 1px solid #a8b8cb;
    color: #fffdf7;
  }
  .next {
    background: #fffdf7;
    color: #13243b;
    border: 1px solid #fffdf7;
  }
  .next:disabled {
    opacity: 0.4;
  }
  button:focus-visible {
    outline: 3px solid #eebd65;
    outline-offset: 4px;
  }
</style>
