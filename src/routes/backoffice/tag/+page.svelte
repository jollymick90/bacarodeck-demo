<script lang="ts">
  import { goto } from '$app/navigation';
  import TagUpdates from '$lib/components/TagUpdates.svelte';
  import { getWorkspace } from '$lib/workspace.svelte';
  import { commitChanges } from '$lib/repository';
  import type { Change } from '$lib/domain';
  const workspace = getWorkspace();
  let busy = $state(false);
  async function save(changes: Change[]) {
    busy = true;
    try {
      await commitChanges(workspace.client!.db, workspace.user!.uid, changes, 'manual');
      workspace.message = 'Tag aggiornati.';
      await goto('/backoffice');
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head><title>Tag · Backoffice BacaroTech</title></svelte:head>
<TagUpdates
  data={workspace.data}
  {busy}
  oncommit={save}
  oncancel={() => goto('/backoffice/strumenti')}
/>
