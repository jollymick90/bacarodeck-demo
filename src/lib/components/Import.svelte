<script lang="ts">
  import { getWorkspace } from '$lib/workspace.svelte';
  const workspace = getWorkspace();
  import { untrack } from 'svelte';
  import {
    parseImport,
    previewImport,
    selectedChanges,
    type PreviewRow,
    type Change
  } from '$lib/domain';
  import { scheduleKeys } from '$lib/talk-schedule';
  import { labels, type Dataset } from '$lib/fields';
  let {
    data,
    oncommit,
    oncancel,
    initial = '',
    busy = false,
    scheduleImport = false
  }: {
    data: Dataset;
    oncommit: (
      changes: Change[],
      origin?: 'manual' | 'import',
      votes?: { questionId: string; score: number }[]
    ) => Promise<void>;
    oncancel: () => void;
    initial?: string;
    busy?: boolean;
    scheduleImport?: boolean;
  } = $props();
  let text = $state(untrack(() => initial));
  let rows = $state<PreviewRow[]>([]);
  let error = $state('');
  let approved = $state(false);
  let reviewed = $state(false);
  let restoring = $state(false);
  let votes = $state<{ questionId: string; score: number }[]>([]);
  let restoreVotes = $state(false);
  let missingRequired = $state(false);
  const changes = $derived(selectedChanges(rows));
  const missingVoteTargets = $derived(
    restoreVotes &&
      votes.some(
        (vote) =>
          !data.questions?.some((question) => question.id === vote.questionId) &&
          !changes.some(
            (change) => change.collection === 'questions' && change.data.id === vote.questionId
          )
      )
  );
  function preview() {
    error = '';
    approved = false;
    try {
      const parsed = parseImport(text);
      restoring = parsed.exportKind === 'editorial-work';
      votes = restoring ? parsed.personalRatings || [] : [];
      restoreVotes = false;
      missingRequired =
        restoring &&
        (parsed.requiredDocuments || []).some(
          (ref) => !data[ref.collection]?.some((entity) => entity.id === ref.id)
        );
      rows = previewImport(parsed, data);
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
  function selectSchedule() {
    for (const row of rows) {
      if (row.blocked || row.collection !== 'talks') continue;
      for (const field of row.fields)
        field.selected = (scheduleKeys as readonly string[]).includes(field.key);
    }
    approved = false;
  }
  async function loadFile(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      text = await file.text();
      preview();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }
  async function commit() {
    if (
      !approved ||
      missingRequired ||
      missingVoteTargets ||
      (!changes.length && !(restoreVotes && votes.length))
    )
      return;
    error = '';
    try {
      await oncommit(changes, restoring ? 'manual' : 'import', restoreVotes ? votes : []);
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
    <label
      >Apri file JSON<input
        type="file"
        accept=".json,application/json"
        onchange={loadFile}
      /></label
    >
    <label for="import-json">JSON da importare</label><textarea
      id="import-json"
      rows="14"
      bind:value={text}
      spellcheck="false"></textarea>
    <button class="primary" onclick={preview}>Valida e mostra anteprima</button>
  {:else}
    {#if restoring}<p class="notice">
        Ripristino lavoro editoriale: gli stati delle domande vengono conservati. Controlla e
        seleziona le modifiche ai documenti già presenti.
      </p>{/if}
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
    {#if scheduleImport}<button disabled={busy} onclick={selectSchedule}
        >Seleziona tutti gli aggiornamenti degli orari</button
      >
      <p>
        Include le sostituzioni degli orari già salvati: verifica le differenze prima di confermare.
      </p>{/if}
    {#if missingRequired}<p class="warning">
        Importa i documenti di base richiesti prima di ripristinare questo file.
      </p>{/if}
    {#if missingVoteTargets}<p class="warning">
        Alcune domande votate non sono presenti: importa prima le domande oppure deseleziona il
        ripristino dei voti. Gli altri contenuti possono essere importati separatamente.
      </p>{/if}
    {#if votes.length}<label class="inline"
        ><input
          type="checkbox"
          bind:checked={restoreVotes}
          onchange={() => (approved = false)}
        />Ripristina {votes.length} voti sul mio account attuale</label
      >
      <p class="muted">
        I voti sono applicati dopo i documenti. Se un passaggio fallisce, riapri il file e ripeti
        l’importazione senza duplicarli.
      </p>{/if}
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
      <button
        class="primary"
        onclick={commit}
        disabled={workspace.readOnly ||
          !approved ||
          missingRequired ||
          missingVoteTargets ||
          (!changes.length && !(restoreVotes && votes.length)) ||
          busy}>{busy ? 'Importazione…' : 'Conferma importazione'}</button
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
