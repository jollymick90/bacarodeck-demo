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
  let secondsRemaining = $state(3);

  $effect(() => {
    if (!message) return;
    const expiresAt = performance.now() + 3000;
    secondsRemaining = 3;
    const countdown = window.setInterval(() => {
      secondsRemaining = Math.max(0, Math.ceil((expiresAt - performance.now()) / 1000));
    }, 1000);
    // Read the latest callback when the timer fires, without making it a dependency.
    const timeout = window.setTimeout(() => ondismiss(), 3000);
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(countdown);
    };
  });
</script>

{#if message && !hidden}
  <div class="success" role="status">
    <span class="message">{message}</span>
    <span class="countdown" aria-hidden="true">{secondsRemaining} s</span>
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
  .message {
    flex: 1;
    min-width: 0;
  }
  .countdown {
    align-self: center;
    flex-shrink: 0;
    white-space: nowrap;
    font-size: 0.85rem;
  }
  button {
    flex-shrink: 0;
    min-width: 44px;
    min-height: 44px;
    padding: 0.25rem;
    color: inherit;
  }
</style>
