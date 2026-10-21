<script lang="ts">
  import { onMount, tick } from 'svelte';
  import ResearchAssistant from '$lib/components/ResearchAssistant.svelte';
  import { researchEntries } from '$lib/research';
  const tabLabels = { ...labels, materials: 'Ricerca' };
  import InterviewBadges from '$lib/components/InterviewBadges.svelte';
  import WorkspaceBackup from '$lib/components/WorkspaceBackup.svelte';
  let fullBackup = $state(false);
  import Export from '$lib/components/Export.svelte';
  let exporting = $state(false);
  import TagUpdates from '$lib/components/TagUpdates.svelte';
  let updatingTags = $state(false);
  async function saveTags(changes: Change[]) {
    await importChanges(changes, 'manual');
    updatingTags = false;
  }
  import { isInInterviewList } from '$lib/interview-list';
  import { searchSpeakers } from '$lib/speaker-search';
  import {
    GoogleAuthProvider,
    onAuthStateChanged,
    signInWithPopup,
    signOut,
    type User
  } from 'firebase/auth';
  import type { Unsubscribe } from 'firebase/firestore';
  import { getFirebase } from '$lib/firebase';
  import { basePath, commitChanges, removeEntity, watchCollection } from '$lib/repository';
  import {
    collections,
    labels,
    emptyEntity,
    translate,
    type Collection,
    type Dataset,
    type Entity
  } from '$lib/fields';
  import { safeUrl, provenanceLabel, type Change } from '$lib/domain';
  import { team } from '$lib/team';
  import QuestionRating from '$lib/components/QuestionRating.svelte';
  import { refreshData, refreshWorkspace, restorePersonalRatings } from '$lib/repository';
  let sortByRating = $state(false);
  import Schedule from '$lib/components/Schedule.svelte';
  let showSchedule = $state(false);
  async function saveSlot(slot: Entity) {
    if (!client || !user) return;
    await commitChanges(client.db, user.uid, [
      { collection: 'interviewSlots', data: slot, expectedRevision: slot.revision ?? null }
    ]);
  }
  import AccessAdmin from '$lib/components/AccessAdmin.svelte';
  let superadmin = $state(false);
  let managingAccess = $state(false);
  import ConfirmDelete from '$lib/components/ConfirmDelete.svelte';
  import Markdown from '$lib/components/Markdown.svelte';
  import Editor from '$lib/components/Editor.svelte';
  import Import from '$lib/components/Import.svelte';
  let client: ReturnType<typeof getFirebase> = null;
  let user = $state<User | null>(null);
  let access = $state<'loading' | 'setup' | 'login' | 'denied' | 'member'>('loading');
  let data = $state<Dataset>({});
  let members = $state<Entity[]>([]);
  let loaded = $state<string[]>([]);
  let selectedId = $state('');
  let query = $state('');
  let mobileDetail = $state(false);
  let listPosition = 0;
  let directory = $state('in');
  let priorityOnly = $state(false);
  async function openSpeaker(id: string) {
    listPosition = window.scrollY;
    selectedId = id;
    tab = 'materials';
    mobileDetail = true;
    await tick();
    if (window.matchMedia('(max-width: 650px)').matches) {
      document.getElementById('speaker-title')?.focus();
      window.scrollTo(0, 0);
    }
  }
  async function backToSpeakers() {
    mobileDetail = false;
    await tick();
    document.getElementById('speaker-' + selectedId)?.focus({ preventScroll: true });
    window.scrollTo(0, listPosition);
  }
  let tag = $state('');
  let prep = $state('');
  let assignee = $state('');
  let tab = $state<Collection>('materials');
  let language = $state<'it' | 'en'>('it');
  let editing = $state<{ collection: Collection; entity: Entity } | null>(null);
  let deleting = $state<{ collection: Collection; entity: Entity } | null>(null);
  let importing = $state(false);
  let importText = $state('');
  let busy = $state(false);
  let online = $state(true);
  let message = $state('');
  let error = $state('');
  let unsubs: Unsubscribe[] = [];
  const speakers = $derived(data.speakers || []);
  const ready = $derived(loaded.length === collections.length + 1);
  const tags = $derived([...new Set(speakers.flatMap((s) => (s.tags as string[]) || []))].sort());
  const filtered = $derived(
    searchSpeakers(speakers, query).filter((s) => {
      const plan = data.interviewPlans?.find((p) => p.speakerId === s.id);
      return (
        (!priorityOnly || s.priority === true) &&
        (!directory || (directory === 'in' ? isInInterviewList(s) : !isInInterviewList(s))) &&
        (!tag || ((s.tags as string[]) || []).includes(tag)) &&
        (!prep || plan?.status === prep) &&
        (!assignee || plan?.assignedToUid === assignee)
      );
    })
  );
  const speaker = $derived(speakers.find((s) => s.id === selectedId));
  const plan = $derived(data.interviewPlans?.find((p) => p.speakerId === selectedId));
  const related = $derived(
    tab === 'materials'
      ? researchEntries(data, selectedId)
      : (data[tab] || [])
          .filter((e) => {
            if (tab === 'speakers') return e.id === selectedId;
            if (tab === 'sources')
              return (
                ((speaker?.sourceIds as string[]) || []).includes(e.id) ||
                ((e.speakerIds as string[]) || []).includes(selectedId)
              );
            return (
              e.speakerId === selectedId || ((e.speakerIds as string[]) || []).includes(selectedId)
            );
          })
          .toSorted((a, b) => {
            const average = (e: Entity) => {
              const votes = Object.values((e.ratings || {}) as Record<string, number>);
              return votes.length ? votes.reduce((x, y) => x + y, 0) / votes.length : 0;
            };
            return tab === 'questions' && sortByRating
              ? average(b) - average(a)
              : Number(a.order || 0) - Number(b.order || 0);
          })
          .map((entity) => ({ collection: tab, entity }))
  );
  function stop() {
    unsubs.forEach((fn) => fn());
    unsubs = [];
  }
  function clear() {
    fullBackup = false;
    exporting = false;
    superadmin = false;
    managingAccess = false;
    updatingTags = false;
    data = {};
    members = [];
    loaded = [];
    selectedId = '';
    editing = null;
    deleting = null;
    importing = false;
  }
  function fail(e: unknown) {
    error = e instanceof Error ? e.message : String(e);
  }
  function denied(e?: unknown) {
    stop();
    clear();
    access = 'denied';
    if (e) fail(e);
  }
  onMount(() => {
    online = navigator.onLine;
    const updateNetwork = () => (online = navigator.onLine);
    window.addEventListener('online', updateNetwork);
    window.addEventListener('offline', updateNetwork);
    client = getFirebase();
    if (!client) {
      access = 'setup';
      return () => {
        window.removeEventListener('online', updateNetwork);
        window.removeEventListener('offline', updateNetwork);
      };
    }
    const firebase = client;
    let refreshTimer: ReturnType<typeof setInterval> | undefined;
    let generation = 0;
    let verifyingGeneration: number | null = null;
    async function verifyAccess(current: User, version: number) {
      if (verifyingGeneration === version) return;
      verifyingGeneration = version;
      try {
        const response = await fetch('/api/access', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + (await current.getIdToken()) },
          cache: 'no-store'
        });
        const result = await response.json();
        if (version !== generation) return;
        if (!response.ok) {
          if (response.status >= 500 && access === 'member') {
            fail(new Error(result.message || 'Verifica accesso temporaneamente non disponibile.'));
            return;
          }
          denied(new Error(result.message || result.error || 'Accesso non consentito.'));
          return;
        }
        error = '';
        superadmin = result.superadmin === true;
        if (access === 'member') return;
        access = 'member';
        for (const name of [...collections, 'members'] as const) {
          unsubs.push(
            watchCollection(
              firebase.db,
              name,
              (entities, cached) => {
                if (version !== generation || access !== 'member') return;
                if (name === 'members') members = entities;
                else data[name] = entities;
                if (!cached && !loaded.includes(name)) loaded = [...loaded, name];
              },
              denied
            )
          );
        }
      } catch {
        if (version === generation) {
          if (access === 'member')
            error =
              'Controllo accesso temporaneamente non disponibile. La bozza è conservata; riprova quando torna la connessione.';
          else
            denied(new Error('Serve una connessione per verificare ALLOW_LIST. Riprova tra poco.'));
        }
      } finally {
        if (verifyingGeneration === version) verifyingGeneration = null;
      }
    }
    const authUnsub = onAuthStateChanged(firebase.auth, (current) => {
      const version = ++generation;
      clearInterval(refreshTimer);
      stop();
      clear();
      error = '';
      user = current;
      if (!current) {
        access = 'login';
        return;
      }
      access = 'loading';
      void verifyAccess(current, version);
      refreshTimer = setInterval(() => void verifyAccess(current, version), 60_000);
    });
    return () => {
      authUnsub();
      generation++;
      clearInterval(refreshTimer);
      stop();
      window.removeEventListener('online', updateNetwork);
      window.removeEventListener('offline', updateNetwork);
    };
  });
  async function login() {
    if (!client) return;
    error = '';
    try {
      await signInWithPopup(client.auth, new GoogleAuthProvider());
    } catch (e) {
      fail(e);
    }
  }
  async function logout() {
    if (client) await signOut(client.auth);
  }
  function edit(collection: Collection, entity?: Entity) {
    updatingTags = false;
    editing = { collection, entity: entity ?? emptyEntity(collection, selectedId || undefined) };
    message = '';
  }
  async function saveResearch(records: Entity[]) {
    if (!client || !user) throw new Error('Accedi prima di salvare.');
    if (new TextEncoder().encode(JSON.stringify(records)).length > 2_000_000) {
      throw new Error('Anteprima troppo grande: salva meno documenti per volta (massimo 2 MB).');
    }
    busy = true;
    try {
      await commitChanges(
        client.db,
        user.uid,
        records.map((entity) => ({
          collection: 'materials' as const,
          data: entity,
          expectedRevision: null
        }))
      );
      message = 'Ricerca salvata.';
    } finally {
      busy = false;
    }
  }
  async function save(entity: Entity) {
    if (!client || !user || !editing) return;
    busy = true;
    try {
      await commitChanges(client.db, user.uid, [
        {
          collection: editing.collection,
          data: entity,
          expectedRevision: editing.entity.revision ?? null
        }
      ]);
      message = 'Modifiche salvate.';
      editing = null;
    } finally {
      busy = false;
    }
  }
  async function importChanges(
    changes: Change[],
    origin: 'manual' | 'import' = 'import',
    votes: { questionId: string; score: number }[] = []
  ) {
    if (!client || !user) return;
    busy = true;
    try {
      await commitChanges(client.db, user.uid, changes, origin);
      try {
        await restorePersonalRatings(votes);
      } catch (failure) {
        throw new Error(
          `Documenti salvati, ma ripristino dei voti incompleto. Riapri il file e ripristina i voti rimasti: ${failure instanceof Error ? failure.message : String(failure)}`
        );
      }
      message = `Importazione completata: ${changes.length} documenti salvati, ${votes.length} voti ripristinati.`;
      importing = false;
    } finally {
      busy = false;
    }
  }
  async function prepareQuestions() {
    updatingTags = false;
    if (!speaker) return;
    const { draftQuestions } = await import('$lib/questions');
    const talk = data.talks?.find((t) => ((t.speakerIds as string[]) || []).includes(speaker.id));
    const response = await fetch('/api/questions/deleted', {
      headers: { Authorization: 'Bearer ' + (await user?.getIdToken()) }
    });
    if (!response.ok) {
      fail(new Error('Impossibile controllare le domande eliminate.'));
      return;
    }
    const deleted: string[] = await response.json();
    const questions = draftQuestions(
      speaker,
      talk,
      (data.materials || []).filter((m) => ((m.speakerIds as string[]) || []).includes(speaker.id))
    ).filter(
      (q) =>
        !deleted.includes(q.id) && !(data.questions || []).some((existing) => existing.id === q.id)
    );
    importText = JSON.stringify({ schemaVersion: 1, questions }, null, 2);
    importing = true;
  }
  async function loadTranslations() {
    updatingTags = false;
    const catalog = (await import('../../data/seed/catalog.json')).default;
    const { prepareTranslationImport } = await import('$lib/translations');
    const result = prepareTranslationImport(catalog as unknown as Dataset, data);
    importText = JSON.stringify(result.data, null, 2);
    message = `Traduzioni mancanti: ${(result.data.speakers?.length || 0) + (result.data.talks?.length || 0)} schede. Escluse ${result.changedSources} con originale modificato e ${result.reviewedSkipped} già verificate.`;
    importing = true;
  }
  async function loadCatalog() {
    updatingTags = false;
    const catalog = (await import('../../data/seed/catalog.json')).default;
    const missing: Record<string, unknown> = { schemaVersion: 1 };
    for (const name of collections) {
      const incoming = (catalog as unknown as Dataset)[name] || [];
      missing[name] = incoming.filter(
        (item) => !(data[name] || []).some((existing) => existing.id === item.id)
      );
    }
    importText = JSON.stringify(missing, null, 2);
    importing = true;
  }
  async function loadSeed() {
    error = '';
    try {
      const seed = await import('../../data/seed/seed_five.json');
      importText = JSON.stringify(seed.default, null, 2);
      importing = true;
    } catch (e) {
      fail(e);
    }
  }
  async function confirmDelete() {
    if (!client || !deleting) return;
    busy = true;
    error = '';
    try {
      await removeEntity(client.db, deleting.collection, deleting.entity);
      message = 'Contenuto eliminato.';
      if (deleting.collection === 'speakers') selectedId = '';
      deleting = null;
    } catch (e) {
      fail(e);
    } finally {
      busy = false;
    }
  }
  const display = (value: unknown) => (typeof value === 'string' ? value : '');
  const title = (e: Entity) =>
    display(e.title) ||
    display(e.fullName) ||
    display(language === 'it' ? e.textIt : e.textEn) ||
    'Senza titolo';
