<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { getWorkspace } from '$lib/workspace.svelte';
  import { researchEntries } from '$lib/research';
  import { isInInterviewList } from '$lib/interview-list';
  import { searchSpeakers } from '$lib/speaker-search';
  import { labels, translate, type Collection, type Entity } from '$lib/fields';
  import { safeUrl, provenanceLabel } from '$lib/domain';
  import { commitChanges, removeEntity, refreshData } from '$lib/repository';
  import { team } from '$lib/team';
  import ResearchQuestionPromotion from '$lib/components/conductor/ResearchQuestionPromotion.svelte';
  import AssignmentControl from '$lib/components/conductor/AssignmentControl.svelte';
  import ResearchAssistant from '$lib/components/ResearchAssistant.svelte';
  import InterviewBadges from '$lib/components/InterviewBadges.svelte';
  import QuestionRating from '$lib/components/QuestionRating.svelte';
  import ConfirmDelete from '$lib/components/ConfirmDelete.svelte';
  import Markdown from '$lib/components/Markdown.svelte';
  import ResearchReader from '$lib/components/ResearchReader.svelte';
  let { selectedId = '', tab = 'materials' }: { selectedId?: string; tab?: Collection } = $props();
  const workspace = getWorkspace();
  const data = $derived(workspace.data);
  const members = $derived(workspace.members);
  const client = $derived(workspace.client);
  const user = $derived(workspace.user);
  const ready = $derived(workspace.ready);
  const tabLabels = { ...labels, materials: 'Ricerca' };
  const sections: Partial<Record<Collection, string>> = {
    materials: '',
    questions: '/domande',
    interviewPlans: '/intervista',
    talks: '/talk'
  };
  const speakerPath = (id: string) => '/backoffice/speaker/' + encodeURIComponent(id);
  const editPath = (collection: Collection, entity?: Entity) =>
    (entity
      ? '/backoffice/contenuti/' + collection + '/' + encodeURIComponent(entity.id)
      : '/backoffice/nuovo/' + collection) +
    (selectedId ? '?speaker=' + encodeURIComponent(selectedId) : '');
  const query = $derived(page.url.searchParams.get('q') ?? '');
  const directory = $derived(page.url.searchParams.get('elenco') ?? 'in');
  const priorityOnly = $derived(page.url.searchParams.get('prioritari') === '1');
  function filter(name: string, value: string) {
    const params = new URLSearchParams(page.url.search);
    params.set(name, value);
    void goto('/backoffice?' + params, { replaceState: true, noScroll: true, keepFocus: true });
  }
  const tag = $derived(page.url.searchParams.get('tag') ?? '');
  const prep = $derived(page.url.searchParams.get('preparazione') ?? '');
  const assignee = $derived(page.url.searchParams.get('conduttore') ?? '');
  let language = $state<'it' | 'en'>('it');
  let sortByRating = $state(false);
  let busy = $state(false);
  let deleting = $state<{ collection: Collection; entity: Entity } | null>(null);
  const speakers = $derived(data.speakers || []);
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
  const speakerTalks = $derived(
    (data.talks || []).filter((talk) => ((talk.speakerIds as string[]) || []).includes(selectedId))
  );
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
      workspace.message = 'Ricerca salvata.';
    } finally {
      busy = false;
    }
  }
  async function confirmDelete() {
    if (!client || !deleting) return;
    busy = true;
    workspace.error = '';
    try {
      await removeEntity(client.db, deleting.collection, deleting.entity);
      workspace.message = 'Contenuto eliminato.';
      if (deleting.collection === 'speakers') await goto('/backoffice');
      deleting = null;
    } catch (e) {
      workspace.error = e instanceof Error ? e.message : String(e);
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
  ><title>{speaker ? String(speaker.fullName) : 'Speaker'} · Gestione BacaroTech</title
  ></svelte:head
>
{#if !selectedId}
  <aside class="speaker-list" aria-label="Elenco speaker">
    <div class="list-heading"><h2>Speaker <span>{speakers.length}</span></h2></div>
    <label for="search">Cerca nome, organizzazione o tag</label><input
      id="search"
      type="search"
      placeholder="Chi intervistiamo?"
      value={query}
      oninput={(event) => filter('q', event.currentTarget.value)}
    />
    <details class="search-filters">
      <summary>Filtri speaker</summary>
      <label
        ><input
          type="checkbox"
          checked={priorityOnly}
          onchange={(event) => filter('prioritari', event.currentTarget.checked ? '1' : '0')}
        /> Solo prioritari</label
      >
      <label
        >Elenco interviste<select
          value={directory}
          onchange={(event) => filter('elenco', event.currentTarget.value)}
          ><option value="">Tutti</option><option value="in">In elenco</option><option value="out"
            >Fuori elenco</option
          ></select
        ></label
      >
      <div class="filters">
        <label
          >Tag<select value={tag} onchange={(event) => filter('tag', event.currentTarget.value)}
            ><option value="">Tutti i tag</option>{#each tags as t}<option>{t}</option
              >{/each}</select
          ></label
        ><label
          >Preparazione<select
            value={prep}
            onchange={(event) => filter('preparazione', event.currentTarget.value)}
            ><option value="">Tutti gli stati</option
            >{#each ['not_started', 'researching', 'ready', 'done'] as state}<option value={state}
                >{translate(state)}</option
              >{/each}</select
          ></label
        >
      </div>
      <label
        >Intervistatore<select
          value={assignee}
          onchange={(event) => filter('conduttore', event.currentTarget.value)}
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
          onclick={() =>
            goto('/backoffice?elenco=', { replaceState: true, noScroll: true, keepFocus: true })}
          >Azzera ricerca</button
        >{/if}
    </div>
    <nav aria-label="Scegli speaker">
      {#each filtered as s}<a
          class:active={s.id === selectedId}
          class="speaker-row"
          id={'speaker-' + s.id}
          href={speakerPath(s.id)}
          aria-current={s.id === selectedId ? 'true' : undefined}
          ><span class="avatar"
            >{display(s.fullName)
              .split(' ')
              .map((w) => w[0])
              .slice(0, 2)
              .join('')}</span
          ><span
            ><strong>{s.fullName}</strong>{#if s.isKeynote}<span class="keynote-badge">Keynote</span
              >{/if}<small>{s.organization || 'Organizzazione da verificare'}</small
            ><InterviewBadges plan={data.interviewPlans?.find((p) => p.speakerId === s.id)} /></span
          ><span aria-hidden="true">›</span></a
        >{/each}
    </nav>
    {#if ready && !filtered.length}<p class="muted">
        {speakers.length
          ? 'Nessun risultato. Prova un altro nome o filtro.'
          : 'Il workspace è vuoto.'}
      </p>{/if}
    {#if ready && !speakers.length}<p class="muted">
        Usa «Aggiungi speaker» oppure apri «Strumenti» per importare un catalogo.
      </p>{/if}
  </aside>
{:else}<section class="speaker-detail" aria-label="Scheda speaker">
    {#if speaker}
      <header class="speaker-profile">
        {#if speaker.photoUrl && safeUrl(speaker.photoUrl)}
          <img
            class="speaker-photo"
            src={display(speaker.photoUrl)}
            alt={'Foto di ' + speaker.fullName}
            referrerpolicy="no-referrer"
          />
        {:else}
          <div class="speaker-photo photo-placeholder" aria-label="Foto non disponibile">
            {display(speaker.fullName)
              .split(' ')
              .map((part) => part[0])
              .slice(0, 2)
              .join('')}
          </div>
        {/if}
        <h1 id="speaker-title" tabindex="-1">{speaker.fullName}</h1>
        <p class="speaker-role">{speaker.headline || 'Ruolo non disponibile'}</p>
        {#each speakerTalks as talk}
          <a class="speaker-talk" href={speakerPath(selectedId) + '/talk'}
            >{talk.title || 'Talk senza titolo'}</a
          >
        {:else}<p class="muted">Talk non ancora disponibile.</p>{/each}
      </header>
      <nav class="tabs" aria-label="Contenuti dello speaker">
        {#each ['materials', 'questions', 'interviewPlans'] as name}<a
            class:current={tab === name}
            aria-current={tab === name ? 'page' : undefined}
            href={speakerPath(selectedId) + sections[name as Collection]}
            >{tabLabels[name as Collection]}</a
          >{/each}
      </nav>
      <div class="language">
        <button onclick={() => (language = 'it')} aria-pressed={language === 'it'}>Italiano</button>
        <button onclick={() => (language = 'en')} aria-pressed={language === 'en'}>English</button>
      </div>
      <div class="chips">
        <span>{isInInterviewList(speaker) ? 'In elenco' : 'Non in elenco'}</span>
        {#if speaker.isKeynote}<span class="keynote-badge">Keynote</span>{/if}
        {#each (speaker.tags as string[]) || [] as t}<span>{String(t)}</span>{/each}
        <span>{translate(plan?.status) || 'Da preparare'}</span>
      </div>
      <AssignmentControl {speaker} {plan} />
      <p>
        <a href={'/speaker/' + encodeURIComponent(speaker.id) + '/scaletta'}
          >Apri scaletta conduttore</a
        >
      </p>
      {#if !(language === 'it' ? speaker.biographyIt : speaker.biographyEn)}<p class="muted">
          Traduzione {language.toUpperCase()} non disponibile: viene mostrata la descrizione originale.
        </p>{:else if !speaker.translationReviewed}<p class="muted">
          Traduzione da verificare.
        </p>{/if}
      {#if ((speaker.reviewFlags as string[]) || []).length}<p class="warning">
          Da verificare: {(speaker.reviewFlags as string[]).join(', ')}
        </p>{/if}
      <div class="detail-actions">
        <a class="button-link primary" href={editPath('materials')}>+ Aggiungi ricerca</a><a
          class="button-link"
          href={editPath('speakers', speaker)}>Modifica profilo e intervista</a
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

      <div class="section-heading">
        <h3>{tabLabels[tab]}</h3>
        {#if tab === 'questions'}<button onclick={() => (sortByRating = !sortByRating)}
            >{sortByRating ? 'Ordina per scaletta' : 'Ordina per voto'}</button
          ><a
            class="button-link"
            href={'/backoffice/importa/domande?speaker=' + encodeURIComponent(selectedId)}
            >Prepara altre 10 domande</a
          >
          <div class="language-switch" aria-label="Lingua domande">
            <button class:current={language === 'it'} onclick={() => (language = 'it')}>IT</button
            ><button class:current={language === 'en'} onclick={() => (language = 'en')}>EN</button>
          </div>{/if}<a
          class="button-link"
          href={editPath(tab, tab === 'interviewPlans' ? plan : undefined)}
          >{tab === 'materials'
            ? 'Aggiungi ricerca'
            : tab === 'interviewPlans' && plan
              ? 'Modifica piano'
              : 'Aggiungi'}</a
        >
      </div>
      {#if tab === 'materials'}
        {#key speaker.id}<ResearchAssistant {speaker} {data} {busy} onsave={saveResearch} />{/key}
      {/if}
      {#if !related.length}<div class="empty-state">
          <h3>Spazio alla ricerca.</h3>
          <p>
            Non ci sono ancora {tabLabels[tab].toLowerCase()} per {speaker.firstName ||
              speaker.fullName}. Aggiungi il primo contenuto.
          </p>
          <a class="button-link" href={editPath(tab)}>Aggiungi {tabLabels[tab].toLowerCase()}</a>
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
            /><Markdown text={display(language === 'it' ? entity.followUpIt : entity.followUpEn)} />
            <details>
              <summary>Motivazione e note</summary><Markdown
                text={display(entity.whyMd)}
              /><Markdown text={display(entity.notesMd)} />
            </details>
          {:else if tab === 'interviewPlans'}<p>
              Intervistatore: {entity.assignedToName ||
                [...team, ...members].find((m) => m.id === entity.assignedToUid)?.displayName ||
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
              </p>{/if}{#if tab === 'materials'}
              <ResearchReader text={display(entity.bodyMd)} />
              {#if collection === 'materials'}<ResearchQuestionPromotion
                  speakerId={selectedId}
                  materialId={entity.id}
                  oncreate={async (q) => {
                    await commitChanges(client!.db, user!.uid, [
                      { collection: 'questions', data: q, expectedRevision: null }
                    ]);
                  }}
                />{/if}
            {:else}<Markdown
                text={display(entity.bodyMd) ||
                  display(language === 'it' ? entity.abstractIt : entity.abstractEn) ||
                  display(entity.abstractMd)}
              />{/if}{#if tab === 'talks'}<p>
                {entity.day || 'Giorno da confermare'} · {entity.time || 'Orario da confermare'} · {entity.stage ||
                  'Palco da confermare'}
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
            <a class="button-link" href={editPath(collection, entity)}>Modifica</a><button
              class="danger quiet"
              onclick={() => (deleting = { collection, entity })}>Elimina</button
            >
          </div>
        </article>
      {/each}
    {:else}<div class="empty-state">
        <h2>Speaker non trovato</h2>
        <p>La scheda non esiste oppure è stata eliminata.</p>
        <a href="/backoffice">Torna agli speaker</a>
      </div>{/if}
  </section>
{/if}
{#if deleting}<ConfirmDelete
    title={title(deleting.entity)}
    {busy}
    onconfirm={confirmDelete}
    oncancel={() => (deleting = null)}
  />{/if}

<style>
  .speaker-list {
    max-width: 900px;
    margin: auto;
  }
  .speaker-row {
    text-decoration: none;
    color: inherit;
  }
  .speaker-detail {
    min-width: 0;
  }
  .speaker-profile {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 0.4rem;
    margin-bottom: 1.5rem;
  }
  .speaker-photo {
    width: 128px;
    height: 128px;
    border-radius: 12px;
    object-fit: cover;
    margin-bottom: 0.5rem;
  }
  .photo-placeholder {
    display: grid;
    place-items: center;
    background: #dce6f2;
    color: var(--blue);
    font-size: 2rem;
    font-weight: 700;
  }
  .speaker-profile h1 {
    margin: 0;
    font-size: clamp(1.6rem, 5vw, 2rem);
  }
  .speaker-role {
    margin: 0;
    color: var(--muted);
  }
  .speaker-talk {
    max-width: 60ch;
    font-weight: 600;
  }
  .chips {
    margin-bottom: 1rem;
  }
  .tabs {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0;
    margin-top: 0;
    text-align: center;
  }
  .tabs a {
    padding: 0.8rem 1rem;
    text-decoration: none;
    color: var(--muted);
    border-bottom: 3px solid transparent;
  }
  .tabs a.current {
    color: var(--blue);
    border-color: var(--blue);
    font-weight: 700;
  }
</style>
