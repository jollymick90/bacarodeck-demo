<script lang="ts">
  import StartInterview from './StartInterview.svelte';
  import SpeakerPhoto from '../SpeakerPhoto.svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import type { Dataset, Entity } from '$lib/fields';
  import { isInInterviewList } from '$lib/interview-list';
  import { searchSpeakers } from '$lib/speaker-search';
  import { firstSpeakerTalk, groupSpeakers, sortSpeakersByTalk } from '$lib/conductor/home';
  import { talkStartTime } from '$lib/talk-schedule';
  import { resolveBrief, briefId } from '$lib/conductor/brief';
  import { assignmentOwner } from '$lib/conductor/assignment';
  import { team } from '$lib/team';
  import { api, refreshWorkspace } from '$lib/repository';
  import TalkSchedule from '../TalkSchedule.svelte';
  import Markdown from '../Markdown.svelte';
  import SuccessNotice from '../SuccessNotice.svelte';
  import Editor from '../Editor.svelte';
  import ResearchReader from '../ResearchReader.svelte';
  import { researchEntries } from '$lib/research';
  import AssignmentControl from './AssignmentControl.svelte';
  let {
    readOnly = false,
    data,
    members,
    assignees = [],
    uid,
    onquestion,
    mode = 'home',
    selected = '',
    topic = ''
  }: {
    readOnly?: boolean;
    data: Dataset;
    members: Entity[];
    assignees?: Entity[];
    uid: string;
    onquestion: (q: Entity) => Promise<void>;
    mode?: 'home' | 'speakers' | 'speaker' | 'reading' | 'topics' | 'topic';
    selected?: string;
    topic?: string;
  } = $props();
  const language = $derived(page.url.searchParams.get('lang') === 'en' ? 'en' : 'it');
  let query = $state('');
  const speakerList = $derived(mode === 'home' || mode === 'speakers');
  const showAllSpeakers = $derived(page.url.searchParams.get('elenco') === 'tutti');
  function toggleSpeakers() {
    const params = new URLSearchParams(page.url.search);
    if (showAllSpeakers) params.delete('elenco');
    else params.set('elenco', 'tutti');
    void goto(page.url.pathname + (params.size ? '?' + params : ''), {
      noScroll: true,
      keepFocus: true
    });
  }
  const personalFilter = $derived(
    page.url.searchParams.get('miei') === 'assegnati'
      ? 'assegnati'
      : page.url.searchParams.get('miei') === 'interessi'
        ? 'interessi'
        : 'tutti'
  );
  const assignedOrder = $derived(
    page.url.searchParams.get('ordine') === 'nome' ? 'nome' : 'orario'
  );
  function changeAssignedOrder(value: string) {
    const params = new URLSearchParams(page.url.search);
    if (value === 'nome') params.set('ordine', 'nome');
    else params.delete('ordine');
    void goto(page.url.pathname + (params.size ? '?' + params : ''), {
      noScroll: true,
      keepFocus: true
    });
  }
  function filterPersonal(value: 'tutti' | 'interessi' | 'assegnati') {
    const params = new URLSearchParams(page.url.search);
    if (value === 'tutti') params.delete('miei');
    else params.set('miei', value);
    void goto(page.url.pathname + (params.size ? '?' + params : ''), {
      noScroll: true,
      keepFocus: true
    });
  }
  let busy = $state(false);
  let failure = $state('');
  let message = $state('');
  let editQuestion = $state<Entity | null>(null);
  let editLanguage = $state<'it' | 'en'>('it');
  let questionDialog: HTMLDialogElement;
  let replacement = $state<string | null>(null);
  let picker: HTMLDialogElement;
  let draftSummary = $state('');
  let summaryEditing = $state(false);
  let fullAbstract = $state(false);
  let summaryRevision = $state<number | null>(null);
  const speaker = $derived(data.speakers?.find((s) => s.id === selected));
  const talks = $derived(
    (data.talks || []).filter((t) => ((t.speakerIds as string[]) || []).includes(selected))
  );
  const talkId = $derived(
    talks.find((talk) => talk.id === page.url.searchParams.get('talk'))?.id || talks[0]?.id || ''
  );
  const plan = $derived(data.interviewPlans?.find((p) => p.speakerId === selected));
  const brief = $derived(resolveBrief(data, selected, talkId, language));
  const groups = $derived(
    groupSpeakers(
      searchSpeakers(data.speakers || [], query),
      data.speakerInterests || [],
      data.interviewPlans || [],
      uid,
      topic,
      assignees
    )
  );
  const visibleSpeakers = $derived(
    groups.all.filter((item) => !speakerList || showAllSpeakers || isInInterviewList(item))
  );
  const personalSpeakers = $derived(
    personalFilter === 'assegnati'
      ? assignedOrder === 'orario'
        ? sortSpeakersByTalk(groups.assigned, data)
        : groups.assigned.toSorted((a, b) =>
            String(a.fullName || '').localeCompare(String(b.fullName || ''), 'it')
          )
      : personalFilter === 'interessi'
        ? groups.saved
        : groups.personal
  );
  const visibleIds = $derived(new Set(visibleSpeakers.map((speaker) => speaker.id)));
  const unassignedSpeakers = $derived(
    groups.unassigned.filter((speaker) => visibleIds.has(speaker.id))
  );
  const remainingSpeakers = $derived(
    visibleSpeakers.filter(
      (item) =>
        !groups.personal.some((personal) => personal.id === item.id) &&
        !groups.unassigned.some((unassigned) => unassigned.id === item.id)
    )
  );
  const topics = $derived(
    [...new Set((data.speakers || []).flatMap((s) => (s.tags as string[]) || []))].sort()
  );
  const questions = $derived(
    (data.questions || []).filter((q) => q.speakerId === selected && q.status !== 'rejected')
  );
  const liveId = $derived(
    page.url.searchParams.get('question') || brief.interviewQuestions[0]?.id || ''
  );
  const current = $derived(brief.interviewQuestions.find((q) => q.id === liveId));
  const currentIndex = $derived(brief.interviewQuestions.findIndex((q) => q.id === liveId));
  const firstOptional = $derived(
    brief.interviewQuestions.findIndex((q) =>
      brief.optionalQuestions.some((optional) => optional.id === q.id)
    )
  );
  const canSkipOptional = $derived(
    firstOptional >= 0 &&
      currentIndex >= firstOptional - 1 &&
      currentIndex < brief.interviewQuestions.length - 1
  );
  const research = $derived(researchEntries(data, selected));
  function names(id: string) {
    return (data.speakerInterests || [])
      .filter((i) => i.speakerId === id)
      .map((i) =>
        i.memberUid === uid
          ? 'Tu'
          : String(members.find((m) => m.id === i.memberUid)?.displayName || 'Membro del team')
      )
      .join(', ');
  }
  function saved(id: string) {
    return (data.speakerInterests || []).some((i) => i.speakerId === id && i.memberUid === uid);
  }
  function owner(id: string) {
    const p = data.interviewPlans?.find((p) => p.speakerId === id);
    const value = assignmentOwner(p);
    return value
      ? assignees.find((member) => member.id === value || member.uid === value)?.displayName ||
          team.find((t) => t.id === value)?.displayName ||
          String(p?.assignedToName || 'Assegnazione precedente')
      : 'Da assegnare';
  }
  function speakerHref(reading = false, question = '') {
    const params = new URLSearchParams({ lang: language });
    if (talkId) params.set('talk', talkId);
    if (question) params.set('question', question);
    return `/speaker/${encodeURIComponent(selected)}${reading ? '/scaletta' : ''}?${params}`;
  }
  function changeOption(name: 'talk' | 'lang', value: string) {
    const url = new URL(page.url);
    url.searchParams.set(name, value);
    if (name === 'talk') url.searchParams.delete('question');
    summaryEditing = false;
    fullAbstract = false;
    void goto(url.pathname + url.search, { noScroll: true, keepFocus: true });
  }
  async function run(action: () => Promise<void>, success = '') {
    if (readOnly) return;
    busy = true;
    failure = '';
    message = '';
    try {
      await action();
      message = success;
    } catch (e) {
      failure = (e as Error).message;
      refreshWorkspace();
    } finally {
      busy = false;
    }
  }
  async function interest(id: string) {
    await run(async () => {
      await api('/api/conductor/interests', { speakerId: id, interested: !saved(id) });
      refreshWorkspace();
    });
  }
  function qtext(q: Entity) {
    return String(
      q[language === 'it' ? 'textIt' : 'textEn'] || q.textIt || q.textEn || 'Testo non disponibile'
    );
  }
  async function saveSelection(
    ids: string[],
    classic = (brief.brief?.classicQuestionIds || []) as string[],
    optional = brief.optionalQuestions.map((q) => q.id)
  ) {
    const record = {
      ...brief.brief,
      id: brief.brief?.id || briefId(selected, talkId),
      speakerId: selected,
      talkId,
      mainQuestionIds: ids,
      optionalQuestionIds: optional.filter((id) => !ids.includes(id)),
      classicQuestionIds: classic
    };
    await api('/api/conductor/brief', {
      brief: record,
      expectedRevision: brief.brief?.revision ?? null
    });
    refreshWorkspace();
  }
  function replace(old: string | null) {
    replacement = old;
    picker.showModal();
  }
  async function choose(id: string) {
    await run(async () => {
      let ids = brief.mainQuestions.map((q) => q.id);
      if (replacement) ids = ids.map((q) => (q === replacement ? id : q));
      else ids = [...ids, id];
      await saveSelection(ids);
      picker.close();
    }, 'Scaletta aggiornata per tutti.');
  }
  async function move(index: number, direction: number) {
    await run(async () => {
      const ids = brief.mainQuestions.map((q) => q.id);
      [ids[index], ids[index + direction]] = [ids[index + direction], ids[index]];
      await saveSelection(ids);
    }, 'Ordine aggiornato per tutti.');
  }
  async function moveOptional(index: number, direction: number) {
    await run(async () => {
      const ids = brief.optionalQuestions.map((q) => q.id);
      [ids[index], ids[index + direction]] = [ids[index + direction], ids[index]];
      await saveSelection(
        brief.mainQuestions.map((q) => q.id),
        undefined,
        ids
      );
    }, 'Ordine delle opzionali aggiornato per tutti.');
  }
  function edit(q: Entity) {
    editQuestion = { ...q };
    editLanguage = language;
    failure = '';
    questionDialog.showModal();
  }
  function closeQuestion() {
    if (busy) return;
    questionDialog.close();
    editQuestion = null;
  }
  async function saveQuestion(updated: Entity) {
    if (busy) return;
    busy = true;
    message = '';
    try {
      await onquestion(updated);
      questionDialog.close();
      editQuestion = null;
      message = 'Domanda aggiornata per tutti.';
    } catch (error) {
      refreshWorkspace();
      throw error;
    } finally {
      busy = false;
    }
  }
  async function summarySave() {
    await run(async () => {
      await api('/api/conductor/brief', {
        brief: {
          ...brief.brief,
          id: brief.brief?.id || briefId(selected, talkId),
          speakerId: selected,
          talkId,
          mainQuestionIds: brief.mainQuestions.map((q) => q.id),
          [language === 'it' ? 'summaryIt' : 'summaryEn']: draftSummary
        },
        expectedRevision: summaryRevision
      });
      refreshWorkspace();
      summaryEditing = false;
    }, 'Sintesi condivisa aggiornata.');
  }
