<script lang="ts">
  import { goto, beforeNavigate } from '$app/navigation';
  import WorkspaceBackup from '$lib/components/WorkspaceBackup.svelte';
  import { getWorkspace } from '$lib/workspace.svelte';
  import { refreshWorkspace } from '$lib/repository';
  const workspace = getWorkspace();
  let busy = $state(false);
  let navigationBlocked = $state(false);
  beforeNavigate(({ cancel }) => {
    if (busy) {
      cancel();
      navigationBlocked = true;
    }
  });
</script>

<svelte:head><title>Backup · Gestione BacaroTech</title></svelte:head>
{#if navigationBlocked}<p role="alert" class="warning">
    Operazione in corso. Attendi il completamento prima di cambiare pagina.
  </p>{/if}
<WorkspaceBackup
  superadmin={workspace.superadmin}
  onbusychange={(value) => {
    busy = value;
    if (!value) navigationBlocked = false;
  }}
  oncancel={() => goto('/backoffice/strumenti')}
  onrestored={() => {
    refreshWorkspace();
    workspace.message = 'Backup ripristinato.';
  }}
/>
