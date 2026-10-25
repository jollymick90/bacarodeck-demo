<script lang="ts">
  import { untrack } from 'svelte';
  import { goto } from '$app/navigation';
  import { getWorkspace } from '$lib/workspace.svelte';
  import { emptyEntity, type Collection, type Entity } from '$lib/fields';
  import { commitChanges } from '$lib/repository';
  import type { Change } from '$lib/domain';
  import Editor from '$lib/components/Editor.svelte';
  let {
    collection,
    id,
    speakerId = ''
  }: { collection: Collection; id?: string; speakerId?: string } = $props();
  const workspace = getWorkspace();
  // Snapshot once per route: background refreshes must never replace an open draft.
  const original = untrack(() =>
    id
      ? workspace.data[collection]?.find((entity) => entity.id === id)
      : emptyEntity(collection, speakerId || undefined)
  );
  const entity = original ? (JSON.parse(JSON.stringify(original)) as Entity) : undefined;
  const interviewPlan = untrack(() =>
    collection === 'speakers' && id
      ? (JSON.parse(
          JSON.stringify(
            workspace.data.interviewPlans?.find((plan) => plan.speakerId === id) ??
              emptyEntity('interviewPlans', id)
          )
        ) as Entity)
      : undefined
  );
  const relatedSpeaker = untrack(
    () =>
      speakerId ||
      (collection === 'speakers'
        ? id
        : String(entity?.speakerId || (entity?.speakerIds as string[] | undefined)?.[0] || ''))
  );
  const suffix: Partial<Record<Collection, string>> = {
    questions: '/domande',
    interviewPlans: '/intervista',
    talks: '/talk'
  };
  const returnPath = untrack(() =>
    relatedSpeaker
      ? '/backoffice/speaker/' + encodeURIComponent(relatedSpeaker) + (suffix[collection] || '')
      : '/backoffice'
  );
  let busy = $state(false);
  async function save(updated: Entity, plan?: Entity) {
    if (!entity) return;
    busy = true;
    try {
      const changes: Change[] = [
        { collection, data: updated, expectedRevision: entity.revision ?? null }
      ];
      if (plan && interviewPlan)
        changes.push({
          collection: 'interviewPlans',
          data: plan,
          expectedRevision: interviewPlan.revision ?? null
        });
      await commitChanges(workspace.client!.db, workspace.user!.uid, changes);
      workspace.message = 'Modifiche salvate.';
      await goto(
        collection === 'speakers'
          ? '/backoffice/speaker/' + encodeURIComponent(updated.id)
          : returnPath
      );
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head
  ><title>{id ? 'Scheda contenuto' : 'Nuovo contenuto'} · Backoffice BacaroTech</title></svelte:head
>
<p><a href={returnPath}>← Torna {relatedSpeaker ? 'allo speaker' : 'agli speaker'}</a></p>
{#if entity}<Editor
    {collection}
    {entity}
    {interviewPlan}
    members={workspace.members}
    {busy}
    onsave={save}
    oncancel={() => goto(returnPath)}
  />
{:else}<h2>Contenuto non trovato</h2>
  <p>Il contenuto non esiste oppure è stato eliminato.</p>{/if}