</script>

<svelte:head
  ><title>BacaroTech · Interview Hub</title><meta
    name="description"
    content="Il tavolo di lavoro BacaroTech per preparare le interviste a Codemotion Milano 2026."
  /></svelte:head
>
<a class="skip-link" href="#main">Vai al contenuto</a>
<header class="masthead">
  <a class="brand" href="/" aria-label="BacaroTech Interview Hub"
    ><span class="brand-mark">b.</span><span>BacaroTech<small>Interview Hub</small></span></a
  >
  <div class="event">Codemotion Milano <strong>28–29 ottobre 2026</strong></div>
  {#if user}<button class="header-button" onclick={logout}>Esci</button>{/if}
</header>
<main id="main">
  {#if access !== 'member'}
    <section class="welcome">
      <p class="edition">Il tavolo di lavoro delle interviste</p>
      <h1>Le conversazioni migliori<br />cominciano prima.</h1>
      <p>
        Fonti, appunti e domande in un unico posto. Prepariamo insieme le interviste di BacaroTech,
        entro il 27 ottobre.
      </p>
      {#if access === 'loading'}<p role="status">Verifica accesso…</p>
      {:else if access === 'setup'}<div class="notice">
          <h2>Collega il workspace</h2>
          <p>
            La configurazione Firebase non è ancora presente. Copia <code>.env.example</code> in
            <code>.env</code>, inserisci la configurazione web del progetto scelto e riavvia l’app.
          </p>
          <p>
            Le istruzioni per Google e per l’accesso dei membri sono nel README del progetto. Nessun
            dato viene caricato prima della verifica di accesso.
          </p>
        </div>
      {:else if access === 'denied'}<div class="notice">
          <h2>Accesso non abilitato</h2>
          <p>
            L’accesso è riservato agli account Google presenti nella configurazione privata
            ALLOW_LIST. Usa un account autorizzato oppure chiedi al gestore di aggiungere la tua
            email alla lista.
          </p>
          <button onclick={() => location.reload()}>Riprova verifica accesso</button>
        </div>
      {:else}<button class="primary login" onclick={login}>Accedi con Google</button><small
          >Solo i membri abilitati possono leggere e modificare il workspace.</small
        >{/if}
    </section>
  {:else}
    <div class="workspace-toolbar">
      <div>
        <h1>Prepariamo le interviste.</h1>
        <p>Ricerca condivisa · preparazione entro il 27 ottobre</p>
      </div>
      <div class="toolbar-actions">
        <button disabled={!ready || busy} onclick={() => (fullBackup = !fullBackup)}
          >Export / import completo</button
        >
        <button disabled={!ready || busy} onclick={() => (exporting = !exporting)}
          >{exporting ? 'Chiudi export' : 'Esporta il mio lavoro'}</button
        >
        <button
          disabled={!ready || busy}
          onclick={() => {
            updatingTags = true;
            importing = false;
            editing = null;
          }}>Aggiorna tag</button
        >
        <button disabled={!ready || busy} onclick={loadTranslations}
          >Importa traduzioni IT/EN</button
        >
        <button onclick={() => (showSchedule = !showSchedule)}
          >{showSchedule ? 'Chiudi programmazione' : 'Programmazione'}</button
        >
        <button disabled={!ready || busy} onclick={loadCatalog}>Importa tutti gli 84 speaker</button
        >
        {#if superadmin}<button onclick={() => (managingAccess = !managingAccess)}
            >{managingAccess ? 'Chiudi accessi' : 'Gestisci accessi'}</button
          >{/if}
        <button
          onclick={() => {
            updatingTags = false;
            importText = '';
            importing = true;
            editing = null;
          }}
          disabled={!ready || busy}>Importa JSON</button
        ><button onclick={() => edit('speakers')} disabled={!ready || busy}>Aggiungi speaker</button
        >
      </div>
    </div>
    {#if !online}<p class="warning" role="status">
        Sei offline. Puoi leggere i dati già caricati in questa sessione. I salvataggi sono
        disabilitati; i dati non ancora caricati non sono disponibili.
      </p>{/if}
    {#if !ready}<p role="status">Caricamento del workspace…</p>{/if}
    {#if message}<p class="success" role="status">{message}</p>{/if}
    {#if showSchedule}<Schedule slots={data.interviewSlots || []} onsave={saveSlot} />{/if}
    {#if managingAccess && superadmin}<AccessAdmin />{/if}
    {#if fullBackup}<WorkspaceBackup
        {superadmin}
        onbusychange={(value) => (busy = value)}
        oncancel={() => (fullBackup = false)}
        onrestored={() => {
          refreshWorkspace();
          message = 'Backup ripristinato.';
        }}
      />{/if}
    {#if exporting}<Export uid={user!.uid} oncancel={() => (exporting = false)} />{/if}
    {#if updatingTags}<TagUpdates
        {data}
        {busy}
        oncommit={saveTags}
        oncancel={() => (updatingTags = false)}
      />{:else if importing}<Import
        {data}
        initial={importText}
        {busy}
        oncommit={importChanges}
        oncancel={() => (importing = false)}
      />
    {:else if editing}{#key editing.entity.id + editing.collection}<Editor
          collection={editing.collection}
          entity={editing.entity}
          {members}
          {busy}
          onsave={save}
          oncancel={() => (editing = null)}
        />{/key}
    {:else}
      <div class="workspace-grid" class:mobile-detail={mobileDetail}>
        <aside class="speaker-list" aria-label="Elenco speaker">
          <div class="list-heading"><h2>Speaker <span>{speakers.length}</span></h2></div>
          <label for="search">Cerca nome, organizzazione o tag</label><input
            id="search"
            type="search"
            placeholder="Chi intervistiamo?"
            bind:value={query}
          />
          <details class="search-filters">
            <summary>Filtri speaker</summary>
            <label><input type="checkbox" bind:checked={priorityOnly} /> Solo prioritari</label>
            <label
              >Elenco interviste<select bind:value={directory}
                ><option value="">Tutti</option><option value="in">In elenco</option><option
                  value="out">Fuori elenco</option
                ></select
              ></label
            >
            <div class="filters">
              <label
                >Tag<select bind:value={tag}
                  ><option value="">Tutti i tag</option>{#each tags as t}<option>{t}</option
                    >{/each}</select
                ></label
              ><label
                >Preparazione<select bind:value={prep}
                  ><option value="">Tutti gli stati</option
                  >{#each ['not_started', 'researching', 'ready', 'done'] as state}<option
                      value={state}>{translate(state)}</option
                    >{/each}</select
                ></label
              >
            </div>
            <label
              >Intervistatore<select bind:value={assignee}
                ><option value="">Tutti i membri</option
                >{#each [...team.filter((m) => m.role === 'interview'), ...members] as m}<option
                    value={m.id}>{m.displayName || m.id}</option
                  >{/each}</select
              ></label
            >
          </details>
          <div class="search-summary">
            <span role="status">{filtered.length} di {speakers.length} speaker</span>
            {#if query || tag || prep || assignee || directory || priorityOnly}<button
                onclick={() => {
                  query = '';
                  tag = '';
                  prep = '';
                  assignee = '';
                  directory = '';
                  priorityOnly = false;
                }}>Azzera ricerca</button
              >{/if}
          </div>
          <nav aria-label="Scegli speaker">
            {#each filtered as s}<button
                class:active={s.id === selectedId}
                class="speaker-row"
                id={'speaker-' + s.id}
                onclick={() => openSpeaker(s.id)}
                aria-current={s.id === selectedId ? 'true' : undefined}
                ><span class="avatar"
                  >{display(s.fullName)
                    .split(' ')
                    .map((w) => w[0])
                    .slice(0, 2)
                    .join('')}</span
                ><span
                  ><strong>{s.fullName}</strong>{#if s.isKeynote}<span class="keynote-badge"
                      >Keynote</span
                    >{/if}<small>{s.organization || 'Organizzazione da verificare'}</small
                  ><InterviewBadges
                    plan={data.interviewPlans?.find((p) => p.speakerId === s.id)}
                  /></span
                ><span aria-hidden="true">›</span></button
              >{/each}
          </nav>
          {#if ready && !filtered.length}<p class="muted">
              {speakers.length
                ? 'Nessun risultato. Prova un altro nome o filtro.'
                : 'Il workspace è vuoto.'}
            </p>{/if}
          {#if ready && !speakers.length}<button class="primary" onclick={loadSeed}
              >Prepara import dei 5 speaker</button
            >
            <p class="muted">Potrai controllare tutti i dati prima di confermare.</p>{/if}
        </aside>
        <section class="speaker-detail" aria-label="Scheda speaker">
          {#if speaker}
            <button class="back-speakers" onclick={backToSpeakers}>← Torna agli speaker</button>
            <div class="speaker-heading">
              {#if speaker.photoUrl && safeUrl(speaker.photoUrl)}<img
                  class="portrait"
                  src={display(speaker.photoUrl)}
                  alt={'Foto pubblica di ' + speaker.fullName}
                  referrerpolicy="no-referrer"
                />{/if}
              <div>
                <p class="muted">Scheda di preparazione</p>
                <div class="language">
                  <button onclick={() => (language = 'it')} aria-pressed={language === 'it'}
                    >Italiano</button
                  ><button onclick={() => (language = 'en')} aria-pressed={language === 'en'}
                    >English</button
                  >
                </div>
                <h2 id="speaker-title" tabindex="-1">{speaker.fullName}</h2>
                <p>{speaker.headline}</p>
                <div class="chips">
                  <span>{isInInterviewList(speaker) ? 'In elenco' : 'Non in elenco'}</span>
                  {#if speaker.isKeynote}<span class="keynote-badge">Keynote</span>{/if}
                  {#each (speaker.tags as string[]) || [] as t}<span>{String(t)}</span>{/each}<span
                    >{translate(plan?.status) || 'Da preparare'}</span
                  >
                </div>
              </div>
            </div>
            {#if !(language === 'it' ? speaker.biographyIt : speaker.biographyEn)}<p class="muted">
                Traduzione {language.toUpperCase()} non disponibile: viene mostrata la descrizione originale.
              </p>{:else if !speaker.translationReviewed}<p class="muted">
                Traduzione da verificare.
              </p>{/if}
            {#if ((speaker.reviewFlags as string[]) || []).length}<p class="warning">
                Da verificare: {(speaker.reviewFlags as string[]).join(', ')}
              </p>{/if}
            <div class="detail-actions">
              <button class="primary" onclick={() => edit('materials')}>+ Aggiungi ricerca</button
              ><button onclick={() => edit('speakers', speaker)}>Modifica profilo</button><button
                onclick={() => edit('interviewPlans', plan)}>Prepara intervista</button
              >
            </div>
            <details class="bio">
              <summary>Biografia e note speaker</summary><Markdown
                text={display(language === 'it' ? speaker.biographyIt : speaker.biographyEn) ||
                  display(speaker.biographyMd) ||
                  'Descrizione non ancora disponibile.'}
              /><Markdown text={display(speaker.notesMd)} />
              <p class="muted">
                Dati riportati dalle fonti: {((speaker.sourceIds as string[]) || []).join(', ')}
              </p>
              <button
                class="danger text-button"
                onclick={() => (deleting = { collection: 'speakers', entity: speaker })}
                >Elimina speaker</button
              >
            </details>
            <nav class="tabs" aria-label="Contenuti dello speaker">
              {#each ['materials', 'questions', 'interviewPlans', 'talks'] as name}<button
                  class:current={tab === name}
                  aria-current={tab === name ? 'page' : undefined}
                  onclick={() => (tab = name as Collection)}>{tabLabels[name as Collection]}</button
                >{/each}
            </nav>
            <div class="section-heading">
              <h3>{tabLabels[tab]}</h3>
              {#if tab === 'questions'}<button onclick={() => (sortByRating = !sortByRating)}
                  >{sortByRating ? 'Ordina per scaletta' : 'Ordina per voto'}</button
                ><button onclick={prepareQuestions}>Prepara altre 10 domande</button>
                <div class="language-switch" aria-label="Lingua domande">
                  <button class:current={language === 'it'} onclick={() => (language = 'it')}
                    >IT</button
                  ><button class:current={language === 'en'} onclick={() => (language = 'en')}
                    >EN</button
                  >
                </div>{/if}<button
                onclick={() => edit(tab, tab === 'interviewPlans' ? plan : undefined)}
                >{tab === 'materials'
                  ? 'Aggiungi ricerca'
                  : tab === 'interviewPlans' && plan
                    ? 'Modifica piano'
                    : 'Aggiungi'}</button
              >
            </div>
            {#if tab === 'materials'}
              {#key speaker.id}<ResearchAssistant
                  {speaker}
                  {data}
                  {busy}
                  onsave={saveResearch}
                />{/key}
            {/if}
            {#if !related.length}<div class="empty-state">
                <h3>Spazio alla ricerca.</h3>
                <p>
                  Non ci sono ancora {tabLabels[tab].toLowerCase()} per {speaker.firstName ||
                    speaker.fullName}. Aggiungi il primo contenuto.
                </p>
                <button onclick={() => edit(tab)}>Aggiungi {tabLabels[tab].toLowerCase()}</button>
              </div>{/if}
            {#each related as { collection, entity } (collection + ':' + entity.id)}
              <article class="content-entry">
                <div class="entry-meta">
                  <span
                    >{provenanceLabel(collection, entity)}{tab === 'questions'
                      ? ' · ' + (entity.order || '—')
                      : ''}</span
                  >{#if entity.status}<span class="status">{translate(entity.status)}</span>{/if}
                </div>
                <h3>{tab === 'interviewPlans' ? 'Piano intervista' : title(entity)}</h3>
                {#if tab === 'questions'}<QuestionRating
                    question={entity}
                    onchange={refreshData}
                  /><Markdown
                    text={display(language === 'it' ? entity.followUpIt : entity.followUpEn)}
                  />
                  <details>
                    <summary>Motivazione e note</summary><Markdown
                      text={display(entity.whyMd)}
                    /><Markdown text={display(entity.notesMd)} />
                  </details>
                {:else if tab === 'interviewPlans'}<p>
                    Intervistatore: {entity.assignedToName ||
                      [...team, ...members].find((m) => m.id === entity.assignedToUid)
                        ?.displayName ||
                      'Non assegnato'}
                  </p>
                  <InterviewBadges plan={entity} />
                  <p>{entity.date || 'Data da concordare'} {entity.startTime || ''}</p>
                  <p>Obiettivo: {entity.targetQuestions || '—'} domande</p>
                  <Markdown text={display(entity.notesMd)} />
                {:else}{#if tab === 'talks'}<p class="muted">
                      {!(language === 'it' ? entity.abstractIt : entity.abstractEn)
                        ? 'Traduzione non disponibile: abstract originale.'
                        : entity.translationReviewed
                          ? 'Traduzione verificata.'
                          : 'Traduzione da verificare.'}
                    </p>{/if}<Markdown
                    text={display(entity.bodyMd) ||
                      display(language === 'it' ? entity.abstractIt : entity.abstractEn) ||
                      display(entity.abstractMd)}
                  />{#if tab === 'talks'}<p>
                      {entity.day || 'Giorno da confermare'} · {entity.time ||
                        'Orario da confermare'} · {entity.stage || 'Palco da confermare'}
                    </p>{/if}<Markdown text={display(entity.notesMd)} />{/if}
                {#if entity.url && safeUrl(entity.url)}<a
                    href={display(entity.url)}
                    target="_blank"
                    rel="noopener noreferrer">Apri fonte originale</a
                  >{/if}
                {#if ((entity.sourceIds as string[]) || []).length}<p class="provenance">
                    Fonti: {(entity.sourceIds as string[])
                      .map((id) => data.sources?.find((s) => s.id === id)?.title || id)
                      .join(', ')}
                  </p>{/if}
                <div class="entry-actions">
                  <button onclick={() => edit(collection, entity)}>Modifica</button><button
                    class="danger quiet"
                    onclick={() => (deleting = { collection, entity })}>Elimina</button
                  >
                </div>
              </article>
            {/each}
          {:else}<div class="select-speaker">
              <span class="notebook" aria-hidden="true">✎</span>
              <h2>Una buona domanda<br />parte dall’ascolto.</h2>
              <p>
                Scegli uno speaker per raccogliere fonti, confrontare appunti e preparare la
                conversazione.
              </p>
            </div>{/if}
        </section>
      </div>
    {/if}
  {/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if deleting}<ConfirmDelete
      title={title(deleting.entity)}
      {busy}
      onconfirm={confirmDelete}
      oncancel={() => (deleting = null)}
    />{/if}
</main>
<footer>BacaroTech · Codemotion Milano 2026 <span>Ricerca, confronto, conversazioni.</span></footer>
