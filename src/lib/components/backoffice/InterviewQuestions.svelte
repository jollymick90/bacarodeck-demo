<script lang="ts">
  import StartInterview from '../conductor/StartInterview.svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { getWorkspace } from '$lib/workspace.svelte';
  import { briefId, resolveBrief } from '$lib/conductor/brief';
  import { api, refreshData, refreshWorkspace } from '$lib/repository';
  import { provenanceLabel, safeUrl } from '$lib/domain';
  import { translate, type Entity } from '$lib/fields';
  import { team } from '$lib/team';
  import QuestionRating from '$lib/components/QuestionRating.svelte';
  import InterviewBadges from '$lib/components/InterviewBadges.svelte';
  import Markdown from '$lib/components/Markdown.svelte';

  let { speakerId, ondelete }: { speakerId: string; ondelete: (question: Entity) => void } =
    $props();
  const workspace = getWorkspace();
  const data = $derived(workspace.data);
  const talks = $derived(
    (data.talks || []).filter((talk) => ((talk.speakerIds as string[]) || []).includes(speakerId))
  );
  const talkId = $derived(
    talks.find((talk) => talk.id === page.url.searchParams.get('talk'))?.id || talks[0]?.id || ''
  );
  const language = $derived(page.url.searchParams.get('lang') === 'en' ? 'en' : 'it');
  const brief = $derived(resolveBrief(data, speakerId, talkId, language));
  const selectedIds = $derived(brief.mainQuestions.map((question) => question.id));
  const optionalIds = $derived(brief.optionalQuestions.map((question) => question.id));
  const plan = $derived(data.interviewPlans?.find((plan) => plan.speakerId === speakerId));
  let sortByRating = $state(false);
  let busy = $state(false);
  let failure = $state('');
  const others = $derived(
    (data.questions || [])
      .filter(
        (question) =>
          question.speakerId === speakerId &&
          !selectedIds.includes(question.id) &&
          !optionalIds.includes(question.id)
      )
      .toSorted((a, b) =>
        sortByRating ? average(b) - average(a) : Number(a.order || 0) - Number(b.order || 0)
      )
  );
  const contextQuery = $derived(
    new URLSearchParams({ speaker: speakerId, talk: talkId, lang: language }).toString()
  );
  const text = (value: unknown) => (typeof value === 'string' ? value : '');
  const questionText = (question: Entity) =>
    text(question[language === 'it' ? 'textIt' : 'textEn']) ||
    text(question.textIt) ||
    text(question.textEn) ||
    'Testo non disponibile';
  function average(question: Entity) {
    const ratings = Object.values((question.ratings || {}) as Record<string, number>);
    return ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : 0;
  }
  function option(name: 'talk' | 'lang', value: string) {
    const params = new URLSearchParams(page.url.search);
    params.set(name, value);
    void goto(page.url.pathname + '?' + params, { noScroll: true, keepFocus: true });
  }
  async function saveSelection(ids: string[], optional = optionalIds) {
    if (busy) return;
    busy = true;
    failure = '';
    try {
      const updated: Entity = await api('/api/conductor/brief', {
        brief: {
          ...brief.brief,
          id: brief.brief?.id || briefId(speakerId, talkId),
          speakerId,
          talkId,
          mainQuestionIds: ids,
          optionalQuestionIds: optional,
          classicQuestionIds: brief.brief?.classicQuestionIds || []
        },
        expectedRevision: brief.brief?.revision ?? null
      });
      // Apply the saved revision before enabling another selection change.
      workspace.data.conductorBriefs = [
        ...(workspace.data.conductorBriefs || []).filter((item) => item.id !== updated.id),
        updated
      ];
      refreshWorkspace();
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
      refreshWorkspace();
    } finally {
      busy = false;
    }
  }
  function move(index: number, direction: number, optional = false) {
    const ids = [...(optional ? optionalIds : selectedIds)];
    [ids[index], ids[index + direction]] = [ids[index + direction], ids[index]];
    if (optional) void saveSelection(selectedIds, ids);
    else void saveSelection(ids);
  }
</script>

