<script lang="ts">
  import Schedule from '$lib/components/Schedule.svelte';
  import { getWorkspace } from '$lib/workspace.svelte';
  import { commitChanges } from '$lib/repository';
  import type { Entity } from '$lib/fields';
  const workspace = getWorkspace();
  async function save(slot: Entity) {
    await commitChanges(workspace.client!.db, workspace.user!.uid, [
      { collection: 'interviewSlots', data: slot, expectedRevision: slot.revision ?? null }
    ]);
  }
</script>

<svelte:head><title>Programmazione · Backoffice BacaroTech</title></svelte:head>
<Schedule slots={workspace.data.interviewSlots || []} onsave={save} />
