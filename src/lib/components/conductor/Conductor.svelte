<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import type { Dataset, Entity } from '$lib/fields';
  import { searchSpeakers } from '$lib/speaker-search';
  import { groupSpeakers } from '$lib/conductor/home';
  import { resolveBrief, briefId } from '$lib/conductor/brief';
  import { assignmentOwner } from '$lib/conductor/assignment';
  import { team } from '$lib/team';
  import { api, refreshWorkspace } from '$lib/repository';
  import Markdown from '../Markdown.svelte';
  import ResearchReader from '../ResearchReader.svelte';
  import { researchEntries } from '$lib/research';
  import AssignmentControl from './AssignmentControl.svelte';
  let {
    data,
    members,
    uid,
    onquestion,
    mode = 'home',
    selected = '',
    topic = ''
  }: {
    data: Dataset;
    members: Entity[];
    uid: string;
    onquestion: (q: Entity) => Promise<void>;
    mode?: 'home' | 'speakers' | 'speaker' | 'reading' | 'topics' | 'topic';
    selected?: string;
    topic?: string;
  } = $props();
  const language = $derived(page.url.searchParams.get('lang') === 'en' ? 'en' : 'it');
  let query = $state('');
  let busy = $state(false);
  let failure = $state('');
  let message = $state('');
  let editQuestion = $state<Entity | null>(null);
  let editText = $state('');
  let editLanguage = $state<'it' | 'en'>('it');
  let questionDialog: HTMLDialogElement;
  let replacement = $state<string | null>(null);
  let picker: HTMLDialogElement;
  let draftSummary = $state('');
  let summaryEditing = $state(false);
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
      topic
    )
  );
  const topics = $derived(
    [...new Set((data.speakers || []).flatMap((s) => (s.tags as string[]) || []))].sort()
  );
  const questions = $derived(
    (data.questions || []).filter((q) => q.speakerId === selected && q.status !== 'rejected')
  );
  const liveId = $derived(
    page.url.searchParams.get('question') || brief.mainQuestions[0]?.id || ''
  );
  const current = $derived(brief.mainQuestions.find((q) => q.id === liveId));
  const currentIndex = $derived(brief.mainQuestions.findIndex((q) => q.id === liveId));
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
      ? team.find((t) => t.id === value)?.displayName ||
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
    void goto(url.pathname + url.search, { noScroll: true, keepFocus: true });
  }
  async function run(action: () => Promise<void>, success = '') {
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
    classic = (brief.brief?.classicQuestionIds || []) as string[]
  ) {
    const record = {
      ...brief.brief,
      id: brief.brief?.id || briefId(selected, talkId),
      speakerId: selected,
      talkId,
      mainQuestionIds: ids,
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
  function edit(q: Entity) {
    editQuestion = { ...q };
    editLanguage = language;
    editText = String(q[language === 'it' ? 'textIt' : 'textEn'] || '');
    questionDialog.showModal();
  }
  async function saveQuestion() {
    await run(async () => {
      if (!editQuestion || !editText.trim()) throw Error('Inserisci il testo della domanda.');
      await onquestion({
        ...editQuestion,
        [editLanguage === 'it' ? 'textIt' : 'textEn']: editText
      });
      questionDialog.close();
      editQuestion = null;
    }, 'Domanda aggiornata per tutti.');
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
            ? 'Tutti gli speaker'
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
    {#if mode === 'home'}
      <section aria-label="I miei speaker">
        <h2>I miei speaker <span>{groups.saved.length}</span></h2>
        <p class="muted">I tuoi interessi, visibili anche agli altri.</p>
        {#if !groups.saved.length}<div class="empty">
            Tocca «Mi interessa» su uno speaker: lo ritroverai qui, anche dopo l’assegnazione.
          </div>{/if}
        <div class="speaker-cards">
          {#each groups.saved as s (s.id)}{@render card(s)}{/each}
        </div>
      </section>
      <section>
        <h2>Ancora da assegnare</h2>
        <div class="speaker-cards">
          {#each groups.unassigned as s (s.id)}{@render card(s)}{:else}<p class="empty">
              Nessun altro speaker con questo filtro. Puoi consultare l’elenco completo.
            </p>{/each}
        </div>
      </section>
      <a class="nav-action all-speakers" href="/speaker">Tutti gli speaker, anche assegnati</a>
    {:else}
      {#if mode === 'topics' || mode === 'topic'}
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
        {#each groups.all as s (s.id)}{@render card(s)}{:else}<p class="empty">
            Nessuno speaker con questo filtro.
          </p>{/each}
      </div>
    {/if}
  {:else if speaker && mode === 'reading'}
    <a class="nav-action" href={speakerHref()}>Torna alla scheda</a>
    <h1>{speaker.fullName}</h1>
    {#if current}<p class="muted">Domanda {currentIndex + 1} di {brief.mainQuestions.length}</p>
      <div class="interview-question"><Markdown text={qtext(current)} /></div>
      <div class="card-controls">
        {#if currentIndex > 0}<a
            class="nav-action"
            href={speakerHref(true, brief.mainQuestions[currentIndex - 1].id)}>Indietro</a
          >{:else}<button disabled>Indietro</button>{/if}
        {#if currentIndex < brief.mainQuestions.length - 1}<a
            class="nav-action primary"
            href={speakerHref(true, brief.mainQuestions[currentIndex + 1].id)}>Avanti</a
          >{:else}<button disabled>Avanti</button>{/if}
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
    {#if brief.talk}<h2 class="talk-title">{brief.talk.title}</h2>{/if}
    <section class="talk-summary">
      <h3>Il talk in 20 secondi</h3>
      {#if brief.summary}<Markdown
          text={brief.summary}
        />{#if brief.summaryOrigin === 'abstract_excerpt'}<small
            >Estratto dell’abstract · sintesi editoriale non ancora preparata.</small
          >{/if}{:else}<p>
          La sintesi non è ancora disponibile. Puoi comunque leggere le domande e gli
          approfondimenti.
        </p>{/if}
    </section>
    <div class="interest-bar">
      <button class:primary={saved(selected)} disabled={busy} onclick={() => interest(selected)}
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
            <Markdown text={qtext(q)} />{#if !q[language === 'it' ? 'textIt' : 'textEn']}<small
                >Traduzione mancante: testo originale.</small
              >{/if}
            <div class="question-actions">
              <button disabled={busy} onclick={() => edit(q)}>Modifica</button><button
                disabled={busy}
                onclick={() => replace(q.id)}>Sostituisci</button
              ><button
                aria-label={'Sposta domanda ' + (index + 1) + ' in alto'}
                disabled={busy || index === 0}
                onclick={() => move(index, -1)}>↑</button
              ><button
                aria-label={'Sposta domanda ' + (index + 1) + ' in basso'}
                disabled={busy || index === brief.mainQuestions.length - 1}
                onclick={() => move(index, 1)}>↓</button
              ><button
                disabled={busy}
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
      {#if brief.mainQuestions.length < 3}<p class="muted">
          {brief.mainQuestions.length} domande disponibili nella scaletta.
        </p>
        <button disabled={busy} onclick={() => replace(null)}>Scegli una domanda</button>{/if}
      {#if brief.mainQuestions.length}
        <a
          class="nav-action primary start-interview"
          href={speakerHref(true, brief.mainQuestions[0].id)}>Usa la scaletta</a
        >
      {:else}<button class="primary start-interview" disabled>Usa la scaletta</button>{/if}
    </section>
    <details>
      <summary>Domande classiche</summary>{#each brief.classicQuestions as q}<div class="card">
          <Markdown text={qtext(q)} /><button
            disabled={busy ||
              brief.mainQuestions.length >= 3 ||
              brief.mainQuestions.some((m) => m.id === q.id)}
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
            <button disabled={busy} onclick={() => edit(q)}>Modifica</button><button
              disabled={busy}
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
            />{/if}<a href={'/backoffice/speaker/' + encodeURIComponent(selected)}
            >Apri in gestione</a
          >
        </article>{:else}<p>Non sono ancora presenti approfondimenti per questo speaker.</p>{/each}
    </details>
    <details>
      <summary>Sintesi editoriale</summary>{#if !summaryEditing}<button
          onclick={() => {
            draftSummary = String(
              brief.brief?.[language === 'it' ? 'summaryIt' : 'summaryEn'] || ''
            );
            summaryRevision = brief.brief?.revision ?? null;
            summaryEditing = true;
          }}>Modifica sintesi condivisa</button
        >{:else}<label
          >Sintesi del talk<textarea bind:value={draftSummary} rows="5"></textarea></label
        ><button disabled={busy} onclick={summarySave}>Salva sintesi per tutti</button><button
          onclick={() => (summaryEditing = false)}>Annulla</button
        >{/if}
    </details>
  {/if}
  {#if failure}<p class="error" role="alert">{failure}</p>{/if}{#if message}<p
      class="success"
      role="status"
    >
      {message}
    </p>{/if}
</div>

{#snippet card(s: Entity)}
  {@const talk = data.talks?.find((t) => ((t.speakerIds as string[]) || []).includes(s.id))}
  {@const preparation = resolveBrief(data, s.id, talk?.id || '')}
  <article class="speaker-card" data-speaker={s.id}>
    <div class="card-top">
      <span>{((s.tags || []) as string[]).slice(0, 3).join(' · ')}</span><span
        class="assignment-badge">{owner(s.id)}</span
      >
    </div>
    <h3>{s.fullName}</h3>
    <p>{s.headline || s.organization || ''}</p>
    <small
      >{preparation.brief
        ? `${preparation.mainQuestions.length} domande in scaletta`
        : preparation.mainQuestions.length
          ? 'Domande disponibili · da confermare'
          : 'Scaletta da preparare'}</small
    >
    {#if data.talks?.find((t) => ((t.speakerIds as string[]) || []).includes(s.id))}<p
        class="card-talk"
      >
        {data.talks.find((t) => ((t.speakerIds as string[]) || []).includes(s.id))?.title}
      </p>{/if}<small>Interessati: {names(s.id) || 'nessuno'}</small>
    <div class="card-controls">
      <button disabled={busy} onclick={() => interest(s.id)}
        >{saved(s.id) ? '★ Salvato' : 'Mi interessa'}</button
      ><a class="nav-action primary" href={'/speaker/' + encodeURIComponent(s.id)}>Apri scheda</a>
    </div>
  </article>
{/snippet}
<dialog bind:this={questionDialog} aria-labelledby="edit-question-title">
  <h2 id="edit-question-title">Modifica condivisa</h2>
  <p>
    Il testo in {editLanguage === 'it' ? 'italiano' : 'inglese'} cambierà per tutti. L’altra lingua resta
    invariata.
  </p>
  <label>Testo della domanda<textarea bind:value={editText} rows="6"></textarea></label
  >{#if failure}<p role="alert">{failure}</p>{/if}
  <div class="card-controls">
    <button disabled={busy} onclick={() => questionDialog.close()}>Annulla</button><button
      class="primary"
      disabled={busy}
      onclick={saveQuestion}>Salva per tutti</button
    >
  </div>
</dialog>
<dialog bind:this={picker} aria-labelledby="question-picker-title">
  <h2 id="question-picker-title">Scegli una domanda</h2>
  <p>La scelta aggiornerà la scaletta di tutti.</p>
  {#each questions.filter((q) => !brief.mainQuestions.some((m) => m.id === q.id)) as q}<article
      class="card"
    >
      <Markdown text={qtext(q)} /><button disabled={busy} onclick={() => choose(q.id)}
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
    background: #fffef9;
    border: 1px solid #d6deca;
    border-radius: 16px;
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
  .assignment-badge {
    background: #e9eddf;
    border-radius: 6px;
    padding: 4px 7px;
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
  dialog textarea {
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
