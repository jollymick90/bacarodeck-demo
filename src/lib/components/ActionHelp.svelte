<script lang="ts">
  let { title, description }: { title: string; description: string } = $props();
  let dialog: HTMLDialogElement;
</script>

<button
  type="button"
  class="action-help"
  aria-label={'Informazioni: ' + title}
  aria-haspopup="dialog"
  onclick={() => dialog.showModal()}><span aria-hidden="true">i</span></button
>
<dialog bind:this={dialog} aria-label={'Informazioni: ' + title}>
  <h2>{title}</h2>
  <p>{description}</p>
  <form method="dialog"><button type="submit" class="primary">Ho capito</button></form>
</dialog>

<style>
  .action-help {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 44px;
    width: 44px;
    height: 44px;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--muted);
  }
  .action-help span {
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    border: 1px solid currentColor;
    border-radius: 50%;
    font-size: 0.8rem;
    font-weight: 700;
  }
  .action-help:hover {
    color: var(--blue);
    background: #edf3fa;
  }
  dialog {
    max-height: 85dvh;
    overflow-y: auto;
  }
  h2 {
    margin-top: 0;
    font-size: 1.3rem;
  }
  p {
    line-height: 1.65;
  }
</style>
