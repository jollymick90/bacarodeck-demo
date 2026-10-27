<script lang="ts">
  import type { Entity } from '$lib/fields';
  import { getWorkspace } from '$lib/workspace.svelte';
  const workspace = getWorkspace();
  const assignees = $derived(workspace.assignees);
  import { assignmentOwner } from '$lib/conductor/assignment';
  import { api, refreshWorkspace } from '$lib/repository';
  let { speaker, plan }: { speaker: Entity; plan?: Entity } = $props();
  let dialog: HTMLDialogElement;
  let target = $state('');
  let expected = $state('');
  let revision = $state<number | null>(null);
  let failure = $state('');
  let busy = $state(false);
  const owner = $derived(assignmentOwner(plan));
  const ownerName = $derived(
    assignees.find((t) => t.id === owner || (t.uid && t.uid === owner))?.displayName ||
      String(plan?.assignedToName || owner || 'Da assegnare')
  );
  function open() {
    expected = owner;
    revision = plan?.revision ?? null;
    target =
      assignees.find((t) => t.id === owner || (t.uid && t.uid === owner))?.id ||
      assignees[0]?.id ||
      '';
    failure = '';
    dialog.showModal();
  }
  async function save() {
    busy = true;
    failure = '';
    try {
      await api('/api/conductor/assignment', {
        speakerId: speaker.id,
        teamId: target,
        expectedOwner: expected,
        expectedPlanRevision: revision,
        confirmReplacement: !!expected && expected !== target
      });
      refreshWorkspace();
      dialog.close();
    } catch (e) {
      failure = (e as Error).message;
      refreshWorkspace();
    } finally {
      busy = false;
    }
  }
</script>

<div class="assignment-control">
  <span>Assegnazione: <strong>{ownerName}</strong></span><button
    disabled={workspace.readOnly}
    onclick={open}>Assegna / cambia</button
  >
</div>
<dialog bind:this={dialog} aria-labelledby={'assign-' + speaker.id}>
  <h2 id={'assign-' + speaker.id}>Assegna l’intervista</h2>
  <p>{speaker.fullName} · assegnazione attuale: <strong>{ownerName}</strong></p>
  <label
    >Conduttore<select aria-label="Conduttore" bind:value={target}
      >{#each assignees as t}<option value={t.id}>{t.displayName} · {t.email}</option
        >{/each}</select
    ></label
  >
  {#if !assignees.length}<p>Nessun account abilitato disponibile.</p>{/if}
  {#if expected && expected !== target}<p class="warning">
      Confermando sostituirai l’assegnatario con {assignees.find((t) => t.id === target)
        ?.displayName}. Gli interessi restano invariati.
    </p>{/if}
  {#if failure}<p role="alert">{failure}</p>
    <button
      onclick={() => {
        expected = owner;
        revision = plan?.revision ?? null;
        failure = '';
      }}>Aggiorna riepilogo</button
    >{/if}
  <div class="entry-actions">
    <button disabled={busy} onclick={() => dialog.close()}>Annulla</button><button
      class="primary"
      disabled={workspace.readOnly || busy || !!failure || !assignees.some((t) => t.id === target)}
      onclick={save}
      >{expected && expected !== target
        ? 'Conferma riassegnazione'
        : 'Conferma assegnazione'}</button
    >
  </div>
</dialog>

<style>
  .assignment-control {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    margin: 18px 0;
    padding: 14px;
    background: #e9eee2;
    border-radius: 12px;
  }
  dialog {
    max-width: 430px;
    width: calc(100% - 24px);
    border: 1px solid #bcc8b7;
    border-radius: 16px;
    padding: 22px;
  }
  dialog::backdrop {
    background: #18382c88;
  }
  button,
  select {
    min-height: 44px;
  }
</style>
