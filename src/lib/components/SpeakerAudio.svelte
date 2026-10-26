<script lang="ts">
  import { base } from '$app/paths';
  import { speakerAudio } from '$lib/speaker-audio';

  let { speakerId }: { speakerId: string } = $props();
  const briefing = $derived(
    Object.hasOwn(speakerAudio, speakerId) ? speakerAudio[speakerId] : undefined
  );
  let failedSrc = $state('');
</script>

{#if briefing}
  {#key briefing.src}
    <section class="audio-briefing" aria-label="Briefing audio">
      <h2>Ascolta il briefing</h2>
      <p class="audio-title">{briefing.title}</p>
      <p class="audio-meta">Italiano · {briefing.duration}</p>
      <audio
        controls
        preload="none"
        src={base + briefing.src}
        aria-label={'Audio: ' + briefing.title}
        onerror={(event) => (failedSrc = event.currentTarget.getAttribute('src') || '')}
      ></audio>
      {#if failedSrc === base + briefing.src}
        <p role="alert">L’audio non è disponibile nel player. Prova ad aprire il link diretto.</p>
      {/if}
      <a href={base + briefing.src} target="_blank" rel="noopener">Apri o scarica l’audio</a>
    </section>
  {/key}
{/if}

<style>
  .audio-briefing {
    margin: 24px 0;
    padding: 20px;
    background: #fffef9;
    border: 1px solid #d6deca;
    border-radius: 16px;
  }
  h2 {
    margin: 0 0 8px;
    font-size: 24px;
  }
  .audio-title {
    margin: 0 0 4px;
    overflow-wrap: anywhere;
  }
  .audio-meta {
    margin: 0 0 12px;
    color: #66755e;
    font-size: 14px;
  }
  audio {
    display: block;
    width: 100%;
    min-width: 0;
    margin-bottom: 12px;
  }
  a {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
  }
</style>
