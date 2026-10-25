<script lang="ts">
  import ContentEditor from '$lib/components/backoffice/ContentEditor.svelte';
  let { data } = $props();
</script>

{#key `${data.collection}:${data.id || ''}:${data.speakerId}`}<ContentEditor {...data} />{/key}
