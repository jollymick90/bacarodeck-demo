<script lang="ts">
  import { onMount } from 'svelte';
  import SuccessNotice from '../../../src/lib/components/SuccessNotice.svelte';

  let message = $state('Modifiche salvate.');
  let refreshes = $state(0);
  const dismiss = $derived.by(() => {
    // Recreate the callback as parent props can change independently of the notice.
    refreshes;
    return () => {
      message = '';
    };
  });
  onMount(() => {
    const timer = window.setInterval(() => {
      refreshes += 1;
    }, 250);
    return () => window.clearInterval(timer);
  });
</script>

<SuccessNotice {message} ondismiss={dismiss} />
<p>Aggiornamenti: {refreshes}</p>
<button onclick={() => (message = 'Seconda modifica salvata.')}>Nuova notifica</button>
