<script lang="ts">
  import { withScheduleDefaults } from '$lib/talk-schedule';
  import { untrack } from 'svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { getWorkspace } from '$lib/workspace.svelte';
  import { emptyEntity, type Collection, type Entity } from '$lib/fields';
  import { commitChanges } from '$lib/repository';
  import type { Change } from '$lib/domain';
  import SpeakerHeader from './SpeakerHeader.svelte';
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
  let entity = $state<Entity | undefined>(
    untrack(() =>
      original
        ? JSON.parse(
            JSON.stringify(
              collection === 'talks' ? withScheduleDefaults(original, workspace.data) : original
            )
          )
        : undefined
    )
  );
  let editorVersion = $state(0);
  let savedNotice = $state('');
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
  const stayInDetail = $derived(
    ['materials', 'sources', 'insights', 'questions'].includes(collection)
  );
  const savedMessage = $derived(collection === 'questions' ? 'Domanda salvata.' : 'Nota salvata.');
  const speaker = $derived(workspace.data.speakers?.find((item) => item.id === relatedSpeaker));
  const speakerTalks = $derived(
    (workspace.data.talks || []).filter((talk) =>
      ((talk.speakerIds as string[]) || []).includes(relatedSpeaker || '')
    )
  );
  const suffix: Partial<Record<Collection, string>> = {
    questions: '/intervista',
    materials: '/note',
    sources: '/note',
    insights: '/note',
    interviewPlans: '/intervista',
    talks: '/talk'
  };
  const returnPath = untrack(() =>
    relatedSpeaker
      ? '/backoffice/speaker/' +
        encodeURIComponent(relatedSpeaker) +
        (suffix[collection] || '') +
        (collection === 'questions'
          ? '?' +
            new URLSearchParams({
              talk: page.url.searchParams.get('talk') || '',
              lang: page.url.searchParams.get('lang') || 'it'
            })
          : '')
      : '/backoffice'
  );
  let busy = $state(false);
  function cancel() {
    if (stayInDetail && id) {
      editorVersion += 1;
      savedNotice = '';
      workspace.message = '';
    } else void goto(returnPath);
  }
  function startEditing() {
    savedNotice = '';
    if (stayInDetail) workspace.message = '';
  }
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
      const saved = await commitChanges(workspace.client!.db, workspace.user!.uid, changes);
      if (stayInDetail) {
        entity = saved.find((record) => record.id === updated.id)!;
        workspace.data[collection] = [
          ...(workspace.data[collection] || []).filter((record) => record.id !== updated.id),
          entity
        ];
        if (!id) {
          await goto(
            '/backoffice/contenuti/' +
              collection +
              '/' +
              encodeURIComponent(updated.id) +
              '?' +
              new URLSearchParams({
                ...(relatedSpeaker ? { speaker: relatedSpeaker } : {}),
                ...(collection === 'questions'
                  ? {
                      talk: page.url.searchParams.get('talk') || '',
                      lang: page.url.searchParams.get('lang') || 'it'
                    }
                  : {})
              }),
            { replaceState: true }
          );
          workspace.message = savedMessage;
        } else {
          editorVersion += 1;
          savedNotice = savedMessage;
          workspace.message = '';
        }
        return;
      }
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
  ><title>{id ? 'Scheda contenuto' : 'Nuovo contenuto'} · Gestione BacaroTech</title></svelte:head
>
{#if stayInDetail && speaker}<SpeakerHeader {speaker} talks={speakerTalks} />{/if}
<p><a href={returnPath}>← Torna {relatedSpeaker ? 'allo speaker' : 'agli speaker'}</a></p>
{#if entity}{#key editorVersion}<Editor
      {collection}
      actionsAtTop={stayInDetail}
      {entity}
      {interviewPlan}
      members={workspace.members}
      {busy}
      onsave={save}
      oncancel={cancel}
      onclose={() => goto(returnPath)}
      onedit={startEditing}
      {savedNotice}
    />{/key}
{:else}<h2>Contenuto non trovato</h2>
  <p>Il contenuto non esiste oppure è stato eliminato.</p>{/if}
