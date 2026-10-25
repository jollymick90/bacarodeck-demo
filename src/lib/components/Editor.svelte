<script lang="ts">
  import { isInInterviewList } from '$lib/interview-list';
  import { team } from '$lib/team';
  import { untrack } from 'svelte';
  import {
    fields,
    labels,
    auditKeys,
    translate,
    type Collection,
    type Entity,
    type Field
  } from '$lib/fields';
  import { validateEntity } from '$lib/domain';
  import Markdown from './Markdown.svelte';
  let {
    collection,
    entity,
    interviewPlan,
    members,
    onsave,
    oncancel,
    busy = false
  }: {
    collection: Collection;
    entity: Entity;
    interviewPlan?: Entity;
    members: Entity[];
    onsave: (entity: Entity, interviewPlan?: Entity) => Promise<void>;
    oncancel: () => void;
    busy?: boolean;
  } = $props();
  let draft = $state<Entity>(untrack(() => JSON.parse(JSON.stringify(entity))));
  let readOnly = $state(untrack(() => Boolean(entity.revision)));
  let descriptionLanguage = $state<'it' | 'en'>('it');
  let planDraft = $state<Entity | undefined>(
    untrack(() => (interviewPlan ? JSON.parse(JSON.stringify(interviewPlan)) : undefined))
  );
  const groups = $derived([
    { collection, entity, draft, label: interviewPlan ? 'Profilo speaker' : labels[collection] },
    ...(interviewPlan && planDraft
      ? [
          {
            collection: 'interviewPlans' as const,
            entity: interviewPlan,
            draft: planDraft,
            label: 'Preparazione intervista'
          }
        ]
      : [])
  ]);
  let error = $state('');
  let previews = $state<Record<string, boolean>>({});
  let rawJson = $state<Record<string, Record<string, string>>>({});
  let advanced = $state(false);
  const mainKeys = [
    'fullName',
    'inInterviewList',
    'isKeynote',
    'headline',
    'organization',
    'biographyMd',
    'biographyIt',
    'biographyEn',
    'translationReviewed',
    'photoUrl',
    'tags',
    'title',
    'url',
    'bodyMd',
    'provenance',
    'notesMd',
    'abstractMd',
    'abstractIt',
    'abstractEn',
    'day',
    'time',
    'stage',
    'textIt',
    'textEn',
    'followUpIt',
    'followUpEn',
    'order',
    'status',
    'assignedToUid',
    'cameraId',
    'interviewStatus',
    'interviewLanguage',
    'priority',
    'date',
    'startTime',
    'targetQuestions'
  ];
  function visible(section: Collection) {
    return fields[section].filter(
      (f) =>
        !['assignedToUid', 'assignedToName', 'assignedTeamId'].includes(f.key) &&
        !(
          section === 'speakers' &&
          f.key === (descriptionLanguage === 'it' ? 'biographyEn' : 'biographyIt')
        ) &&
        !(interviewPlan && section === 'interviewPlans' && f.key === 'speakerId') &&
        (advanced || mainKeys.includes(f.key))
    );
  }
  function update(draft: Entity, section: Collection, field: Field, value: string | boolean) {
    if (field.type === 'array')
      draft[field.key] = String(value)
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
    else if (field.type === 'number') draft[field.key] = value === '' ? 0 : Number(value);
    else if (field.type === 'json') {
      (rawJson[section] ??= {})[field.key] = String(value);
      try {
        draft[field.key] = JSON.parse(String(value));
        error = '';
      } catch {
        error = 'Link pubblici: JSON non valido.';
      }
    } else draft[field.key] = value;
    if (field.key === 'assignedToUid')
      draft.assignedToName = [...team, ...members].find((m) => m.id === value)?.displayName ?? null;
  }
  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (readOnly || busy) return;
    error = '';
    for (const group of groups) {
      for (const [key, raw] of Object.entries(rawJson[group.collection] || {})) {
        try {
          group.draft[key] = JSON.parse(raw);
        } catch {
          error = `${group.label} · ${key}: JSON non valido`;
          return;
        }
      }
      const errors = validateEntity(group.collection, group.draft);
      if (errors.length) {
        error = `${group.label}: ${errors.join('\n')}`;
        return;
      }
    }
    try {
      await onsave(draft, planDraft);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }
</script>

