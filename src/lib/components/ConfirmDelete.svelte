<script lang="ts">
  import { onMount } from 'svelte';
  let {
    title,
    busy,
    onconfirm,
    oncancel
  }: { title: string; busy: boolean; onconfirm: () => void; oncancel: () => void } = $props();
  let dialog: HTMLDialogElement;
  onMount(() => dialog.showModal());
</script>

<dialog
  bind:this={dialog}
  aria-labelledby="delete-title"
  oncancel={(e) => {
    e.preventDefault();
    if (!busy) oncancel();
  }}
>
  <h2 id="delete-title">Eliminare questo contenuto?</h2>
  <p>{title}</p>
  <p>
    L’eliminazione è definitiva. I contenuti collegati restano presenti e possono richiedere una
    correzione dei riferimenti.
  </p>
  <div class="form-actions">
    <button onclick={oncancel} disabled={busy}>Annulla</button><button
      class="danger"
      onclick={onconfirm}
      disabled={busy}>Elimina definitivamente</button
    >
  </div>
</dialog>