<div class="interview-tools">
  <StartInterview
    {speakerId}
    {talkId}
    {language}
    back="gestione"
    disabled={!selectedIds.length || busy}
  />
  {#if talks.length > 1}<label
      >Talk<select
        value={talkId}
        disabled={busy}
        onchange={(event) => option('talk', event.currentTarget.value)}
        >{#each talks as talk}<option value={talk.id}>{talk.title}</option>{/each}</select
      ></label
    >{/if}
  <div class="language-switch" role="group" aria-label="Lingua domande">
    <button disabled={busy} aria-pressed={language === 'it'} onclick={() => option('lang', 'it')}
      >IT</button
    >
    <button disabled={busy} aria-pressed={language === 'en'} onclick={() => option('lang', 'en')}
      >EN</button
    >
  </div>
  <a class="button-link primary" href={'/backoffice/nuovo/questions?' + contextQuery}
    >Aggiungi domanda</a
  >
</div>
{#if failure}<p role="alert" class="error">{failure}</p>{/if}
<section class="interview-selection" aria-label="Domande per intervista">
  <h2>Domande per intervista <small>{selectedIds.length}/3</small></h2>
  <p class="muted">Questa selezione e il suo ordine sono condivisi con i conduttori.</p>
  {#if brief.selectionOrigin === 'legacy_proposal'}<p class="notice">
      Proposte dall’ordine attuale: la scaletta non è ancora stata confermata.
    </p>
    <button disabled={busy} onclick={() => saveSelection(selectedIds)}
      >Conferma domande per intervista</button
    >{/if}
  {#each brief.mainQuestions as question, index (question.id)}{@render questionCard(
      question,
      index
    )}{:else}<p>
      Nessuna domanda selezionata. Scegli fino a tre domande dall’elenco qui sotto.
    </p>{/each}
</section>
<section class="interview-selection" aria-label="Domande opzionali">
  <h2>Domande opzionali <small>{optionalIds.length}</small></h2>
  <p class="muted">
    Da usare se c’è tempo, prima dell’ultima domanda principale, che resta la chiusura.
  </p>
  {#each brief.optionalQuestions as question, index (question.id)}
    {@render questionCard(question, index, true)}
  {:else}<p class="muted">Nessuna domanda opzionale selezionata.</p>{/each}
</section>
<section aria-label="Altre domande">
  <div class="section-heading">
    <h2>Altre domande</h2>
    <button onclick={() => (sortByRating = !sortByRating)}
      >{sortByRating ? 'Ordina per scaletta' : 'Ordina per voto'}</button
    >
  </div>
  <div class="interview-tools">
    <StartInterview
      {speakerId}
      {talkId}
      {language}
      back="gestione"
      disabled={!selectedIds.length || busy}
    />
    <a
      class="button-link"
      href={'/backoffice/speaker/' + encodeURIComponent(speakerId) + '/strumenti?prompt=domande'}
      >Prepara domande con AI</a
    >
  </div>
  {#if selectedIds.length === 3}<p class="muted">
      Hai già tre domande principali. Puoi aggiungere altre domande come opzionali.
    </p>{/if}
  {#each others as question (question.id)}{@render questionCard(question)}{:else}<p class="muted">
      Non ci sono altre domande.
    </p>{/each}
</section>
<details class="interview-plan">
  <summary>Preparazione intervista</summary>
  {#if plan}<p>
      Intervistatore: {plan.assignedToName ||
        [...team, ...workspace.members].find((member) => member.id === plan.assignedToUid)
          ?.displayName ||
        'Non assegnato'}
    </p>
    <InterviewBadges {plan} />
    <p>{plan.date || 'Data da concordare'} {plan.startTime || ''}</p>
    <p>Obiettivo: {plan.targetQuestions || '—'} domande</p>
    <Markdown text={text(plan.notesMd)} />{:else}<p>Preparazione non ancora compilata.</p>{/if}
  <a
    class="button-link"
    href={'/backoffice/contenuti/speakers/' + encodeURIComponent(speakerId) + '?' + contextQuery}
    >Modifica profilo e intervista</a
  >
  <a href={'/backoffice/speaker/' + encodeURIComponent(speakerId)}>Info e assegnazione</a>
</details>

{#snippet questionCard(question: Entity, index = -1, optional = false)}
  <article class="content-entry" class:interview-question={index >= 0}>
    {#if index >= 0}<p class="selection-label">
        {optional ? 'Domanda opzionale' : 'Domanda principale'} · {index + 1}{!optional &&
        index === selectedIds.length - 1
          ? ' · Finale'
          : ''}
      </p>{/if}
    <div class="entry-meta">
      <span>{provenanceLabel('questions', question)} · {question.order || '—'}</span
      >{#if question.status}<span class="status">{translate(question.status)}</span>{/if}
    </div>
    <h3>{questionText(question)}</h3>
    <QuestionRating {question} onchange={refreshData} />
    <Markdown text={text(question[language === 'it' ? 'followUpIt' : 'followUpEn'])} />
    <details>
      <summary>Motivazione e note</summary><Markdown text={text(question.whyMd)} /><Markdown
        text={text(question.notesMd)}
      />
    </details>
    {#if question.url && safeUrl(question.url)}<a
        href={text(question.url)}
        target="_blank"
        rel="noopener noreferrer">Apri fonte originale</a
      >{/if}
    {#if ((question.sourceIds as string[]) || []).length}<p class="provenance">
        Fonti: {(question.sourceIds as string[])
          .map((id) => data.sources?.find((source) => source.id === id)?.title || id)
          .join(', ')}
      </p>{/if}
    <div class="entry-actions">
      <a
        class="button-link"
        href={'/topic/connessioni?node=' + encodeURIComponent('question:' + question.id)}
        >Domande simili e topic</a
      >
      {#if index >= 0}
        <button
          disabled={busy}
          onclick={() =>
            optional
              ? saveSelection(
                  selectedIds,
                  optionalIds.filter((id) => id !== question.id)
                )
              : saveSelection(selectedIds.filter((id) => id !== question.id))}
          >{optional ? 'Togli dalle opzionali' : 'Togli dall’intervista'}</button
        >
        <button
          aria-label={'Sposta domanda ' + (optional ? 'opzionale ' : '') + (index + 1) + ' in alto'}
          disabled={busy || index === 0}
          onclick={() => move(index, -1, optional)}>↑</button
        >
        <button
          aria-label={'Sposta domanda ' +
            (optional ? 'opzionale ' : '') +
            (index + 1) +
            ' in basso'}
          disabled={busy || index === (optional ? optionalIds : selectedIds).length - 1}
          onclick={() => move(index, 1, optional)}>↓</button
        >
        {#if !optional}<button
            disabled={busy}
            onclick={() =>
              saveSelection(
                selectedIds.filter((id) => id !== question.id),
                [...optionalIds, question.id]
              )}>Rendi opzionale</button
          >{/if}
      {:else}<button
          disabled={busy || selectedIds.length >= 3 || question.status === 'rejected'}
          onclick={() => saveSelection([...selectedIds, question.id])}>Usa per intervista</button
        >
        <button
          disabled={busy || question.status === 'rejected'}
          onclick={() => saveSelection(selectedIds, [...optionalIds, question.id])}
          >Usa come opzionale</button
        >
      {/if}
      <a
        class="button-link"
        href={'/backoffice/contenuti/questions/' +
          encodeURIComponent(question.id) +
          '?' +
          contextQuery}>Modifica</a
      >
      <button class="danger quiet" disabled={busy} onclick={() => ondelete(question)}
        >Elimina</button
      >
    </div>
  </article>
{/snippet}

<style>
  .interview-tools {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.6rem;
    margin-bottom: 1.25rem;
  }
  .interview-tools label {
    flex: 1 1 100%;
  }
  .interview-selection {
    margin-bottom: 2rem;
  }
  .interview-selection h2 small {
    font-size: 0.85rem;
    color: var(--muted);
  }
  .interview-question {
    background: #edf3fa;
    border: 1px solid #b5c9e1;
    border-left: 4px solid var(--blue);
    border-radius: 8px;
    padding: 1rem;
    margin-block: 1rem;
  }
  .selection-label {
    color: var(--blue);
    font-weight: 700;
    font-size: 0.85rem;
  }
  .entry-actions {
    flex-wrap: wrap;
  }
  .interview-plan {
    border-top: 1px solid var(--line);
    padding-top: 1rem;
    margin-top: 2rem;
  }
  .interview-plan summary {
    cursor: pointer;
    font-weight: 700;
    margin-bottom: 1rem;
  }
</style>
