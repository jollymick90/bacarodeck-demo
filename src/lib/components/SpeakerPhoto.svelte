<script lang="ts">
  import type { Entity } from '$lib/fields';
  import { safeUrl } from '$lib/domain';
  let { speaker, compact = false }: { speaker: Entity; compact?: boolean } = $props();
  let failedUrl = $state('');
  const url = $derived(
    typeof speaker.photoUrl === 'string' && safeUrl(speaker.photoUrl) ? speaker.photoUrl : ''
  );
  const name = $derived(String(speaker.fullName || 'Speaker'));
  const initials = $derived(
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
  );
</script>

{#if url && failedUrl !== url}
  <img
    class="speaker-photo"
    class:compact
    src={url}
    alt={`Foto di ${name}`}
    width={compact ? 64 : 128}
    height={compact ? 64 : 128}
    loading={compact ? 'lazy' : 'eager'}
    referrerpolicy="no-referrer"
    onerror={() => (failedUrl = url)}
  />
{:else}
  <div
    class="speaker-photo placeholder"
    class:compact
    role="img"
    aria-label={`Foto non disponibile: ${name}`}
  >
    {initials}
  </div>
{/if}

<style>
  .speaker-photo {
    display: block;
    width: 128px;
    height: 128px;
    flex-shrink: 0;
    object-fit: cover;
    border-radius: 12px;
  }
  .compact {
    width: 64px;
    height: 64px;
  }
  .placeholder {
    display: grid;
    place-items: center;
    background: #dce6f2;
    color: var(--blue);
    font-size: 2rem;
    font-weight: 700;
  }
  .placeholder.compact {
    font-size: 1.25rem;
  }
</style>
