<script lang="ts">
  import BackofficeToolbar from '$lib/components/BackofficeToolbar.svelte';
  let { children } = $props();
</script>

<BackofficeToolbar />
{@render children()}
