<script lang="ts">
  import type { SpeakerFilters } from '$lib/speaker-filters';
  import type { Entity } from '$lib/fields';

  let {
    filters,
    signedIn,
    onchange,
    speakers = [],
    plans = []
  }: {
    filters: SpeakerFilters;
    signedIn: boolean;
    onchange: (name: 'intervista' | 'assegnazione', value: string) => void;
    speakers?: Entity[];
    plans?: Entity[];
  } = $props();
  const completedIds = $derived(
    new Set(
      plans.filter((plan) => plan.interviewStatus === 'completed').map((plan) => plan.speakerId)
    )
  );
  const completed = $derived(speakers.filter((speaker) => completedIds.has(speaker.id)).length);
</script>

<p class="speaker-totals" aria-label="Totali complessivi speaker">
  Totale speaker: <strong>{speakers.length}</strong> · Già fatte: <strong>{completed}</strong> · Da
  fare: <strong>{speakers.length - completed}</strong>
</p>
<div class="speaker-filters" role="group" aria-label="Filtri globali speaker">
  <label>
    Intervista
    <select
      value={filters.interview}
      onchange={(event) => onchange('intervista', event.currentTarget.value)}
    >
      <option value="pending">Da fare</option>
      <option value="completed">Già fatte</option>
      <option value="all">Tutte</option>
    </select>
  </label>
  <label>
    Assegnazione
    <select
      value={filters.assignment}
      onchange={(event) => onchange('assegnazione', event.currentTarget.value)}
    >
      <option value="all">Tutte</option>
      <option value="self" disabled={!signedIn}>A me</option>
      <option value="others" disabled={!signedIn}>Ad altri</option>
      <option value="unassigned">Non assegnati</option>
    </select>
  </label>
</div>

<style>
  .speaker-filters {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin: 1rem 0;
  }
  label {
    display: grid;
    flex: 1 1 170px;
    gap: 0.35rem;
  }
  select {
    width: 100%;
    min-height: 44px;
  }
</style>
