<script lang="ts">
  import ImportPage from '$lib/components/backoffice/ImportPage.svelte';
  let { data } = $props();
</script>

{#key `${data.preset}:${data.speakerId}`}<ImportPage {...data} />{/key}
