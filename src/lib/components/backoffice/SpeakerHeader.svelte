<script lang="ts">
  import TalkSchedule from '../TalkSchedule.svelte';
  import { getWorkspace } from '$lib/workspace.svelte';
  const workspace = getWorkspace();
  import type { Entity } from '$lib/fields';
  import { safeUrl } from '$lib/domain';
  let { speaker, talks = [] }: { speaker: Entity; talks?: Entity[] } = $props();
  const display = (value: unknown) => (typeof value === 'string' ? value : '');
</script>

<header class="speaker-profile">
  {#if speaker.photoUrl && safeUrl(speaker.photoUrl)}
    <img
      class="speaker-photo"
      src={display(speaker.photoUrl)}
      alt={'Foto di ' + speaker.fullName}
      referrerpolicy="no-referrer"
    />
  {:else}
    <div class="speaker-photo photo-placeholder" aria-label="Foto non disponibile">
      {display(speaker.fullName)
        .split(' ')
        .map((part) => part[0])
        .slice(0, 2)
        .join('')}
    </div>
  {/if}
  <h1 id="speaker-title" tabindex="-1">{speaker.fullName}</h1>
  <p class="speaker-role">{speaker.headline || 'Ruolo non disponibile'}</p>
  {#each talks as talk}
    <a class="speaker-talk" href={'/backoffice/speaker/' + encodeURIComponent(speaker.id) + '/talk'}
      >{talk.title || 'Talk senza titolo'}</a
    >
    <TalkSchedule {talk} data={workspace.data} />
  {:else}<p class="muted">Talk non ancora disponibile.</p>{/each}
</header>

<style>
  .speaker-profile {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 0.4rem;
    margin-bottom: 1.5rem;
  }
  .speaker-photo {
    width: 128px;
    height: 128px;
    border-radius: 12px;
    object-fit: cover;
    margin-bottom: 0.5rem;
  }
  .photo-placeholder {
    display: grid;
    place-items: center;
    background: #dce6f2;
    color: var(--blue);
    font-size: 2rem;
    font-weight: 700;
  }
  .speaker-profile h1 {
    margin: 0;
    font-size: clamp(1.6rem, 5vw, 2rem);
  }
  .speaker-role {
    margin: 0;
    color: var(--muted);
  }
  .speaker-talk {
    max-width: 60ch;
    font-weight: 600;
  }
</style>