<section class="editor" aria-label={readOnly ? 'Lettura contenuto' : 'Modifica contenuto'}>
  <div class="section-heading">
    <h2>
      {#if interviewPlan}Profilo e intervista{:else}{readOnly
          ? 'Leggi'
          : entity.revision
            ? 'Modifica'
            : 'Aggiungi'} · {['materials', 'sources', 'insights'].includes(collection)
          ? 'Ricerca'
          : labels[collection]}{/if}
    </h2>
    <div class="editor-actions">
      {#if readOnly}<button type="button" class="primary" onclick={() => (readOnly = false)}
          >Modifica</button
        >{/if}
      <button type="button" class="quiet" onclick={oncancel} disabled={busy}>Chiudi</button>
    </div>
  </div>
  <form onsubmit={save}>
    {#each groups as group (group.collection)}
      {@const draft = group.draft}
      <fieldset class="editor-fields wide" aria-label={group.label} disabled={busy}>
        {#if interviewPlan}<legend>{group.label}</legend>{/if}
        {#if group.collection === 'interviewPlans'}<p class="notice">
            Per assegnare o riassegnare usa «Assegna / cambia» nella scheda speaker.
          </p>{/if}
        {#each visible(group.collection) as field}
          {@const fieldId = 'edit-' + group.collection + '-' + field.key}
          {@const isDescription =
            group.collection === 'speakers' && ['biographyIt', 'biographyEn'].includes(field.key)}
          <div class:wide={field.type === 'markdown'} class="field">
            <div class="field-heading">
              {#if readOnly}<span class="field-label" id={fieldId + '-label'}
                  >{isDescription ? 'Descrizione' : field.label}</span
                >
              {:else}<label for={fieldId}>{isDescription ? 'Descrizione' : field.label}</label>{/if}
              {#if isDescription}
                <div class="description-language" role="group" aria-label="Lingua descrizione">
                  <button
                    type="button"
                    aria-pressed={descriptionLanguage === 'it'}
                    onclick={() => (descriptionLanguage = 'it')}>IT</button
                  >
                  <button
                    type="button"
                    aria-pressed={descriptionLanguage === 'en'}
                    onclick={() => (descriptionLanguage = 'en')}>EN</button
                  >
                </div>
              {/if}
            </div>
            {#if readOnly}
              <div
                class="read-value"
                aria-labelledby={fieldId + '-label'}
                lang={isDescription ? descriptionLanguage : undefined}
              >
                {#if field.type === 'markdown'}
                  {#if draft[field.key]}<Markdown text={String(draft[field.key])} />
                  {:else}<p class="muted">
                      {isDescription
                        ? `Descrizione ${descriptionLanguage.toUpperCase()} non disponibile.`
                        : 'Non specificato'}
                    </p>{/if}
                {:else if field.type === 'boolean'}
                  <p>
                    {(
                      field.key === 'inInterviewList'
                        ? isInInterviewList(draft)
                        : Boolean(draft[field.key])
                    )
                      ? 'Sì'
                      : 'No'}
                  </p>
                {:else if field.type === 'json'}
                  <pre>{JSON.stringify(draft[field.key] ?? [], null, 2)}</pre>
                {:else if field.type === 'array'}
                  <p>{((draft[field.key] as string[]) || []).join(', ') || 'Non specificato'}</p>
                {:else}<p>
                    {field.type === 'select'
                      ? translate(draft[field.key]) || 'Non specificato'
                      : String(draft[field.key] ?? '') || 'Non specificato'}
                  </p>{/if}
              </div>
            {:else if field.key === 'assignedToUid'}
              <select
                id={fieldId}
                value={String(draft[field.key] ?? '')}
                onchange={(e) => update(draft, group.collection, field, e.currentTarget.value)}
                ><option value="">Non assegnato</option
                >{#each [...team.filter((m) => m.role === 'interview'), ...members.filter((m) => !team.some((t) => t.id === m.id))] as member}<option
                    value={member.id}>{member.displayName || member.id}</option
                  >{/each}</select
              >
            {:else if field.type === 'boolean'}
              <input
                id={fieldId}
                type="checkbox"
                checked={field.key === 'inInterviewList'
                  ? isInInterviewList(draft)
                  : Boolean(draft[field.key])}
                onchange={(e) => update(draft, group.collection, field, e.currentTarget.checked)}
              />
            {:else if field.type === 'select'}
              <select
                id={fieldId}
                value={String(draft[field.key] ?? '')}
                onchange={(e) => update(draft, group.collection, field, e.currentTarget.value)}
                ><option value="">Non specificato</option
                >{#if draft[field.key] && !field.options?.includes(String(draft[field.key]))}<option
                    value={String(draft[field.key])}>{String(draft[field.key])}</option
                  >{/if}{#each field.options || [] as option}<option value={option}
                    >{translate(option)}</option
                  >{/each}</select
              >
            {:else if field.type === 'markdown'}
              <textarea
                id={fieldId}
                rows={field.key === 'bodyMd' ? 12 : 4}
                lang={isDescription ? descriptionLanguage : undefined}
                value={String(draft[field.key] ?? '')}
                oninput={(e) => update(draft, group.collection, field, e.currentTarget.value)}
              ></textarea>
              <button
                type="button"
                class="text-button"
                onclick={() => (previews[fieldId] = !previews[fieldId])}
                >{previews[fieldId] ? 'Nascondi anteprima' : 'Anteprima Markdown'}</button
              >
              {#if field.key === 'bodyMd'}<small
                  >{new TextEncoder()
                    .encode(String(draft[field.key] || ''))
                    .length.toLocaleString('it-IT')} / 204.800 byte · nessun tag obbligatorio</small
                >{/if}
              {#if previews[fieldId]}<div class="preview">
                  <Markdown text={String(draft[field.key] || '')} />
                </div>{/if}
            {:else if field.type === 'json'}
              <textarea
                id={fieldId}
                rows="4"
                value={rawJson[group.collection]?.[field.key] ??
                  JSON.stringify(draft[field.key] || [], null, 2)}
                oninput={(e) => update(draft, group.collection, field, e.currentTarget.value)}
              ></textarea>
            {:else}
              <input
                id={fieldId}
                type={field.type === 'number' ? 'number' : 'text'}
                min={field.type === 'number' ? 0 : undefined}
                value={field.type === 'array'
                  ? ((draft[field.key] as string[]) || []).join(', ')
                  : String(draft[field.key] ?? '')}
                oninput={(e) => update(draft, group.collection, field, e.currentTarget.value)}
              />
              {#if field.type === 'array'}<small>Valori separati da virgola</small>{/if}
            {/if}
          </div>
        {/each}
      </fieldset>
    {/each}
    <div class="wide">
      <button type="button" class="text-button" onclick={() => (advanced = !advanced)}
        >{advanced ? 'Nascondi campi aggiuntivi' : 'Mostra tutti i campi editoriali'}</button
      >
    </div>
    {#if error}<p class="error wide" role="alert">{error}</p>{/if}
    {#if !readOnly}<div class="form-actions wide">
        <button class="primary" disabled={busy} type="submit"
          >{busy ? 'Salvataggio…' : 'Salva modifiche'}</button
        ><button type="button" onclick={oncancel} disabled={busy}>Annulla</button>
      </div>{/if}
  </form>
  <details class="technical">
    <summary>ID e cronologia</summary>
    {#each groups as group}
      <p>{group.label}: {group.entity.id}</p>
      {#each auditKeys as key}{#if group.entity[key] !== undefined}<p>
            {key}: {JSON.stringify(group.entity[key])}
          </p>{/if}{/each}
    {/each}
  </details>
</section>

<style>
  .editor-actions,
  .field-heading,
  .description-language {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .field-heading {
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }
  .field-label {
    font-weight: 600;
  }
  .description-language button {
    padding: 0.35rem 0.7rem;
  }
  .description-language button[aria-pressed='true'] {
    background: var(--navy, #182f50);
    color: white;
  }
  .read-value {
    overflow-wrap: anywhere;
    line-height: 1.65;
  }
  .read-value p {
    margin: 0;
  }
  .read-value pre {
    white-space: pre-wrap;
    margin: 0;
  }
  .editor-fields {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 1rem 1.3rem;
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }
  legend {
    width: 100%;
    padding: 1rem 0;
    margin-bottom: 0.5rem;
    border-bottom: 1px solid var(--line);
    font-weight: 700;
    font-size: 1.15rem;
  }
  .notice {
    grid-column: 1 / -1;
  }
  @media (max-width: 650px) {
    .editor-fields {
      display: block;
    }
  }
</style>
