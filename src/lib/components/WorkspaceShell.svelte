<script lang="ts">
  import { onMount, type Snippet } from 'svelte';
  import { provideWorkspace } from '$lib/workspace.svelte';
  let { children }: { children: Snippet } = $props();
  const workspace = provideWorkspace();
  onMount(() => workspace.start());
</script>

<svelte:head><title>BacaroTech · Interview Hub</title></svelte:head>
<a class="skip-link" href="#main">Vai al contenuto</a>
<header class="masthead">
  <a class="brand" href="/" aria-label="BacaroTech Interview Hub"
    ><span class="brand-mark">b.</span><span>BacaroTech<small>Interview Hub</small></span></a
  >
  <div class="event">Codemotion Milano <strong>28–29 ottobre 2026</strong></div>
  {#if workspace.user}<button class="header-button" onclick={() => workspace.logout()}>Esci</button
    >{/if}
</header>
<main id="main">
  {#if workspace.access !== 'member'}
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
            L’accesso è riservato agli account Google abilitati. Usa un account autorizzato oppure
            chiedi al gestore di aggiungere la tua email.
          </p>
          <button onclick={() => location.reload()}>Riprova verifica accesso</button>
        </div>
      {:else}<button class="primary login" onclick={() => workspace.login()}
          >Accedi con Google</button
        ><small>Solo i membri abilitati possono leggere e modificare il workspace.</small>{/if}
    </section>
  {:else if !workspace.ready}<p role="status">Caricamento del workspace…</p>
  {:else}
    {#if !workspace.online}<p class="warning" role="status">
        Sei offline. Puoi leggere i dati già caricati in questa sessione. I salvataggi richiedono la
        rete.
      </p>{/if}
    {#if workspace.message}<p class="success" role="status">{workspace.message}</p>{/if}
    {@render children()}
  {/if}
  {#if workspace.error}<p class="error" role="alert">{workspace.error}</p>{/if}
</main>
<footer>BacaroTech · Codemotion Milano 2026 <span>Ricerca, confronto, conversazioni.</span></footer>
