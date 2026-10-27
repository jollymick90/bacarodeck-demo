<script lang="ts">
  import { getWorkspace } from '$lib/workspace.svelte';
  const workspace = getWorkspace();
  import { untrack } from 'svelte';
  import { suggestSpeakerTags } from '$lib/tags';
  import type { Dataset } from '$lib/fields';
  import type { Change } from '$lib/domain';
  let {
    data,
    busy,
    oncommit,
    oncancel
  }: {
    data: Dataset;
    busy: boolean;
    oncommit: (changes: Change[]) => Promise<void>;
    oncancel: () => void;
  } = $props();
  // Freeze the preview and revisions so incoming polling updates cannot alter an approval.
  const proposals = untrack(() => suggestSpeakerTags(data));
  let selected = $state<string[]>([]);
  let failure = $state('');
  const key = (id: string, tag: string) => JSON.stringify([id, tag]);
  async function save() {
    failure = '';
    const changes: Change[] = proposals.flatMap((proposal) => {
      const additions = proposal.additions.filter((tag) =>
        selected.includes(key(proposal.speaker.id, tag))
      );
      if (!additions.length) return [];
      return [
        {
          collection: 'speakers',
          data: {
            ...proposal.speaker,
            tags: [...((proposal.speaker.tags as string[]) || []), ...additions]
          },
          expectedRevision: proposal.speaker.revision ?? null
        }
      ];
    });
    try {
      await oncommit(changes);
    } catch (e) {
      failure = (e as Error).message;
    }
  }
</script>

<section class="import-panel" aria-label="Aggiornamento tag">
  <div class="section-heading">
    <h2>Aggiorna tag speaker</h2>
    <button disabled={busy} onclick={oncancel}>Chiudi tag</button>
  </div>
  <p>
    Proposte basate su parole chiave nei titoli e negli abstract dei talk. Controlla la pertinenza
    prima di salvare: i tag esistenti vengono conservati.
  </p>
  <p>
    {proposals.length} speaker con nuovi tag proposti. Gli speaker senza indizi sufficienti non vengono
    modificati.
  </p>
  {#if proposals.length}<button
      disabled={busy}
      onclick={() =>
        (selected = proposals.flatMap((p) => p.additions.map((tag) => key(p.speaker.id, tag))))}
      >Seleziona tutti i tag proposti</button
    ><button disabled={busy} onclick={() => (selected = [])}>Deseleziona tutti</button>{/if}
  {#each proposals as proposal}<article class="diff-row">
      <h3>{proposal.speaker.fullName}</h3>
      <p>Tag attuali: {((proposal.speaker.tags as string[]) || []).join(', ') || 'Nessuno'}</p>
      {#each proposal.additions as tag}<label class="inline"
          ><input
            type="checkbox"
            bind:group={selected}
            value={key(proposal.speaker.id, tag)}
            disabled={busy}
          />{tag} <small>— parola chiave: {proposal.evidence[tag]}</small></label
        >{/each}
    </article>{/each}
  {#if failure}<p class="error" role="alert">{failure}</p>{/if}
  <button class="primary" disabled={workspace.readOnly || busy || !selected.length} onclick={save}
    >{busy ? 'Salvataggio…' : 'Conferma aggiornamento tag'}</button
  >
</section>
