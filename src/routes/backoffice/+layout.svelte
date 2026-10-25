<script lang="ts">
  import { page } from '$app/state';
  import BackofficeToolbar from '$lib/components/BackofficeToolbar.svelte';
  const contentEditor = $derived(
    /^\/backoffice\/(contenuti|nuovo)\/(materials|sources|insights|questions)(\/|$)/.test(
      page.url.pathname
    )
  );
  let { children } = $props();
</script>

{#if !page.url.pathname.startsWith('/backoffice/speaker/') && !contentEditor}<BackofficeToolbar
  />{/if}
{@render children()}
