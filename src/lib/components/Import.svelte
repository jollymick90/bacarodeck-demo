<script lang="ts">
  import { untrack } from 'svelte';
  import {
    parseImport,
    previewImport,
    selectedChanges,
    type PreviewRow,
    type Change
  } from '$lib/domain';
  import { labels, type Dataset } from '$lib/fields';
  let {
    data,
    oncommit,
    oncancel,
    initial = '',
    busy = false
  }: {
    data: Dataset;
    oncommit: (changes: Change[]) => Promise<void>;
    oncancel: () => void;
    initial?: string;
    busy?: boolean;
  } = $props();
  let text = $state(untrack(() => initial));
  let rows = $state<PreviewRow[]>([]);
  let error = $state('');
  let approved = $state(false);
  let reviewed = $state(false);
  const changes = $derived(selectedChanges(rows));
  function preview() {
    error = '';
    approved = false;
    try {
      rows = previewImport(parseImport(text), data);
      reviewed = true;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }
  function selectMissingTranslations() {
    const keys = new Set(['biographyIt', 'biographyEn', 'abstractIt', 'abstractEn']);
    for (const row of rows) {
      if (!row.existing || row.blocked || row.existing.translationReviewed === true) continue;
      let selected = false;
      for (const field of row.fields) {
        if (
          keys.has(field.key) &&
          !String(field.before || '').trim() &&
          String(field.after || '').trim()
        ) {
          field.selected = true;
          selected = true;
        }
      }
      if (selected) {
        const review = row.fields.find((field) => field.key === 'translationReviewed');
        if (review && review.after === false) review.selected = true;
      }
    }
    approved = false;
  }
  async function commit() {
    if (!approved || !changes.length) return;
    error = '';
    try {
      await oncommit(changes);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }
</script>

<section class="import-panel">
  <div class="section-heading">
    <h2>Importa ricerca</h2>
    <button onclick={oncancel} disabled={busy}>Chiudi</button>
  </div>
  <p>
    Incolla JSON. Controlla ogni cambiamento prima di scrivere. Le domande importate restano
    suggerite.
  </p>
  {#if !reviewed}
    <label for="import-json">JSON da importare</label><textarea
      id="import-json"
      rows="14"
      bind:value={text}
      spellcheck="false"></textarea>
    <button class="primary" onclick={preview}>Valida e mostra anteprima</button>
  {:else}
    <p class="notice">
      Le modifiche ai dati esistenti sono deselezionate. Seleziona i singoli campi da aggiornare;
      note e piani non vengono sostituiti automaticamente.
    </p>
    {#if rows.some( (row) => row.fields.some( (field) => ['biographyIt', 'biographyEn', 'abstractIt', 'abstractEn'].includes(field.key) ) )}
      <button onclick={selectMissingTranslations} disabled={busy}
        >Seleziona traduzioni mancanti</button
      >
      <p class="muted">
        Solo campi vuoti su schede esistenti non verificate. I testi già compilati vengono
        conservati.
      </p>
    {/if}
    {#each rows as row}
      <article class="diff-row">
        <h3>{labels[row.collection]} · {row.id}</h3>
        {#each row.warnings as warning}<p class="warning">{warning}</p>{/each}
        {#if !row.existing}<label class="inline"
            ><input
              type="checkbox"
              bind:checked={row.selected}
              disabled={row.blocked || busy}
              onchange={() => (approved = false)}
            />Crea questo documento</label
          >
        {:else if !row.fields.length}<p>Già presente, nessuna differenza.</p>{/if}
        {#each row.fields as field}
          <details>
            <summary
              >{#if row.existing}<input
                  aria-label={'Aggiorna ' + row.id + ' ' + field.key}
                  type="checkbox"
                  bind:checked={field.selected}
                  disabled={row.blocked || busy}
                  onchange={() => (approved = false)}
                />{/if}{field.key}</summary
            >
            <div class="diff-values">
              <div>
                <small>Attuale</small>
                <pre>{field.before === undefined
                    ? '—'
                    : JSON.stringify(field.before, null, 2)}</pre>
              </div>
              <div>
                <small>Proposto</small>
                <pre>{JSON.stringify(field.after, null, 2)}</pre>
              </div>
            </div>
          </details>
        {/each}
      </article>
    {/each}
    <p>
      {changes.length} documenti selezionati. Un solo salvataggio atomico: in caso di conflitto non viene
      scritto nulla.
    </p>
    <p>
      Prima di confermare puoi annullare senza effetti. Dopo il salvataggio non è previsto un
      ripristino automatico: correggi i contenuti dalla scheda.
    </p>
    <label class="inline"
      ><input type="checkbox" bind:checked={approved} disabled={busy} />Ho verificato le differenze
      e approvo queste scritture</label
    >
    <div class="form-actions">
      <button class="primary" onclick={commit} disabled={!approved || !changes.length || busy}
        >{busy ? 'Importazione…' : 'Conferma importazione'}</button
      ><button
        disabled={busy}
        onclick={() => {
          reviewed = false;
          approved = false;
          rows = [];
        }}>Torna al JSON</button
      ><button onclick={oncancel} disabled={busy}>Annulla senza scrivere</button>
    </div>
  {/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}
</section>
