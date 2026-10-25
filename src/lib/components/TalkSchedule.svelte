<script lang="ts">
  import { withScheduleDefaults, scheduleLabel } from '$lib/talk-schedule';
  import type { Entity, Dataset } from '$lib/fields';
  let { talk, data }: { talk: Entity; data: Dataset } = $props();
  const effective = $derived(withScheduleDefaults(talk, data));
  const label = $derived(scheduleLabel(effective));
</script>

{#if label}<p class="talk-schedule">
    {label} <small>Europe/Rome{effective !== talk ? ' · orario predefinito' : ''}</small>
  </p>{/if}

<style>
  .talk-schedule {
    margin: 0.25rem 0 0.75rem;
    font-weight: 600;
  }
  small {
    display: block;
    font-weight: 400;
    color: var(--muted);
  }
</style>
