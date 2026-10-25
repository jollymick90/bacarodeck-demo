<script lang="ts">
  import Markdown from '../Markdown.svelte';
  import type { Entity } from '$lib/fields';
  let {
    speakerId,
    materialId,
    oncreate
  }: { speakerId: string; materialId: string; oncreate: (question: Entity) => Promise<void> } =
    $props();
  let text = $state('');
  let language = $state('it');
  let preview = $state(false);
  let busy = $state(false);
  let failure = $state('');
  let message = $state('');
  async function save() {
    busy = true;
    failure = '';
    try {
      if (!text.trim()) throw Error('Incolla la domanda da aggiungere.');
      await oncreate({
        id: crypto.randomUUID(),
        speakerId,
        [language === 'it' ? 'textIt' : 'textEn']: text,
        materialIds: [materialId],
        status: 'suggested'
      });
      message = 'Domanda aggiunta all’elenco condiviso. Il materiale originale è conservato.';
      text = '';
      preview = false;
    } catch (e) {
      failure = (e as Error).message;
    } finally {
      busy = false;
    }
  }
</script>

<details>
  <summary>Porta una domanda nella scaletta</summary>
  <p>
    Incolla il testo della domanda da questo materiale. Potrai poi selezionarla tra le principali.
  </p>
  <label
    >Lingua della domanda<select bind:value={language}
      ><option value="it">Italiano</option><option value="en">English</option></select
    ></label
  ><label
    >Domanda dalla ricerca<textarea bind:value={text} oninput={() => (preview = false)} rows="4"
    ></textarea></label
  ><button disabled={!text.trim() || busy} onclick={() => (preview = true)}
    >Controlla anteprima domanda</button
  >{#if preview}<Markdown {text} /><button class="primary" disabled={busy} onclick={save}
      >Conferma e aggiungi domanda</button
    >{/if}{#if failure}<p role="alert">{failure}</p>{/if}{#if message}<p role="status">
      {message}
    </p>{/if}
</details>
