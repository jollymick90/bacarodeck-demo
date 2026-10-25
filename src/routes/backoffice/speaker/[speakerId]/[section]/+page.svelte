<script lang="ts">
  import Backoffice from '$lib/components/backoffice/Backoffice.svelte';
  let { data } = $props();
</script>

{#key data.speakerId}<Backoffice
    selectedId={data.speakerId}
    tab={data.tab}
    tools={data.tools}
  />{/key}
