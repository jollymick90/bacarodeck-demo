<script lang="ts">
  import { goto } from '$app/navigation';
  import Export from '$lib/components/Export.svelte';
  import { getWorkspace } from '$lib/workspace.svelte';
  const workspace = getWorkspace();
</script>

<svelte:head><title>Esporta · Gestione BacaroTech</title></svelte:head>
<Export uid={workspace.user!.uid} oncancel={() => goto('/backoffice/strumenti')} />
