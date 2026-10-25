<script lang="ts">
  import { page } from '$app/state';
  import ConductorPage from '$lib/components/conductor/ConductorPage.svelte';
</script>

<ConductorPage mode="topic" topic={page.params.topic} />
