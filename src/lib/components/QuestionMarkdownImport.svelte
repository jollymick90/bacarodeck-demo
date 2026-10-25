<script lang="ts">
  import type { Entity } from '$lib/fields';
  import { parseQuestionMarkdown } from '$lib/question-markdown-import';
  import Markdown from './Markdown.svelte';
  let {
    speakerId,
    existing,
    busy,
    onsave
  }: {
    speakerId: string;
    existing: Entity[];
    busy: boolean;
    onsave: (questions: Entity[]) => Promise<void>;
  } = $props();
  let text = $state('');
  let drafts = $state<Entity[]>([]);
  let selected = $state<string[]>([]);
  let working = $state(false);
  let failure = $state('');
  let message = $state('');
  let skipped = $state(0);
  const chosen = $derived(drafts.filter((q) => selected.includes(q.id)));
  async function preview() {
    working = true;
    failure = '';
    message = '';
    drafts = [];
    skipped = 0;
    try {
      const result = await parseQuestionMarkdown(text, speakerId, existing);
      drafts = result.questions;
      skipped = result.skipped;
      selected = drafts.map((q) => q.id);
      if (!drafts.length) message = 'Tutte le domande riconosciute sono già presenti.';
    } catch (error) {
      failure = (error as Error).message;
    } finally {
      working = false;
    }
  }
  async function save() {
    working = true;
    failure = '';
    try {
      const count = chosen.length;
      await onsave(chosen);
      drafts = [];
      selected = [];
      text = '';
      skipped = 0;
      message = `${count} domande aggiunte allo speaker. Puoi selezionarle nel tab Intervista.`;
    } catch (error) {
      failure = (error as Error).message;
    } finally {
      working = false;
    }
  }
</script>

<section aria-label="Importa domande da AI" class="question-import">
  <h4>Importa domande da GPT / Gemini</h4>
  <p>
    Incolla l’intera risposta Markdown. Riconosciamo domande IT/EN, follow-up, motivazioni e note.
    Le ripetizioni della scaletta consigliata vengono unite alle proposte.
  </p>
  <label for="question-markdown">Risposta con le domande</label>
  <textarea
    id="question-markdown"
    rows="8"
    bind:value={text}
    disabled={busy || working}
    oninput={() => {
      drafts = [];
      selected = [];
      skipped = 0;
      message = '';
      failure = '';
    }}></textarea>
  <button disabled={busy || working || !text.trim()} onclick={preview}
    >Mostra anteprima domande</button
  >
  {#if skipped}<p>{skipped} domande già presenti escluse dall’importazione.</p>{/if}
  {#if drafts.length}
    <p>
      {drafts.length} domande riconosciute. Scegli quali aggiungere come suggerite; la scaletta attuale
      rimane invariata.
    </p>
    {#each drafts as question, index (question.id)}
      <article>
        <label
          ><input
            type="checkbox"
            bind:group={selected}
            value={question.id}
            disabled={busy || working}
          />Importa domanda {index + 1}</label
        >
        {#if question.textIt}<h5>Italiano</h5>
          <Markdown text={String(question.textIt)} />{/if}
        {#if question.followUpIt}<p><strong>Follow-up IT:</strong> {question.followUpIt}</p>{/if}
        {#if question.textEn}<h5>English</h5>
          <Markdown text={String(question.textEn)} />{/if}
        {#if question.followUpEn}<p><strong>Follow-up EN:</strong> {question.followUpEn}</p>{/if}
        <details>
          <summary>Motivazione e note</summary><Markdown
            text={String(question.whyMd || '')}
          /><Markdown text={String(question.notesMd || '')} />
        </details>
      </article>
    {/each}
    <button class="primary" disabled={busy || working || !chosen.length} onclick={save}
      >Conferma e importa {chosen.length} domande</button
    >
  {/if}
  {#if message}<p role="status">{message}</p>
    <a href={`/backoffice/speaker/${encodeURIComponent(speakerId)}/intervista`}>Vai alle domande</a
    >{/if}
  {#if failure}<p role="alert">{failure}</p>{/if}
</section>

<style>
  .question-import {
    border-top: 1px solid var(--line);
    margin-top: 1rem;
    padding-top: 1rem;
  }
  textarea {
    width: 100%;
  }
  article {
    border: 1px solid var(--line);
    border-radius: 0.75rem;
    padding: 1rem;
    margin: 1rem 0;
    overflow-wrap: anywhere;
  }
  article > label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 700;
  }
  input[type='checkbox'] {
    width: auto;
  }
  h5 {
    margin-bottom: 0.25rem;
  }
</style>
