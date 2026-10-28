<script lang="ts">
  import { page } from '$app/state';
  import { onMount, type Snippet } from 'svelte';
  import AppHeader from './AppHeader.svelte';
  import AppNavigation from './AppNavigation.svelte';
  import OfflineStatus from './OfflineStatus.svelte';
  import SuccessNotice from './SuccessNotice.svelte';
  import PasswordLogin from './PasswordLogin.svelte';
  import { provideWorkspace } from '$lib/workspace.svelte';
  let { children }: { children: Snippet } = $props();
  const workspace = provideWorkspace();
  onMount(() => workspace.start());
  const immersive = $derived(
    workspace.ready && /^\/speaker\/[^/]+\/intervista\/?$/.test(page.url.pathname)
  );
</script>

<svelte:head><title>BacaroTech · Interview Hub</title></svelte:head>
{#if !immersive}<a class="skip-link" href="#main">Vai al contenuto</a>
  <AppHeader user={workspace.user} onlogout={() => workspace.logout()} />{/if}
<main
  id="main"
  class:immersive
  class:with-subnavigation={page.url.pathname.startsWith('/backoffice')}
>
  {#if !workspace.canRead}
    <section class="welcome">
      <p class="edition">Il tavolo di lavoro delle interviste</p>
      <h1>Le conversazioni migliori<br />cominciano prima.</h1>
      <p>
        Fonti, appunti e domande in un unico posto. Prepariamo insieme le interviste di BacaroTech,
        entro il 27 ottobre.
      </p>
      {#if workspace.access === 'loading'}<p role="status">Verifica accesso…</p>
      {:else if workspace.access === 'setup'}<div class="notice">
          <h2>Collega il workspace</h2>
          <p>Configura le variabili Firebase nel file .env e riavvia l’app.</p>
        </div>
      {:else if workspace.access === 'denied'}<div class="notice">
          <h2>Accesso non abilitato</h2>
          <p>
            L’accesso è riservato agli account abilitati. Usa un account autorizzato oppure chiedi
            al gestore di aggiungere la tua email.
          </p>
          <button onclick={() => location.reload()}>Riprova verifica accesso</button>
        </div>
      {:else}{#if !workspace.online}<p class="notice">
            Nessuna copia offline disponibile. Accedi e prepara questo dispositivo quando hai una
            connessione.
          </p>{/if}<button class="primary login" onclick={() => workspace.login()}
          >Accedi con Google</button
        ><PasswordLogin /><small
          >Solo i membri abilitati possono leggere e modificare il workspace.</small
        >{/if}
    </section>
  {:else if !workspace.ready}<p role="status">Caricamento del workspace…</p>
  {:else}
    {#if workspace.checkingAccess}<p role="status">Verifica accesso…</p>{/if}
    <div
      hidden={workspace.checkingAccess}
      style:visibility={workspace.checkingAccess ? 'hidden' : undefined}
    >
      {#if !immersive}<OfflineStatus />{/if}
      <SuccessNotice
        message={workspace.message}
        hidden={immersive}
        ondismiss={() => (workspace.message = '')}
      />
      {@render children()}
    </div>
  {/if}
  {#if workspace.error && !immersive}<p class="error" role="alert">{workspace.error}</p>{/if}
</main>
{#if !immersive}<AppNavigation />{/if}

<style>
  main {
    padding-bottom: calc(96px + env(safe-area-inset-bottom, 0px));
  }
  main.immersive {
    padding: 0;
    margin: 0;
    max-width: none;
  }
  main.with-subnavigation {
    padding-bottom: calc(144px + env(safe-area-inset-bottom, 0px));
  }
</style>
