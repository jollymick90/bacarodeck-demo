<script lang="ts">
  import type { Entity } from '$lib/fields';
  import { getWorkspace } from '$lib/workspace.svelte';
  import { api, refreshWorkspace } from '$lib/repository';
  import SuccessNotice from '../SuccessNotice.svelte';

  let { speakerId, plan }: { speakerId: string; plan?: Entity } = $props();
  const workspace = getWorkspace();
  const completed = $derived(plan?.interviewStatus === 'completed');
  let busy = $state(false);
  let failure = $state('');
  let message = $state('');

  async function save() {
    if (busy || workspace.readOnly) return;
    busy = true;
    failure = '';
    message = '';
    const done = !completed;
    try {
      const result: { documents: Entity[] } = await api('/api/data', {
        action: 'save',
        changes: [
          {
            collection: 'interviewPlans',
            data: {
              ...plan,
              id: plan?.id || speakerId,
              speakerId,
              interviewStatus: done ? 'completed' : 'unconfirmed'
            },
            expectedRevision: plan?.revision ?? null
          }
        ]
      });
      const saved = result.documents[0];
      workspace.data.interviewPlans = [
        ...(workspace.data.interviewPlans || []).filter((item) => item.id !== saved.id),
        saved
      ];
      refreshWorkspace();
      message = done ? 'Intervista segnata come fatta.' : 'Intervista riportata a Da confermare.';
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
      refreshWorkspace();
    } finally {
      busy = false;
    }
  }
</script>

<div class="interview-completion" class:completed role="group" aria-label="Stato intervista">
  <strong>{completed ? 'Intervista fatta' : 'Intervista da fare'}</strong>
  <button class:primary={!completed} disabled={busy || workspace.readOnly} onclick={save}>
    {completed ? 'Segna da intervistare' : 'Intervista fatta'}
  </button>
  {#if failure}<p class="error" role="alert">{failure}</p>{/if}
</div>
<SuccessNotice {message} ondismiss={() => (message = '')} />

<style>
  .interview-completion {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
    margin: 18px 0;
    padding: 14px;
    border: 1px solid #bdcfb4;
    border-radius: 12px;
  }
  .completed {
    background: #dcefdc;
    color: #245844;
  }
  button {
    min-height: 44px;
  }
  .error {
    flex-basis: 100%;
    margin: 0;
  }
</style>
