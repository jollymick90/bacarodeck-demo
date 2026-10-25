<script lang="ts">
  import AccessAdmin from '$lib/components/AccessAdmin.svelte';
  import { getWorkspace } from '$lib/workspace.svelte';
  const workspace = getWorkspace();
</script>

<svelte:head><title>Accessi · Backoffice BacaroTech</title></svelte:head>
{#if workspace.superadmin}<AccessAdmin />{:else}<h2>Accesso riservato agli amministratori</h2>
  <a href="/backoffice/strumenti">Torna agli strumenti</a>{/if}
