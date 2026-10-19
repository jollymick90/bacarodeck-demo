<script lang="ts">
  import { onMount } from 'svelte';
  import { getAuth } from 'firebase/auth';
  import { labels, fields as definitions, type Dataset } from '$lib/fields';
  import { exportCandidates, buildEditorialExport, type ExportRow } from '$lib/editorial-export';
  import { parseImport } from '$lib/domain';
  let { uid, oncancel }: { uid: string; oncancel: () => void } = $props();
  let rows = $state<ExportRow[]>([]);
  let includeRatings = $state(true);
  let personalRatings = $state<{ questionId: string; score: number }[]>([]);
  let loading = $state(true);
  let failure = $state('');
  const selectedCount = $derived(
    rows.filter((row) => row.fields.some((field) => field.selected)).length
  );
  onMount(() => {
    void (async () => {
      try {
        const token = await getAuth().currentUser?.getIdToken();
        const response = await fetch('/api/export', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const snapshot = await response.json();
        if (!response.ok) throw new Error(snapshot.message || 'Esportazione non disponibile.');
        personalRatings = ((snapshot as Dataset).questions || []).flatMap((question) => {
          const score = (question.ratings as Record<string, number> | undefined)?.[uid];
          return Number.isInteger(score) && score! >= 1 && score! <= 5
            ? [{ questionId: question.id, score: score! }]
            : [];
        });
        const baselines = await Promise.all([
          import('../../../data/seed/catalog.json'),
          import('../../../data/seed/seed_five.json'),
          import('../../../data/seed/abstracts-codemotion.json'),
          import('../../../BacaroTech_Schede_Speaker_2026/import/00_tutti_gli_speaker.json')
        ]);
        rows = exportCandidates(
          snapshot,
          baselines.map((item) => item.default as unknown as Dataset)
        );
      } catch (e) {
        failure = e instanceof Error ? e.message : String(e);
      } finally {
        loading = false;
      }
    })();
  });
  function download() {
    failure = '';
    try {
      const result = buildEditorialExport(rows, includeRatings ? personalRatings : []);
      const text = JSON.stringify(result, null, 2);
      parseImport(text);
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `bacarodeck-lavoro-${new Date().toISOString().replaceAll(':', '-')}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      failure = e instanceof Error ? e.message : String(e);
    }
  }
</script>

<section class="import-panel" aria-label="Esporta lavoro editoriale">
  <div class="section-heading">
    <h2>Esporta il lavoro editoriale</h2>
    <button onclick={oncancel}>Chiudi export</button>
  </div>
  <p>
    Esporta i contenuti salvati e le modifiche alle schede importate. I dati identici ai pacchetti
    JSON conosciuti sono esclusi. L’export legge i dati salvati attraverso la cache del server
    quando apri questo pannello.
  </p>
  <p class="notice">
    Per i dati precedenti a questa funzione l’origine non è certa: controlla e seleziona i campi che
    hai inserito tu. Anche un JSON personalizzato può comparire tra i contenuti da verificare. La
    selezione riguarda il lavoro condiviso del workspace.
  </p>
  <p>
    In locale importa prima il catalogo di base, poi questo file tramite “Importa JSON”. Le bozze
    non salvate, i voti degli altri, le cancellazioni e gli account di accesso non sono inclusi.
  </p>
  {#if loading}<p role="status">Preparazione anteprima…</p>
  {:else}
    <p role="status">
      {selectedCount} documenti selezionati su {rows.length} con contenuti esportabili.
    </p>
    <button
      onclick={() => {
        for (const row of rows) for (const field of row.fields) field.selected = false;
      }}>Deseleziona tutto</button
    >
    {#each rows as row}
      <article class="diff-row">
        <h3>
          {labels[row.collection]} · {String(
            row.entity.fullName || row.entity.title || row.entity.textIt || row.entity.id
          )}
        </h3>
        <p>
          {row.uncertain
            ? 'Origine storica da verificare'
            : row.patch
              ? 'Modifiche manuali a una scheda importata'
              : 'Contenuto creato manualmente'} · {row.entity.id}
        </p>
        <button
          onclick={() => {
            for (const field of row.fields) field.selected = true;
          }}>Seleziona i campi di questa scheda</button
        >
        {#each row.fields as field}
          <details>
            <summary
              ><label class="inline"
                ><input type="checkbox" bind:checked={field.selected} />{definitions[
                  row.collection
                ].find((item) => item.key === field.key)?.label || field.key}</label
              ></summary
            >
            <pre style="white-space: pre-wrap; overflow-wrap: anywhere;">{typeof field.value ===
              'string'
                ? field.value
                : JSON.stringify(field.value, null, 2)}</pre>
          </details>
        {/each}
      </article>
    {/each}
    {#if personalRatings.length}<label class="inline"
        ><input type="checkbox" bind:checked={includeRatings} />Includi i miei {personalRatings.length}
        voti (da riassegnare al mio account locale)</label
      >{/if}
    {#if !rows.length}<p>Nessun contenuto aggiuntivo da esportare.</p>{/if}
    {#if selectedCount > 400}<p class="warning">
        Seleziona al massimo 400 documenti per file. Puoi scaricare più file separati.
      </p>{/if}
    <button
      class="primary"
      disabled={(!selectedCount && !(includeRatings && personalRatings.length)) ||
        selectedCount > 400}
      onclick={download}>Scarica export JSON</button
    >
  {/if}
  {#if failure}<p role="alert" class="error">{failure}</p>{/if}
</section>
