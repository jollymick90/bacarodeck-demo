<script lang="ts">
  import { page } from '$app/state';
  import BackofficeToolbar from '$lib/components/BackofficeToolbar.svelte';
  let { children } = $props();
</script>

{#if !page.url.pathname.startsWith('/backoffice/speaker/')}<BackofficeToolbar />{/if}
{@render children()}
