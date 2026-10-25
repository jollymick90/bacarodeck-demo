<script lang="ts">
  import { page } from '$app/state';
  import BackofficeToolbar from '$lib/components/BackofficeToolbar.svelte';
  const noteEditor = $derived(
    /^\/backoffice\/(contenuti|nuovo)\/(materials|sources|insights)(\/|$)/.test(page.url.pathname)
  );
  let { children } = $props();
</script>

{#if !page.url.pathname.startsWith('/backoffice/speaker/') && !noteEditor}<BackofficeToolbar />{/if}
{@render children()}
