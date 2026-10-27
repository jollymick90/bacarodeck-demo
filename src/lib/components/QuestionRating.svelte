<script lang="ts">
  import { getAuth } from 'firebase/auth';
  import { getWorkspace } from '$lib/workspace.svelte';
  import { api } from '$lib/repository';
  const workspace = getWorkspace();
  import type { Entity } from '$lib/fields';
  let { question, onchange }: { question: Entity; onchange: () => void } = $props();
  let busy = $state(false);
  let failure = $state('');
  const ratings = $derived((question.ratings || {}) as Record<string, number>);
  const votes = $derived(Object.values(ratings));
  const own = $derived(ratings[getAuth().currentUser?.uid || ''] || 0);
  async function rate(score: number) {
    busy = true;
    failure = '';
    try {
      await api(`/api/questions/${question.id}/rating`, { score });
      onchange();
    } catch (e) {
      failure = (e as Error).message;
    } finally {
      busy = false;
    }
  }
</script>

<div class="question-rating">
  <span
    >Voto: {votes.length ? (votes.reduce((a, b) => a + b, 0) / votes.length).toFixed(1) : '—'} ({votes.length})</span
  >
  <div aria-label="Il tuo voto">
    {#each [1, 2, 3, 4, 5] as score}<button
        disabled={busy || workspace.readOnly}
        aria-pressed={own === score}
        aria-label={`Vota ${score} su 5`}
        onclick={() => rate(score)}>{score} ★</button
      >{/each}
  </div>
  {#if failure}<p role="alert">{failure}</p>{/if}
</div>
