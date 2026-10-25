<script lang="ts">
  import ActionHelp from '$lib/components/ActionHelp.svelte';
  import { backofficeActions } from '$lib/backoffice-navigation';
  import { getWorkspace } from '$lib/workspace.svelte';
  const workspace = getWorkspace();
  const groups = [
    { title: 'Contenuti', indices: [2, 3, 4, 5, 6] },
    { title: 'Esportazioni e backup', indices: [7, 8] },
    { title: 'Accessi', indices: [9] }
  ];
</script>

<svelte:head><title>Strumenti · Backoffice BacaroTech</title></svelte:head>
<section class="backoffice-tools">
  <h2>Strumenti</h2>
  <p>
    Importazioni, esportazioni e gestione del workspace. Apri le informazioni per capire quale
    strumento utilizzare.
  </p>
  <div class="tool-groups">
    {#each groups as group}{#if group.title !== 'Accessi' || workspace.superadmin}<section
          aria-label={group.title}
        >
          <h3>{group.title}</h3>
          {#each group.indices as index}{@const action = backofficeActions[index]}
            {#if index !== 6 || !workspace.data.speakers?.length}<div class="tool-action">
                <a class="button-link action-button" href={action.href}>{action.label}</a>
                <ActionHelp title={action.label} description={action.description} />
              </div>{/if}{/each}
        </section>{/if}{/each}
  </div>
</section>

<style>
  .tool-groups {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(245px, 1fr));
    gap: 1.5rem;
  }
  .tool-action {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    margin-bottom: 0.5rem;
  }
  .action-button {
    flex: 1;
  }
  @media (max-width: 650px) {
    .tool-groups {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
