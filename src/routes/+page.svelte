<script lang="ts">
  import { onMount } from 'svelte';
  import {
    GoogleAuthProvider,
    onAuthStateChanged,
    signInWithPopup,
    signOut,
    type User
  } from 'firebase/auth';
  import { doc, onSnapshot, type Unsubscribe } from 'firebase/firestore';
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
    speakers.filter((s) => {
      const plan = data.interviewPlans?.find((p) => p.speakerId === s.id);
      return (
        `${s.fullName} ${((s.tags as string[]) || []).join(' ')}`
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        (!tag || ((s.tags as string[]) || []).includes(tag)) &&
        (!prep || plan?.status === prep) &&
        (!assignee || plan?.assignedToUid === assignee)
      );
    })
  );
  const speaker = $derived(speakers.find((s) => s.id === selectedId));
  const plan = $derived(data.interviewPlans?.find((p) => p.speakerId === selectedId));
  const related = $derived(
    (data[tab] || [])
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
      .toSorted((a, b) => Number(a.order || 0) - Number(b.order || 0))
  );
  function stop() {
    unsubs.forEach((fn) => fn());
    unsubs = [];
  }
  function clear() {
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
    let memberUnsub: Unsubscribe | undefined;
    const authUnsub = onAuthStateChanged(firebase.auth, (current) => {
      memberUnsub?.();
      stop();
      clear();
      error = '';
      user = current;
      if (!current) {
        access = 'login';
        return;
      }
      access = 'loading';
      memberUnsub = onSnapshot(
        doc(firebase.db, basePath, 'members', current.uid),
        { includeMetadataChanges: true },
        (snap) => {
          if (!snap.exists() && !snap.metadata.fromCache) {
            denied();
            return;
          }
          if (snap.metadata.fromCache) return;
          if (access === 'member') return;
          access = 'member';
          for (const name of [...collections, 'members'] as const) {
            unsubs.push(
              watchCollection(
                firebase.db,
                name,
                (entities, cached) => {
                  if (name === 'members') members = entities;
                  else data[name] = entities;
                  if (!cached && !loaded.includes(name)) loaded = [...loaded, name];
                },
                denied
              )
            );
          }
        },
        denied
      );
    });
    return () => {
      authUnsub();
      memberUnsub?.();
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
    editing = { collection, entity: entity ?? emptyEntity(collection, selectedId || undefined) };
    message = '';
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
  async function importChanges(changes: Change[]) {
    if (!client || !user) return;
    busy = true;
    try {
      await commitChanges(client.db, user.uid, changes);
      message = `Importazione completata: ${changes.length} documenti salvati.`;
      importing = false;
    } finally {
      busy = false;
    }
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
          <h2>Accesso riservato ai membri</h2>
          <p>
            Il tuo account non è abilitato, oppure il permesso è stato revocato. Chiedi a chi
            gestisce il workspace di aggiungere questo UID:
          </p>
          <code class="uid">{user?.uid}</code>
          <p>Non è possibile aggiungersi autonomamente.</p>
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
        <button
          onclick={() => {
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
    {#if importing}<Import
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
      <div class="workspace-grid">
        <aside class="speaker-list" aria-label="Elenco speaker">
          <div class="list-heading"><h2>Speaker <span>{speakers.length}</span></h2></div>
          <label for="search">Cerca nome o tag</label><input
            id="search"
            type="search"
            placeholder="Chi intervistiamo?"
            bind:value={query}
          />
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
              ><option value="">Tutti i membri</option>{#each members as m}<option value={m.id}
                  >{m.displayName || m.id}</option
                >{/each}</select
            ></label
          >
          <nav aria-label="Scegli speaker">
            {#each filtered as s}<button
                class:active={s.id === selectedId}
                class="speaker-row"
                onclick={() => {
                  selectedId = s.id;
                  tab = 'materials';
                }}
                aria-current={s.id === selectedId ? 'true' : undefined}
                ><span class="avatar"
                  >{display(s.fullName)
                    .split(' ')
                    .map((w) => w[0])
                    .slice(0, 2)
                    .join('')}</span
                ><span
                  ><strong>{s.fullName}</strong><small
                    >{s.organization || 'Organizzazione da verificare'}</small
                  ></span
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
            <div class="speaker-heading">
              {#if speaker.photoUrl && safeUrl(speaker.photoUrl)}<img
                  class="portrait"
                  src={display(speaker.photoUrl)}
                  alt={'Foto pubblica di ' + speaker.fullName}
                  referrerpolicy="no-referrer"
                />{/if}
              <div>
                <p class="muted">Scheda di preparazione</p>
                <h2>{speaker.fullName}</h2>
                <p>{speaker.headline}</p>
                <div class="chips">
                  {#each (speaker.tags as string[]) || [] as t}<span>{String(t)}</span>{/each}<span
                    >{translate(plan?.status) || 'Da preparare'}</span
                  >
                </div>
              </div>
            </div>
            {#if ((speaker.reviewFlags as string[]) || []).length}<p class="warning">
                Da verificare: {(speaker.reviewFlags as string[]).join(', ')}
              </p>{/if}
            <div class="detail-actions">
              <button class="primary" onclick={() => edit('materials')}>+ Aggiungi materiale</button
              ><button onclick={() => edit('speakers', speaker)}>Modifica profilo</button><button
                onclick={() => edit('interviewPlans', plan)}>Prepara intervista</button
              >
            </div>
            <details class="bio">
              <summary>Biografia e note speaker</summary><Markdown
                text={display(speaker.biographyMd) || 'Biografia da verificare.'}
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
              {#each ['materials', 'questions', 'interviewPlans', 'talks', 'sources', 'insights'] as name}<button
                  class:current={tab === name}
                  aria-current={tab === name ? 'page' : undefined}
                  onclick={() => (tab = name as Collection)}>{labels[name as Collection]}</button
                >{/each}
            </nav>
            <div class="section-heading">
              <h3>{labels[tab]}</h3>
              {#if tab === 'questions'}<div class="language-switch" aria-label="Lingua domande">
                  <button class:current={language === 'it'} onclick={() => (language = 'it')}
                    >IT</button
                  ><button class:current={language === 'en'} onclick={() => (language = 'en')}
                    >EN</button
                  >
                </div>{/if}<button
                onclick={() => edit(tab, tab === 'interviewPlans' ? plan : undefined)}
                >{tab === 'interviewPlans' && plan ? 'Modifica piano' : 'Aggiungi'}</button
              >
            </div>
            {#if !related.length}<div class="empty-state">
                <h3>Spazio alla ricerca.</h3>
                <p>
                  Non ci sono ancora {labels[tab].toLowerCase()} per {speaker.firstName ||
                    speaker.fullName}. Aggiungi il primo contenuto.
                </p>
                <button onclick={() => edit(tab)}>Aggiungi {labels[tab].toLowerCase()}</button>
              </div>{/if}
            {#each related as entity}
              <article class="content-entry">
                <div class="entry-meta">
                  <span
                    >{provenanceLabel(tab, entity)}{tab === 'questions'
                      ? ' · ' + (entity.order || '—')
                      : ''}</span
                  >{#if entity.status}<span class="status">{translate(entity.status)}</span>{/if}
                </div>
                <h3>{tab === 'interviewPlans' ? 'Piano intervista' : title(entity)}</h3>
                {#if tab === 'questions'}<Markdown
                    text={display(language === 'it' ? entity.followUpIt : entity.followUpEn)}
                  />
                  <details>
                    <summary>Motivazione e note</summary><Markdown
                      text={display(entity.whyMd)}
                    /><Markdown text={display(entity.notesMd)} />
                  </details>
                {:else if tab === 'interviewPlans'}<p>
                    Intervistatore: {entity.assignedToName ||
                      members.find((m) => m.id === entity.assignedToUid)?.displayName ||
                      'Non assegnato'}
                  </p>
                  <p>
                    Preparazione: {translate(entity.status)} · Intervista: {translate(
                      entity.interviewStatus
                    )}
                  </p>
                  <p>{entity.date || 'Data da concordare'} {entity.startTime || ''}</p>
                  <p>Obiettivo: {entity.targetQuestions || '—'} domande</p>
                  <Markdown text={display(entity.notesMd)} />
                {:else}<Markdown
                    text={display(entity.bodyMd) || display(entity.abstractMd)}
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
                  <button onclick={() => edit(tab, entity)}>Modifica</button><button
                    class="danger quiet"
                    onclick={() => (deleting = { collection: tab, entity })}>Elimina</button
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
