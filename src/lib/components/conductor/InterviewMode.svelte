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
  let activeLanguage = $state(untrack(() => language));
  // Freeze the prepared cards for this interview, even if the team edits the shared data.
  const cards = untrack(() => {
    const data = workspace.data;
    const talk =
      data.talks?.find(
        (t) => t.id === talkId && ((t.speakerIds as string[]) || []).includes(speakerId)
      ) || data.talks?.find((t) => ((t.speakerIds as string[]) || []).includes(speakerId));
    const brief = resolveBrief(data, speakerId, talk?.id || '', language);
    return brief.interviewQuestions.map((q) => ({
      optional: brief.optionalQuestions.some((optional) => optional.id === q.id),
      id: q.id,
      textIt: String(q.textIt || ''),
      textEn: String(q.textEn || ''),
      followUpIt: String(q.followUpIt || ''),
      followUpEn: String(q.followUpEn || '')
    }));
  });
  const returnHref = untrack(() => {
    const params = new URLSearchParams();
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
  const current = $derived(cards[index]);
  const questionText = $derived(
    current?.[activeLanguage === 'it' ? 'textIt' : 'textEn'] ||
      current?.textIt ||
      current?.textEn ||
      'Domanda senza testo.'
  );
  const followUp = $derived(
    current?.[activeLanguage === 'it' ? 'followUpIt' : 'followUpEn'] ||
      current?.followUpIt ||
      current?.followUpEn ||
      ''
  );
  let showFollowUp = $state(false);
  const firstOptional = cards.findIndex((question) => question.optional);
  const finalIndex = cards.length - 1;
  const canSkipOptional = $derived(
    firstOptional >= 0 && index >= firstOptional - 1 && index < finalIndex
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
    const url = new URL(returnHref, window.location.origin);
    url.searchParams.set('lang', activeLanguage);
    await goto(url.pathname + url.search);
  }
  function next() {
    if (index < cards.length - 1) {
      showFollowUp = false;
      index++;
    }
  }
  function skipOptional() {
    showFollowUp = false;
    index = finalIndex;
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
    <div class="question-content">
      <div class="question-text" lang={activeLanguage}>
        {#if cards[index]?.optional}<p class="question-kind">Domanda opzionale · se c’è tempo</p>
        {:else if firstOptional >= 0 && index === finalIndex}<p class="question-kind">
            Domanda finale
          </p>{/if}
        <Markdown text={current ? questionText : 'Nessuna domanda nella scaletta.'} />
      </div>
      {#if showFollowUp && followUp}
        <section
          class="follow-up"
          id="interview-follow-up"
          aria-label="Follow-up"
          lang={activeLanguage}
        >
          <h2>Follow-up</h2>
          <Markdown text={followUp} />
        </section>
      {/if}
    </div>
  </div>
  <div class="controls">
    <button class="exit" onclick={leave} disabled={leaving}>Esci</button>
    <div class="language-switch" role="group" aria-label="Lingua domande">
      <button
        disabled={leaving}
        aria-pressed={activeLanguage === 'it'}
        onclick={() => (activeLanguage = 'it')}>IT</button
      >
      <button
        disabled={leaving}
        aria-pressed={activeLanguage === 'en'}
        onclick={() => (activeLanguage = 'en')}>EN</button
      >
    </div>
    {#if followUp}
      <button
        class="follow-up-toggle"
        disabled={leaving}
        aria-expanded={showFollowUp}
        aria-controls={showFollowUp ? 'interview-follow-up' : undefined}
        onclick={() => (showFollowUp = !showFollowUp)}
      >
        {showFollowUp ? 'Nascondi follow-up' : 'Mostra follow-up'}
      </button>
    {/if}
    <button class="next" onclick={next} disabled={leaving || index >= cards.length - 1}
      >Prossima domanda</button
    >
    {#if canSkipOptional}<button class="skip" disabled={leaving} onclick={skipOptional}
        >Vai alla domanda finale</button
      >{/if}
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
  .question-content {
    width: 100%;
    max-width: 1100px;
    margin: auto;
  }
  .question-text {
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
    flex-wrap: wrap;
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
  .exit,
  .follow-up-toggle,
  .language-switch button {
    background: transparent;
    border: 1px solid #a8b8cb;
    color: #fffdf7;
  }
  .language-switch {
    display: flex;
    gap: 8px;
  }
  .language-switch button[aria-pressed='true'] {
    background: #fffdf7;
    color: #13243b;
    border-color: #fffdf7;
  }
  .follow-up {
    margin-top: 1.5rem;
    padding-top: 1rem;
    border-top: 1px solid #a8b8cb;
    font-size: clamp(1.2rem, 3.5vmin, 2.5rem);
    line-height: 1.4;
    overflow-wrap: anywhere;
  }
  .follow-up h2 {
    color: #c9d7ea;
    font-size: 0.9rem;
    margin: 0 0 0.5rem;
  }
  .follow-up :global(.markdown) {
    font-size: inherit;
    line-height: inherit;
    color: inherit;
  }
  .follow-up :global(a) {
    color: inherit;
  }
  .question-kind {
    font-size: 0.9rem;
    font-weight: 400;
    color: #c9d7ea;
  }
  .skip {
    flex-basis: 100%;
    background: transparent;
    color: #fffdf7;
    border: 1px solid #a8b8cb;
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