</script>

<div class="conductor">
  {#if (mode === 'speaker' || mode === 'reading') && !speaker}
    <h1>Speaker non trovato</h1>
    <p>Lo speaker richiesto non è disponibile nel workspace.</p>
    <a class="nav-action" href="/">← Torna agli speaker</a>
  {:else if mode === 'home' || mode === 'speakers' || mode === 'topics' || mode === 'topic'}
    <div class="intro">
      <h1>
        {mode === 'home'
          ? 'Chi intervistiamo?'
          : mode === 'speakers'
            ? showAllSpeakers
              ? 'Tutti gli speaker'
              : 'Speaker in elenco'
            : mode === 'topic'
              ? `Topic: ${topic}`
              : 'Topic'}
      </h1>
      <p>Le domande sono già qui. Scegli una persona e prepara la conversazione.</p>
    </div>
    <label class="search"
      >Cerca speaker<input
        aria-label="Cerca speaker"
        type="search"
        bind:value={query}
        placeholder="Nome, organizzazione o argomento"
      /></label
    >
    {#if speakerList}
      <div class="speaker-list-controls">
        <p class="muted">
          Elenco generale: {showAllSpeakers
            ? 'tutti gli speaker.'
            : 'speaker in lista per le interviste.'}
        </p>
        <button type="button" aria-pressed={showAllSpeakers} onclick={toggleSpeakers}>
          {showAllSpeakers ? 'Mostra solo in elenco' : 'Mostra anche gli altri speaker'}
        </button>
      </div>
    {/if}
    {#if mode === 'home'}
      <section aria-label="I miei speaker e i miei assegnati">
        <h2>I miei speaker e i miei assegnati <span>{groups.personal.length}</span></h2>
        <p class="muted">
          I tuoi interessi e gli speaker assegnati a te, anche fuori lista. Visibili a tutto il
          team.
        </p>
        <div class="personal-filters" role="group" aria-label="Filtra i miei speaker">
          <button
            type="button"
            aria-pressed={personalFilter === 'tutti'}
            onclick={() => filterPersonal('tutti')}>Tutti i miei ({groups.personal.length})</button
          >
          <button
            type="button"
            class="interest-filter"
            aria-pressed={personalFilter === 'interessi'}
            onclick={() => filterPersonal('interessi')}
            >Mi interessano ({groups.saved.length})</button
          >
          <button
            type="button"
            class="assignment-filter"
            aria-pressed={personalFilter === 'assegnati'}
            onclick={() => filterPersonal('assegnati')}
            >Assegnati a me ({groups.assigned.length})</button
          >
        </div>
        {#if personalFilter === 'assegnati'}
          <label class="assigned-order">
            Ordine assegnati
            <select
              value={assignedOrder}
              onchange={(event) => changeAssignedOrder(event.currentTarget.value)}
            >
              <option value="orario">Orario del talk</option>
              <option value="nome">Nome</option>
            </select>
          </label>
          {#if assignedOrder === 'orario'}<p class="muted">
              Dal primo talk in programma, in orario Europe/Rome. Gli speaker senza orario sono in
              fondo.
            </p>{/if}
        {/if}
        <div class="speaker-cards">
          {#each personalSpeakers as s (s.id)}{@render card(s)}{:else}<p class="empty">
              {personalFilter === 'assegnati'
                ? 'Nessuno speaker assegnato a te con questo filtro.'
                : personalFilter === 'interessi'
                  ? 'Nessuno speaker di tuo interesse con questo filtro. Tocca «Mi interessa» per salvarne uno.'
                  : 'Nessun interesse o speaker assegnato a te con questo filtro. Tocca «Mi interessa» per salvarne uno.'}
            </p>{/each}
        </div>
      </section>
      <section>
        <h2>Ancora da assegnare</h2>
        <div class="speaker-cards">
          {#each unassignedSpeakers as s (s.id)}{@render card(s)}{:else}<p class="empty">
              Nessun altro speaker con questo filtro. Puoi consultare l’elenco completo.
            </p>{/each}
        </div>
      </section>
      {#if remainingSpeakers.length}
        <section aria-label="Altri speaker">
          <h2>Altri speaker</h2>
          <div class="speaker-cards">
            {#each remainingSpeakers as s (s.id)}{@render card(s)}{/each}
          </div>
        </section>
      {/if}
      <a
        class="nav-action all-speakers"
        href={'/speaker' + (showAllSpeakers ? '?elenco=tutti' : '')}>Vedi la lista completa</a
      >
    {:else}
      {#if mode === 'topics' || mode === 'topic'}
        <a class="nav-action" href="/topic/connessioni"
          >Esplora connessioni tra topic, speaker e domande</a
        >
        <nav class="topic-filters" aria-label="Filtra per topic">
          <a class="nav-action" class:active={!topic} href="/topic">Tutti</a>
          {#each topics as t}<a
              class="nav-action"
              class:active={topic === t}
              href={'/topic/' + encodeURIComponent(t)}>{t}</a
            >{/each}
        </nav>
      {/if}
      <div class="speaker-cards">
        {#each visibleSpeakers as s (s.id)}{@render card(s)}{:else}<p class="empty">
            Nessuno speaker con questo filtro.
          </p>{/each}
      </div>
    {/if}
  {:else if speaker && mode === 'reading'}
    <a class="nav-action" href={speakerHref()}>Torna alla scheda</a>
    <SpeakerPhoto {speaker} compact />
    <div class="brief-heading">
      <h1>{speaker.fullName}</h1>
      <div class="language-switch" role="group" aria-label="Lingua domande">
        <button
          type="button"
          class:current={language === 'it'}
          aria-pressed={language === 'it'}
          onclick={() => changeOption('lang', 'it')}>IT</button
        >
        <button
          type="button"
          class:current={language === 'en'}
          aria-pressed={language === 'en'}
          onclick={() => changeOption('lang', 'en')}>EN</button
        >
      </div>
    </div>
    {#if current}<StartInterview
        speakerId={selected}
        {talkId}
        {language}
        questionId={current.id}
        back="scaletta"
      />
      <p class="muted">
        Domanda {currentIndex + 1} di {brief.interviewQuestions
          .length}{brief.optionalQuestions.some((q) => q.id === current.id) ? ' · Opzionale' : ''}
      </p>
      <div class="interview-question"><Markdown text={qtext(current)} /></div>
      <div class="card-controls">
        {#if currentIndex > 0}<a
            class="nav-action"
            href={speakerHref(true, brief.interviewQuestions[currentIndex - 1].id)}>Indietro</a
          >{:else}<button disabled>Indietro</button>{/if}
        {#if currentIndex < brief.interviewQuestions.length - 1}<a
            class="nav-action primary"
            href={speakerHref(true, brief.interviewQuestions[currentIndex + 1].id)}>Avanti</a
          >{:else}<button disabled>Avanti</button>{/if}
        {#if canSkipOptional}<a
            class="nav-action"
            href={speakerHref(true, brief.mainQuestions.at(-1)!.id)}>Vai alla domanda finale</a
          >{/if}
      </div>
      {#if current[language === 'it' ? 'followUpIt' : 'followUpEn']}<details>
          <summary>Follow-up</summary><Markdown
            text={String(current[language === 'it' ? 'followUpIt' : 'followUpEn'])}
          />
        </details>{/if}
    {:else}<p role="status">
        La scaletta è cambiata e questa domanda non è più presente. Torna alla scheda per ripartire.
      </p>{/if}
  {:else if speaker}
    <a class="nav-action back" href="/">← Torna agli speaker</a>
    <a
      class="nav-action"
      href={'/topic/connessioni?node=' + encodeURIComponent('speaker:' + selected)}
      >Esplora connessioni</a
    >
    <SpeakerPhoto {speaker} />
    <div class="brief-heading">
      <div>
        <h1>{speaker.fullName}</h1>
        <p>{speaker.headline || speaker.organization || ''}</p>
      </div>
      <label
        >Lingua<select
          value={language}
          onchange={(event) => changeOption('lang', event.currentTarget.value)}
          ><option value="it">Italiano</option><option value="en">English</option></select
        ></label
      >
    </div>
    {#if talks.length > 1}<label
        >Talk<select
          value={talkId}
          onchange={(event) => changeOption('talk', event.currentTarget.value)}
          >{#each talks as t}<option value={t.id}>{t.title}</option>{/each}</select
        ></label
      >{/if}
    {#if brief.talk}<h2 class="talk-title">{brief.talk.title}</h2>
      <TalkSchedule talk={brief.talk} {data} />{/if}
    <section class="talk-summary">
      <h3>Il talk in 20 secondi</h3>
      <div id="talk-summary-content">
        {#if brief.summary}
          <Markdown
            text={fullAbstract && brief.summaryOrigin === 'abstract_excerpt'
              ? brief.abstract
              : brief.summary}
          />
          {#if brief.summaryOrigin === 'abstract_excerpt'}<small>
              {fullAbstract ? 'Abstract completo' : 'Estratto dell’abstract'} · sintesi editoriale non
              ancora preparata.
            </small>{/if}
        {:else}<p>
            La sintesi non è ancora disponibile. Puoi comunque leggere le domande e gli
            approfondimenti.
          </p>{/if}
        {#if fullAbstract && brief.summaryOrigin === 'editorial'}
          <h4>Abstract completo</h4>
          <Markdown text={brief.abstract} />
        {/if}
      </div>
      {#if brief.abstract && brief.abstract !== brief.summary}
        <button
          type="button"
          class="summary-toggle"
          aria-expanded={fullAbstract}
          aria-controls="talk-summary-content"
          onclick={() => (fullAbstract = !fullAbstract)}
        >
          {fullAbstract ? 'Mostra meno' : 'Mostra abstract completo'}
        </button>
      {/if}
    </section>
    <div class="interest-bar">
      <button
        class:primary={saved(selected)}
        disabled={busy || readOnly}
        onclick={() => interest(selected)}
        >{saved(selected) ? '★ Salvato tra i miei speaker' : 'Mi interessa'}</button
      ><span>Interessati: {names(selected) || 'nessuno'}</span>
    </div>
    <AssignmentControl {speaker} {plan} />
    <section class="question-sheet">
      <h2>Le 3 domande principali</h2>
      <p class="muted">
        {brief.selectionOrigin === 'editorial'
          ? 'Scaletta condivisa'
          : 'Proposta dall’ordine esistente · da confermare'} · tutti possono modificarla.
      </p>
      {#each brief.mainQuestions as q, index (q.id)}<article class="question-row">
          <span class="question-number">{index + 1}</span>
          <div>
            <Markdown text={qtext(q)} />{#if index === brief.mainQuestions.length - 1}<small
                >Domanda finale</small
              >{/if}{#if !q[language === 'it' ? 'textIt' : 'textEn']}<small
                >Traduzione mancante: testo originale.</small
              >{/if}
            <div class="question-actions">
              <a
                class="nav-action"
                href={'/topic/connessioni?node=' + encodeURIComponent('question:' + q.id)}
                >Domande simili e topic</a
              >
              <button disabled={busy || readOnly} onclick={() => edit(q)}>Modifica</button><button
                disabled={busy || readOnly}
                onclick={() => replace(q.id)}>Sostituisci</button
              ><button
                aria-label={'Sposta domanda ' + (index + 1) + ' in alto'}
                disabled={busy || readOnly || index === 0}
                onclick={() => move(index, -1)}>↑</button
              ><button
                aria-label={'Sposta domanda ' + (index + 1) + ' in basso'}
                disabled={busy || readOnly || index === brief.mainQuestions.length - 1}
                onclick={() => move(index, 1)}>↓</button
              ><button
                disabled={busy || readOnly}
                onclick={() =>
                  run(
                    () =>
                      saveSelection(
                        brief.mainQuestions.filter((x) => x.id !== q.id).map((x) => x.id)
                      ),
                    'Domanda tolta dalla scaletta, conservata nell’elenco.'
                  )}>Togli</button
              >
            </div>
            {#if q.whyMd || q.sourceIds || q.materialIds}<details>
                <summary>Perché questa domanda e fonti</summary><Markdown
                  text={String(q.whyMd || '')}
                />{#each (q.sourceIds || []) as string[] as id}<p>
                    {data.sources?.find((s) => s.id === id)?.title || id}
                  </p>{/each}{#each (q.materialIds || []) as string[] as id}<p>
                    {data.materials?.find((s) => s.id === id)?.title || 'Materiale di ricerca'}
                  </p>{/each}
              </details>{/if}
          </div>
        </article>{/each}
      <p class="muted">
        {brief.mainQuestions.length} domande disponibili nella scaletta.
      </p>
      <button disabled={busy || readOnly} onclick={() => replace(null)}>Scegli una domanda</button>
      <StartInterview
        speakerId={selected}
        {talkId}
        {language}
        disabled={!brief.mainQuestions.length}
      />
      {#if brief.mainQuestions.length}
        <a
          class="nav-action primary start-interview"
          href={speakerHref(true, brief.interviewQuestions[0].id)}>Usa la scaletta</a
        >
      {:else}<button class="primary start-interview" disabled>Usa la scaletta</button>{/if}
    </section>
    <section aria-label="Domande opzionali" class="question-sheet">
      <h2>Domande opzionali</h2>
      <p class="muted">
        Se c’è tempo, compaiono prima dell’ultima domanda principale, che resta la chiusura.
      </p>
      {#each brief.optionalQuestions as q, index (q.id)}
        <article class="card">
          <Markdown text={qtext(q)} />
          <div class="question-actions">
            <button disabled={busy || readOnly} onclick={() => edit(q)}>Modifica</button>
            <button
              aria-label={'Sposta domanda opzionale ' + (index + 1) + ' in alto'}
              disabled={busy || readOnly || index === 0}
              onclick={() => moveOptional(index, -1)}>↑</button
            >
            <button
              aria-label={'Sposta domanda opzionale ' + (index + 1) + ' in basso'}
              disabled={busy || readOnly || index === brief.optionalQuestions.length - 1}
              onclick={() => moveOptional(index, 1)}>↓</button
            >
            <button
              disabled={busy || readOnly}
              onclick={() =>
                run(
                  () =>
                    saveSelection(
                      brief.mainQuestions.map((main) => main.id),
                      undefined,
                      brief.optionalQuestions
                        .filter((optional) => optional.id !== q.id)
                        .map((optional) => optional.id)
                    ),
                  'Domanda tolta dalle opzionali.'
                )}>Togli dalle opzionali</button
            >
          </div>
        </article>
      {:else}<p class="muted">
          Nessuna domanda opzionale. Puoi sceglierle da Tutte le domande.
        </p>{/each}
    </section>
    <details>
      <summary>Domande classiche</summary>{#each brief.classicQuestions as q}<div class="card">
          <Markdown text={qtext(q)} /><button
            disabled={busy || readOnly || brief.mainQuestions.some((m) => m.id === q.id)}
            onclick={() => choose(q.id)}>Aggiungi alla scaletta</button
          >
        </div>{:else}<p>
          Nessuna domanda classica selezionata. Puoi indicarle dall’elenco completo.
        </p>{/each}
    </details>
    <details>
      <summary>Tutte le domande ({questions.length})</summary>{#each questions as q}<div
          class="card"
        >
          <Markdown text={qtext(q)} />
          <div class="question-actions">
            <a
              class="nav-action"
              href={'/topic/connessioni?node=' + encodeURIComponent('question:' + q.id)}
              >Domande simili e topic</a
            >
            <button
              disabled={busy ||
                readOnly ||
                brief.mainQuestions.some((main) => main.id === q.id) ||
                brief.optionalQuestions.some((optional) => optional.id === q.id)}
              onclick={() =>
                run(
                  () =>
                    saveSelection(
                      brief.mainQuestions.map((main) => main.id),
                      undefined,
                      [...brief.optionalQuestions.map((optional) => optional.id), q.id]
                    ),
                  'Domanda aggiunta alle opzionali.'
                )}
            >
              {brief.mainQuestions.some((main) => main.id === q.id)
                ? 'Domanda principale'
                : brief.optionalQuestions.some((optional) => optional.id === q.id)
                  ? 'Già opzionale'
                  : 'Usa come opzionale'}
            </button>
            <button disabled={busy || readOnly} onclick={() => edit(q)}>Modifica</button><button
              disabled={busy || readOnly}
              onclick={() =>
                run(
                  () =>
                    saveSelection(
                      brief.mainQuestions.map((m) => m.id),
                      brief.classicQuestions.some((c) => c.id === q.id)
                        ? brief.classicQuestions.filter((c) => c.id !== q.id).map((c) => c.id)
                        : [...brief.classicQuestions.map((c) => c.id), q.id]
                    ),
                  'Domande classiche aggiornate.'
                )}
              >{brief.classicQuestions.some((c) => c.id === q.id)
                ? 'Togli dalle classiche'
                : 'Segna come classica'}</button
            >
          </div>
        </div>{/each}
    </details>
    <details>
      <summary>Approfondimenti e fonti ({research.length})</summary
      >{#each research as entry}<article class="card">
          <h3>{entry.entity.title || 'Ricerca'}</h3>
          <ResearchReader
            text={String(entry.entity.bodyMd || entry.entity.notesMd || '')}
          />{#if entry.entity.url}<Markdown
              text={'[Apri fonte](' + String(entry.entity.url) + ')'}
            />{/if}<a href={'/backoffice/speaker/' + encodeURIComponent(selected) + '/note'}
            >Apri in gestione</a
          >
        </article>{:else}<p>Non sono ancora presenti approfondimenti per questo speaker.</p>{/each}
    </details>
    <details>
      <summary>Sintesi editoriale</summary>{#if !summaryEditing}<button
          disabled={readOnly}
          onclick={() => {
            draftSummary = String(
              brief.brief?.[language === 'it' ? 'summaryIt' : 'summaryEn'] || ''
            );
            summaryRevision = brief.brief?.revision ?? null;
            summaryEditing = true;
          }}>Modifica sintesi condivisa</button
        >{:else}<label
          >Sintesi del talk<textarea bind:value={draftSummary} rows="5"></textarea></label
        ><button disabled={busy || readOnly} onclick={summarySave}>Salva sintesi per tutti</button
        ><button onclick={() => (summaryEditing = false)}>Annulla</button>{/if}
    </details>
  {/if}
  {#if failure}<p class="error" role="alert">{failure}</p>{/if}
  <SuccessNotice {message} ondismiss={() => (message = '')} />
</div>

{#snippet card(s: Entity)}
  {@const assignedView = mode === 'home' && personalFilter === 'assegnati'}
  {@const talk = assignedView
    ? firstSpeakerTalk(s.id, data)
    : data.talks?.find((t) => ((t.speakerIds as string[]) || []).includes(s.id))}
  {@const preparation = resolveBrief(data, s.id, talk?.id || '')}
  {@const inList = isInInterviewList(s)}
  {@const assignment = data.interviewPlans?.find((plan) => plan.speakerId === s.id)}
  {@const mine = groups.assigned.some((speaker) => speaker.id === s.id)}
  <article class="speaker-card" class:outside-list={!inList} data-speaker={s.id}>
    <div class="card-top">
      <span class="list-badge">{inList ? 'In lista' : 'Fuori lista'}</span>
      <span>{((s.tags || []) as string[]).slice(0, 3).join(' · ')}</span>
    </div>
    <div class="card-statuses">
      {#if saved(s.id)}<span class="interest-badge">Mi interessa</span>{/if}
      <span class="assignment-badge" class:assigned={!!assignmentOwner(assignment)}>
        {mine
          ? 'Assegnato a me'
          : assignmentOwner(assignment)
            ? `Assegnato a ${owner(s.id)}`
            : 'Da assegnare'}
      </span>
    </div>
    <div class="speaker-identity">
      <SpeakerPhoto speaker={s} compact />
      <div>
        <h3>{s.fullName}</h3>
        <p>{s.headline || s.organization || ''}</p>
      </div>
    </div>
    <small
      >{preparation.brief
        ? `${preparation.mainQuestions.length} domande in scaletta`
        : preparation.mainQuestions.length
          ? 'Domande disponibili · da confermare'
          : 'Scaletta da preparare'}</small
    >
    {#if talk}
      <p class="card-talk">{talk.title}</p>
      <TalkSchedule talk={data.talks?.find((source) => source.id === talk.id) || talk} {data} />
    {/if}
    {#if assignedView && (!talk || talkStartTime(talk) === undefined)}<p class="muted">
        Orario del talk da confermare.
      </p>{/if}
    <small>Interessati: {names(s.id) || 'nessuno'}</small>
    <div class="card-controls">
      <button disabled={busy || readOnly} onclick={() => interest(s.id)}
        >{saved(s.id) ? '★ Salvato' : 'Mi interessa'}</button
      ><a
        class="nav-action primary"
        href={'/speaker/' +
          encodeURIComponent(s.id) +
          (assignedView && talk
            ? '?' + new URLSearchParams({ talk: talk.id, lang: language })
            : '')}>Apri scheda</a
      >
    </div>
  </article>
{/snippet}
<dialog
  bind:this={questionDialog}
  aria-labelledby="edit-question-title"
  oncancel={(event) => {
    if (busy) event.preventDefault();
    else editQuestion = null;
  }}
>
  <h2 id="edit-question-title">Modifica condivisa</h2>
  <p>
    Le modifiche sono condivise con tutti. Apri «Mostra tutti i campi editoriali» per modificare
    anche traduzioni, follow-up, motivazione, note e gli altri campi della domanda.
  </p>
  {#if editQuestion}
    <Editor
      collection="questions"
      entity={editQuestion}
      {members}
      {busy}
      initialEditing
      primaryFields={[editLanguage === 'it' ? 'textIt' : 'textEn']}
      saveLabel="Salva per tutti"
      onsave={saveQuestion}
      oncancel={closeQuestion}
      onclose={closeQuestion}
    />
  {/if}
</dialog>
<dialog bind:this={picker} aria-labelledby="question-picker-title">
  <h2 id="question-picker-title">Scegli una domanda</h2>
  <p>La scelta aggiornerà la scaletta di tutti.</p>
  {#each questions.filter((q) => !brief.mainQuestions.some((m) => m.id === q.id)) as q}<article
      class="card"
    >
      <Markdown text={qtext(q)} /><button disabled={busy || readOnly} onclick={() => choose(q.id)}
        >Usa questa domanda</button
      >
    </article>{:else}<p>
      Non ci sono altre domande strutturate. Puoi aggiungerle da Gestione.
    </p>{/each}{#if failure}<p role="alert">{failure}</p>{/if}<button
    disabled={busy}
    onclick={() => picker.close()}>Chiudi</button
  >
</dialog>

<style>
  .speaker-identity {
    display: flex;
    align-items: center;
    gap: 0.85rem;
    margin: 0.75rem 0;
  }
  .speaker-identity > div {
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .conductor {
    max-width: 960px;
    margin: 0 auto;
    padding: 0 8px 50px;
    color: #263e32;
  }
  .conductor h1 {
    font-size: clamp(2rem, 6vw, 3.2rem);
    line-height: 1.1;
    margin: 24px 0 12px;
  }
  .intro {
    max-width: 650px;
  }
  .intro p {
    font-size: 18px;
    color: #62715d;
  }
  .search {
    display: block;
    margin: 24px 0;
    max-width: 650px;
  }
  .conductor section {
    margin: 30px 0;
  }
  .conductor h2 {
    font-size: 24px;
  }
  .conductor h2 span {
    font-size: 16px;
    color: #6e7e62;
  }
  .muted {
    color: #66755e;
    font-size: 14px;
  }
  .speaker-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 290px), 1fr));
    gap: 16px;
  }
  .speaker-card {
    padding: 20px;
    background: #edf4e7;
    border: 1px solid #bdcfb4;
    border-radius: 16px;
  }
  .speaker-card.outside-list {
    background: #fff0e5;
    border-color: #e1c3af;
  }
  .personal-filters {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin: 16px 0;
  }
  .assigned-order {
    display: block;
    max-width: 300px;
    margin: 16px 0;
  }
  .personal-filters button {
    background: #fffef9;
    color: #263e32;
    border: 1px solid #a8b59b;
  }
  .personal-filters button[aria-pressed='true'] {
    background: #245844;
    border-color: #245844;
    color: white;
  }
  .personal-filters .interest-filter[aria-pressed='true'],
  .interest-badge {
    background: #eadff5;
    border-color: #9982b1;
    color: #553d70;
  }
  .personal-filters .assignment-filter[aria-pressed='true'],
  .assignment-badge.assigned {
    background: #dcebf9;
    border-color: #7c9fbf;
    color: #294c70;
  }
  .list-badge {
    font-weight: 650;
  }
  .card-statuses {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-top: 10px;
  }
  .speaker-card h3 {
    font-size: 25px;
    margin: 14px 0 8px;
  }
  .speaker-card p {
    margin: 8px 0;
    line-height: 1.5;
  }
  .card-top {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    font-size: 12px;
    color: #627458;
    flex-wrap: wrap;
  }
  .assignment-badge,
  .interest-badge {
    font-size: 12px;
    font-weight: 600;
    border-radius: 6px;
    padding: 4px 7px;
  }
  .assignment-badge {
    background: #e9eddf;
  }
  .card-talk {
    font-weight: 550;
  }
  .card-controls {
    display: flex;
    gap: 10px;
    justify-content: space-between;
    flex-wrap: wrap;
    margin-top: 20px;
  }
  .topic-filters {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 18px 0;
  }
  .nav-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    border: 1px solid #bbcadd;
    border-radius: 7px;
    padding: 0.55rem 0.9rem;
    background: #fff;
    color: var(--blue);
    font-weight: 600;
    text-decoration: none;
  }
  .nav-action:hover {
    background: #e6edf8;
  }
  .nav-action.primary,
  .nav-action.active {
    background: #245844;
    color: white;
  }
  .empty {
    background: #edf0e5;
    padding: 20px;
    border-radius: 12px;
    line-height: 1.6;
  }
  .all-speakers {
    margin-top: 20px;
  }
  .brief-heading {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 14px;
  }
  .brief-heading h1 {
    font-size: 36px;
  }
  .brief-heading label {
    min-width: 100px;
  }
  .talk-title {
    font-size: 22px !important;
    line-height: 1.4;
  }
  .talk-summary {
    background: #edf0e5;
    padding: 20px;
    border-radius: 14px;
  }
  .talk-summary h3 {
    margin: 0 0 10px;
  }
  .summary-toggle {
    margin-top: 12px;
    padding: 6px 12px;
    font-size: 0.9rem;
  }
  .interest-bar {
    display: flex;
    align-items: center;
    gap: 15px;
    flex-wrap: wrap;
  }
  .interest-bar span {
    font-size: 14px;
  }
  .question-sheet {
    background: #fffef9;
    border: 1px solid #d6deca;
    padding: 22px;
    border-radius: 16px;
  }
  .question-row {
    display: grid;
    grid-template-columns: 24px 1fr;
    gap: 12px;
    border-top: 1px solid #dfe4d5;
    padding: 20px 0;
  }
  .question-number {
    font-size: 22px;
    color: #96682c;
  }
  .question-row :global(.markdown) {
    font-size: 19px;
    line-height: 1.6;
  }
  .question-actions {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-top: 10px;
  }
  .question-actions button {
    font-size: 13px;
  }
  .start-interview {
    width: 100%;
    margin-top: 20px;
  }
  .interview-question {
    font-size: clamp(26px, 5vw, 40px);
    line-height: 1.5;
    padding: 30px 0;
    min-height: 250px;
  }
  .conductor details {
    border-bottom: 1px solid #d7decc;
    padding: 10px 0;
  }
  .conductor summary {
    font-weight: 650;
    cursor: pointer;
    min-height: 44px;
    padding: 12px 0;
  }
  .conductor :global(button),
  .conductor :global(select),
  dialog button {
    min-height: 44px;
  }
  .conductor :global(textarea) {
    width: 100%;
  }
  .conductor :global(.markdown) {
    overflow-wrap: anywhere;
  }
  .card {
    padding: 16px;
    background: #fffef9;
    border: 1px solid #d6deca;
    border-radius: 10px;
    margin: 12px 0;
  }
  dialog {
    width: calc(100% - 24px);
    max-width: 600px;
    max-height: 85vh;
    overflow: auto;
    border: 1px solid #bdc9b1;
    border-radius: 16px;
    padding: 24px;
  }
  dialog::backdrop {
    background: #18382c88;
  }
  dialog :global(textarea) {
    width: 100%;
  }
  small {
    color: #62715d;
  }
  .back {
    margin-top: 18px;
  }
  @media (max-width: 650px) {
    .conductor {
      padding: 0 0 30px;
    }
    .question-sheet {
      padding: 16px;
    }
    .brief-heading {
      align-items: start;
      flex-wrap: wrap;
    }
    .speaker-card {
      padding: 18px;
    }
  }
</style>
