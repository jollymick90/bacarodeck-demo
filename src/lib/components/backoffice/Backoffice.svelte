<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { getWorkspace } from '$lib/workspace.svelte';
  import { researchEntries } from '$lib/research';
  import { isInInterviewList } from '$lib/interview-list';
  import { searchSpeakers } from '$lib/speaker-search';
  import { labels, translate, type Collection, type Entity } from '$lib/fields';
  import { safeUrl, provenanceLabel } from '$lib/domain';
  import { commitChanges, removeEntity } from '$lib/repository';
  import { assignmentOwner } from '$lib/conductor/assignment';
  import ResearchQuestionPromotion from '$lib/components/conductor/ResearchQuestionPromotion.svelte';
  import AssignmentControl from '$lib/components/conductor/AssignmentControl.svelte';
  import ResearchAssistant from '$lib/components/ResearchAssistant.svelte';
  import InterviewBadges from '$lib/components/InterviewBadges.svelte';
  import InterviewQuestions from './InterviewQuestions.svelte';
  import SpeakerHeader from './SpeakerHeader.svelte';
  import ActionHelp from '$lib/components/ActionHelp.svelte';
  import ConfirmDelete from '$lib/components/ConfirmDelete.svelte';
  import Markdown from '$lib/components/Markdown.svelte';
  import ResearchReader from '$lib/components/ResearchReader.svelte';
  let {
    selectedId = '',
    tab = 'materials',
    tools = false
  }: { selectedId?: string; tab?: Collection; tools?: boolean } = $props();
  const workspace = getWorkspace();
  const data = $derived(workspace.data);
  const members = $derived(workspace.members);
  const client = $derived(workspace.client);
  const user = $derived(workspace.user);
  const ready = $derived(workspace.ready);
  const tabLabels = { ...labels, speakers: 'Info', materials: 'Note', questions: 'Intervista' };
  const sections: Partial<Record<Collection, string>> = {
    speakers: '',
    materials: '/note',
    questions: '/intervista',
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
        (!assignee ||
          assignmentOwner(plan) === assignee ||
          plan?.assignedToUid === assignee ||
          (plan?.assignedToUid &&
            plan.assignedToUid === workspace.assignees.find((m) => m.id === assignee)?.uid))
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
          .toSorted((a, b) => Number(a.order || 0) - Number(b.order || 0))
          .map((entity) => ({ collection: tab, entity }))
  );
  async function saveResearch(
    records: Entity[],
    collection: 'materials' | 'questions' = 'materials'
  ) {
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
          collection,
          data: entity,
          expectedRevision: null
        }))
      );
      workspace.message = collection === 'questions' ? 'Domande importate.' : 'Ricerca salvata.';
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
          ><option value="">Tutti i membri</option>{#each workspace.assignees as m}<option
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
      <SpeakerHeader {speaker} talks={speakerTalks} />
      <p>
        <a href={'/topic/connessioni?node=' + encodeURIComponent('speaker:' + speaker.id)}
          >Esplora connessioni dello speaker</a
        >
      </p>
      <nav class="tabs" aria-label="Contenuti dello speaker">
        {#each ['speakers', 'materials', 'questions'] as name}<a
            class:current={!tools && tab === name}
            aria-current={!tools && tab === name ? 'page' : undefined}
            href={speakerPath(selectedId) + sections[name as Collection]}
            >{tabLabels[name as Collection]}</a
          >{/each}
        <a
          class:current={tools}
          aria-current={tools ? 'page' : undefined}
          href={speakerPath(selectedId) + '/strumenti'}>Strumenti</a
        >
      </nav>
      {#if tools}
        <h2>Strumenti per la ricerca di informazioni</h2>
        <p class="muted">
          Questi strumenti ti aiutano a trovare informazioni su {speaker.fullName} e sui suoi talk, approfondire
          gli argomenti e preparare l’intervista. Copia i prompt da usare in Gemini, ChatGPT o NotebookLM
          e salva i risultati nelle Note.
        </p>
        {#key speaker.id}<ResearchAssistant
            {speaker}
            {data}
            {busy}
            onsave={saveResearch}
            onsavequestions={(records) => saveResearch(records, 'questions')}
          />{/key}
        <a class="button-link" href={speakerPath(selectedId) + '/note'}>Vai alle note</a>
      {:else if tab === 'speakers'}
        <div class="language">
          <button onclick={() => (language = 'it')} aria-pressed={language === 'it'}
            >Italiano</button
          >
          <button onclick={() => (language = 'en')} aria-pressed={language === 'en'}>English</button
          >
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
          <a class="button-link primary" href={editPath('materials')}>+ Aggiungi nota</a><a
            class="button-link"
            href={editPath('speakers', speaker)}>Modifica profilo e intervista</a
          >
        </div>
        <section class="bio" aria-label="Biografia e note speaker">
          <h2>Biografia e note speaker</h2>
          <Markdown
            text={display(language === 'it' ? speaker.biographyIt : speaker.biographyEn) ||
              display(speaker.biographyMd) ||
              'Descrizione non ancora disponibile.'}
          /><Markdown text={display(speaker.notesMd)} />
          <p class="muted">
            Dati riportati dalle fonti: {((speaker.sourceIds as string[]) || []).join(', ')}
          </p>
          <button
            class="danger text-button"
            disabled={workspace.readOnly}
            onclick={() => (deleting = { collection: 'speakers', entity: speaker })}
            >Elimina speaker</button
          >
        </section>
      {:else if tab === 'questions'}
        <InterviewQuestions
          speakerId={selectedId}
          ondelete={(entity) => (deleting = { collection: 'questions', entity })}
        />
      {:else}
        {#if tab === 'talks'}
          <div class="language" role="group" aria-label="Lingua talk">
            <button onclick={() => (language = 'it')} aria-pressed={language === 'it'}
              >Italiano</button
            >
            <button onclick={() => (language = 'en')} aria-pressed={language === 'en'}
              >English</button
            >
          </div>
        {/if}
        <div class="section-heading">
          <div class="notes-heading">
            <h2>{tabLabels[tab]}</h2>
            {#if tab === 'materials'}<ActionHelp
                title="Note dello speaker"
                description="Le note sono appunti, fonti e spunti condivisi con tutti i conduttori. Servono a conoscere lo speaker e il talk, conservare gli approfondimenti e preparare domande più mirate. Puoi aggiungerle e modificarle. Le domande scritte nelle note restano appunti: scegli e organizza quelle da usare nella tab Intervista. Nella tab Strumenti trovi i prompt per la ricerca e l’importazione dei risultati Markdown."
              />{/if}
          </div>
          <a class="button-link" href={editPath(tab)}
            >{tab === 'materials' ? 'Aggiungi nota' : 'Aggiungi talk'}</a
          >
        </div>
        {#if !related.length}<div class="empty-state">
            <h3>{tab === 'materials' ? 'Nessuna nota, per ora.' : 'Nessun talk, per ora.'}</h3>
            <p>
              Non ci sono ancora {tabLabels[tab].toLowerCase()} per {speaker.firstName ||
                speaker.fullName}. Aggiungi il primo contenuto.
            </p>
            <a class="button-link" href={editPath(tab)}
              >{tab === 'materials' ? 'Aggiungi la prima nota' : 'Aggiungi talk'}</a
            >
          </div>{/if}
        {#each related as { collection, entity } (collection + ':' + entity.id)}
          <article class="content-entry">
            <div class="entry-meta">
              <span>{provenanceLabel(collection, entity)}</span>{#if entity.status}<span
                  class="status">{translate(entity.status)}</span
                >{/if}
            </div>
            <h3>{title(entity)}</h3>
            {#if tab === 'talks'}<p class="muted">
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
              </p>{/if}<Markdown text={display(entity.notesMd)} />
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
                disabled={workspace.readOnly}
                onclick={() => (deleting = { collection, entity })}>Elimina</button
              >
            </div>
          </article>
        {/each}
      {/if}
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
  .notes-heading {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
  .notes-heading h2 {
    margin: 0;
  }
  .chips {
    margin-bottom: 1rem;
  }
  .tabs {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0;
    margin-top: 0;
    text-align: center;
  }
  .tabs a {
    padding: 0.8rem 0.25rem;
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
