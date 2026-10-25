<script lang="ts">
  import '../app.css';
  import WorkspaceShell from '$lib/components/WorkspaceShell.svelte';
  let { children } = $props();
</script>

<WorkspaceShell>{@render children()}</WorkspaceShell>
