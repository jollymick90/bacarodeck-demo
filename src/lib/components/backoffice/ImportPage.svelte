<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { getWorkspace } from '$lib/workspace.svelte';
  import { collections, type Dataset } from '$lib/fields';
  import { commitChanges, restorePersonalRatings } from '$lib/repository';
  import type { Change } from '$lib/domain';
  import { prepareScheduleImport, withScheduleDefaults } from '$lib/talk-schedule';
  import Import from '$lib/components/Import.svelte';
  let { preset = '', speakerId = '' }: { preset?: string; speakerId?: string } = $props();
  const workspace = getWorkspace();
  let initial = $state('');
  let loading = $state(true);
  let failure = $state('');
  let busy = $state(false);
  let scheduleWarnings = $state<string[]>([]);
  let scheduleCount = $state(0);
  function prepareHours(snapshot?: unknown) {
    const result = prepareScheduleImport(workspace.data, snapshot);
    initial = JSON.stringify(result.data, null, 2);
    scheduleWarnings = result.warnings;
    scheduleCount = result.matched;
  }
  async function loadHours(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      if (file.size > 5_000_000) throw Error('File troppo grande (massimo 5 MB).');
      prepareHours(JSON.parse(await file.text()));
      failure = '';
    } catch (error) {
      failure = (error as Error).message;
    }
  }
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
      if (preset === 'orari') {
        if (active) prepareHours();
      } else if (preset === 'catalogo' || preset === 'traduzioni') {
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
            missing[name] = (catalog[name] || [])
              .map((item) => (name === 'talks' ? withScheduleDefaults(item, catalog) : item))
              .filter((item) => !(data[name] || []).some((existing) => existing.id === item.id));
          if (active) initial = JSON.stringify(missing, null, 2);
        }
      } else if (preset === 'esempio') {
        const seed = await import('../../../../data/seed/seed_five.json');
        if (active)
          initial = JSON.stringify(
            {
              ...seed.default,
              talks: seed.default.talks.map((talk) =>
                withScheduleDefaults(talk, seed.default as unknown as Dataset)
              )
            },
            null,
            2
          );
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
{#if preset === 'orari'}
  <h1>Importa orari Codemotion</h1>
  <p>
    Orari del talk in Europe/Rome. Il file incluso è aggiornato al 25 ottobre 2026. Gli appuntamenti
    delle interviste non vengono spostati.
  </p>
  <label
    >Carica un JSON degli orari<input
      type="file"
      accept=".json,application/json"
      onchange={loadHours}
      disabled={busy}
    /></label
  >
  <p>{scheduleCount} talk abbinati nel workspace attuale.</p>
  {#if scheduleWarnings.length}<details>
      <summary>Abbinamenti da verificare ({scheduleWarnings.length})</summary>
      <ul>
        {#each scheduleWarnings as warning}<li>{warning}</li>{/each}
      </ul>
    </details>{/if}
{/if}
{#if loading}<p role="status">Preparazione importazione…</p>
{:else if failure}<p role="alert">{failure}</p>
  <a href="/backoffice/strumenti">Torna agli strumenti</a>
{:else}{#key initial}<Import
      data={workspace.data}
      {initial}
      {busy}
      scheduleImport={preset === 'orari'}
      oncommit={save}
      oncancel={() => goto(speakerId ? destination : '/backoffice/strumenti')}
    />{/key}{/if}
