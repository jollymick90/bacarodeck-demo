<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { getWorkspace } from '$lib/workspace.svelte';
  import { collections, type Dataset } from '$lib/fields';
  import { commitChanges, restorePersonalRatings } from '$lib/repository';
  import type { Change } from '$lib/domain';
  import Import from '$lib/components/Import.svelte';
  let { preset = '', speakerId = '' }: { preset?: string; speakerId?: string } = $props();
  const workspace = getWorkspace();
  let initial = $state('');
  let loading = $state(true);
  let failure = $state('');
  let busy = $state(false);
  const destination = $derived(
    speakerId
      ? '/backoffice/speaker/' +
          encodeURIComponent(speakerId) +
          '/intervista?' +
          new URLSearchParams({
            talk: page.url.searchParams.get('talk') || '',
            lang: page.url.searchParams.get('lang') || 'it'
          })
      : '/backoffice'
  );
  onMount(() => {
    let active = true;
    async function prepare() {
      const data = workspace.data;
      if (preset === 'catalogo' || preset === 'traduzioni') {
        const catalog = (await import('../../../../data/seed/catalog.json'))
          .default as unknown as Dataset;
        if (preset === 'traduzioni') {
          const { prepareTranslationImport } = await import('$lib/translations');
          const result = prepareTranslationImport(catalog, data);
          if (active) {
            initial = JSON.stringify(result.data, null, 2);
            workspace.message = `Traduzioni mancanti: ${(result.data.speakers?.length || 0) + (result.data.talks?.length || 0)} schede. Escluse ${result.changedSources} con originale modificato e ${result.reviewedSkipped} già verificate.`;
          }
        } else {
          const missing: Record<string, unknown> = { schemaVersion: 1 };
          for (const name of collections)
            missing[name] = (catalog[name] || []).filter(
              (item) => !(data[name] || []).some((existing) => existing.id === item.id)
            );
          if (active) initial = JSON.stringify(missing, null, 2);
        }
      } else if (preset === 'esempio') {
        const seed = await import('../../../../data/seed/seed_five.json');
        if (active) initial = JSON.stringify(seed.default, null, 2);
      }
    }
    void prepare()
      .catch((error) => {
        if (active) failure = error instanceof Error ? error.message : String(error);
      })
      .finally(() => {
        if (active) loading = false;
      });
    return () => {
      active = false;
    };
  });
  async function save(
    changes: Change[],
    origin: 'manual' | 'import' = 'import',
    votes: { questionId: string; score: number }[] = []
  ) {
    busy = true;
    try {
      await commitChanges(workspace.client!.db, workspace.user!.uid, changes, origin);
      try {
        await restorePersonalRatings(votes);
      } catch (error) {
        throw new Error(
          `Documenti salvati, ma ripristino dei voti incompleto. Riapri il file e ripristina i voti rimasti: ${error instanceof Error ? error.message : String(error)}`
        );
      }
      workspace.message = `Importazione completata: ${changes.length} documenti salvati, ${votes.length} voti ripristinati.`;
      await goto(destination);
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head><title>Importa · Gestione BacaroTech</title></svelte:head>
{#if loading}<p role="status">Preparazione importazione…</p>
{:else if failure}<p role="alert">{failure}</p>
  <a href="/backoffice/strumenti">Torna agli strumenti</a>
{:else}<Import
    data={workspace.data}
    {initial}
    {busy}
    oncommit={save}
    oncancel={() => goto(speakerId ? destination : '/backoffice/strumenti')}
  />{/if}
