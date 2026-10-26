<script lang="ts">
  let {
    message,
    ondismiss,
    hidden = false
  }: {
    message: string;
    ondismiss: () => void;
    hidden?: boolean;
  } = $props();

  $effect(() => {
    if (!message) return;
    const timeout = window.setTimeout(ondismiss, 4000);
    return () => window.clearTimeout(timeout);
  });
</script>

{#if message && !hidden}
  <div class="success" role="status">
    <span>{message}</span>
    <button type="button" class="quiet" aria-label="Chiudi notifica" onclick={ondismiss}>×</button>
  </div>
{/if}

<style>
  .success {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }
  button {
    flex-shrink: 0;
    min-width: 44px;
    min-height: 44px;
    padding: 0.25rem;
    color: inherit;
  }
</style>
