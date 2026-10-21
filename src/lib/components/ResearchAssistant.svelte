<script lang="ts">
  import { researchEntries } from '$lib/research';
  import { researchPrompt, questionsPrompt } from '$lib/research-prompts';
  import { emptyEntity, type Dataset, type Entity } from '$lib/fields';
  import { validateEntity } from '$lib/domain';
  import ResearchReader from './ResearchReader.svelte';
  let {
    speaker,
    data,
    busy,
    onsave
  }: {
    speaker: Entity;
    data: Dataset;
    busy: boolean;
    onsave: (records: Entity[]) => Promise<void>;
  } = $props();
  let selected = $state<string[]>([]);
  let prompt = $state('');
  let notice = $state('');
  let failure = $state('');
  let pasted = $state('');
  let drafts = $state<Entity[]>([]);
  let reading = $state(false);
  const entries = $derived(researchEntries(data, speaker.id));
  const selectedEntries = $derived(
    entries.filter((entry) => selected.includes(`${entry.collection}/${entry.entity.id}`))
  );
  const key = (collection: string, entity: Entity) => `${collection}/${entity.id}`;

  async function copy(text: string) {
    prompt = text;
    notice = '';
    failure = '';
    try {
      await navigator.clipboard.writeText(text);
      notice = 'Prompt copiato. Incollalo in una nuova chat AI.';
    } catch {
      notice =
        'Copia automatica non disponibile: seleziona il prompt qui sotto e copialo manualmente.';
    }
  }
  function draft(text: string, filename = ''): Entity {
    if (!text.trim()) throw new Error('Il Markdown è vuoto.');
    const record = emptyEntity('materials', speaker.id);
    record.title =
      text.match(/^#\s+(.+)$/m)?.[1]?.trim() || filename.replace(/\.md$/i, '') || 'Ricerca AI';
    record.bodyMd = text;
    record.provenance = 'ai_generated';
    record.language = 'it/en';
    const errors = validateEntity('materials', record);
    if (errors.length) throw new Error(errors.join('\n'));
    return record;
  }
  function previewPaste() {
    failure = '';
    try {
      drafts = [...drafts, draft(pasted)];
      pasted = '';
    } catch (cause) {
      failure = cause instanceof Error ? cause.message : String(cause);
    }
  }
  async function files(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const chosen = [...(input.files || [])];
    reading = true;
    failure = '';
    try {
      if (chosen.length + drafts.length > 30)
        throw new Error('Carica al massimo 30 documenti per volta.');
      const incoming: Entity[] = [];
      for (const file of chosen) {
        if (!/\.md$/i.test(file.name)) throw new Error('Scegli file Markdown .md.');
        if (file.size > 200 * 1024)
          throw new Error(`${file.name}: supera 200 KiB. Dividilo in più documenti.`);
        incoming.push(draft(await file.text(), file.name));
      }
      drafts = [...drafts, ...incoming];
    } catch (cause) {
      failure = cause instanceof Error ? cause.message : String(cause);
    } finally {
      reading = false;
      input.value = '';
    }
  }
  async function save() {
    failure = '';
    try {
      await onsave(drafts);
      drafts = [];
      notice = 'Markdown salvati nella ricerca dello speaker.';
    } catch (cause) {
      failure = cause instanceof Error ? cause.message : String(cause);
    }
  }
</script>

<details class="research-assistant">
  <summary>Ricerca con Gemini / ChatGPT</summary>
  <p>
    Due sessioni separate: prima raccogli le fonti, poi prepara le domande. I prompt vengono
    copiati; l’app non chiama servizi AI.
  </p>
  <h4>1. Cerca e raccogli</h4>
  <button disabled={busy} onclick={() => copy(researchPrompt(speaker, data))}
    >Copia prompt ricerca</button
  >
  <h4>2. Prepara le domande</h4>
  <p>
    Seleziona solo i contenuti da portare nella nuova chat. Il prompt include anche i talk, la
    lingua prevista e le domande già presenti.
  </p>
  <div class="choices">
    {#each entries as { collection, entity } (key(collection, entity))}
      <label
        ><input
          type="checkbox"
          bind:group={selected}
          value={key(collection, entity)}
        />{entity.title || 'Senza titolo'}
        <small
          >({collection === 'sources'
            ? 'fonte'
            : collection === 'insights'
              ? 'spunto'
              : 'materiale'})</small
        ></label
      >
    {/each}
  </div>
  <p>{selectedEntries.length} contenuti selezionati</p>
  <button
    disabled={busy || !selectedEntries.length}
    onclick={() => copy(questionsPrompt(speaker, data, selectedEntries))}
    >Copia prompt domande</button
  >
  {#if prompt}
    <label for="ai-prompt">Prompt pronto — {prompt.length.toLocaleString('it-IT')} caratteri</label>
    <textarea
      id="ai-prompt"
      readonly
      value={prompt}
      rows="8"
      onfocus={(event) => event.currentTarget.select()}></textarea>
    {#if prompt.length > 50000}<p class="warning">
        Il contesto è lungo. Puoi selezionare meno materiali prima di ricopiare il prompt. Nessun
        testo è stato troncato.
      </p>{/if}
  {/if}
  <h4>Importa i risultati Markdown</h4>
  <p>
    Ogni file o testo aggiunto crea un nuovo contenuto, marcato come generato dall’AI. Controlla
    l’anteprima prima di salvarlo. Le domande nel Markdown rimangono testo: non vengono aggiunte
    automaticamente alla scaletta.
  </p>
  <label for="ai-files">Carica uno o più file .md</label>
  <input
    id="ai-files"
    type="file"
    accept=".md,text/markdown"
    multiple
    disabled={busy || reading}
    onchange={files}
  />
  <label for="ai-markdown">Oppure incolla il risultato Markdown</label>
  <textarea id="ai-markdown" bind:value={pasted} rows="7" disabled={busy || reading}></textarea>
  <button disabled={busy || reading || !pasted.trim() || drafts.length >= 30} onclick={previewPaste}
    >Aggiungi all’anteprima</button
  >
  {#each drafts as record (record.id)}
    <section class="draft">
      <h4>{record.title}</h4>
      <ResearchReader text={String(record.bodyMd)} />
      <button
        disabled={busy}
        onclick={() => (drafts = drafts.filter((item) => item.id !== record.id))}
        >Rimuovi dall’anteprima</button
      >
    </section>
  {/each}
  {#if drafts.length}<button class="primary" disabled={busy || reading} onclick={save}
      >Conferma e salva {drafts.length} contenuti</button
    >{/if}
  {#if notice}<p role="status">{notice}</p>{/if}
  {#if failure}<p class="error" role="alert">{failure}</p>{/if}
</details>

<style>
  .research-assistant {
    padding: 1rem;
    margin: 1rem 0;
    border: 1px solid var(--line);
    border-radius: 10px;
  }
  summary {
    cursor: pointer;
    font-weight: 600;
    min-height: 44px;
  }
  label {
    display: block;
    margin-top: 0.75rem;
  }
  textarea {
    width: 100%;
    box-sizing: border-box;
  }
  .choices {
    max-height: 18rem;
    overflow-y: auto;
  }
  .choices label {
    display: flex;
    gap: 0.5rem;
    align-items: baseline;
    overflow-wrap: anywhere;
  }
  .choices input {
    flex-shrink: 0;
    width: auto;
  }
  .draft {
    margin: 1rem 0;
    padding: 1rem;
    border: 1px solid var(--line);
    max-height: 28rem;
    overflow: auto;
  }
  button {
    margin-top: 0.5rem;
  }
</style>
