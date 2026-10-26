export const collections = [
  'conductorBriefs',
  'speakerInterests',
  'speakers',
  'talks',
  'sources',
  'materials',
  'insights',
  'questions',
  'interviewPlans',
  'interviewSlots',
  'topics',
  'graphLinks'
] as const;
export type Collection = (typeof collections)[number];
export type Value = string | number | boolean | null | Value[] | { [key: string]: Value };
export type Entity = { id: string; revision?: number; [key: string]: Value | undefined };
export type Dataset = Partial<Record<Collection, Entity[]>>;
export type Field = {
  key: string;
  label: string;
  type?: 'text' | 'markdown' | 'array' | 'boolean' | 'number' | 'json' | 'select';
  options?: string[];
};
const f = (
  key: string,
  label: string,
  type: Field['type'] = 'text',
  options?: string[]
): Field => ({ key, label, type, options });
const notes = f('notesMd', 'Note', 'markdown');
const tags = f('tags', 'Tag', 'array');
const sources = f('sourceIds', 'ID fonti', 'array');
const speakerIds = f('speakerIds', 'ID speaker', 'array');
export const labels: Record<Collection, string> = {
  topics: 'Temi',
  graphLinks: 'Collegamenti',
  conductorBriefs: 'Schede conduttore',
  speakerInterests: 'Interessi',
  speakers: 'Speaker',
  talks: 'Talk',
  sources: 'Fonti',
  materials: 'Materiali',
  insights: 'Insight',
  questions: 'Domande',
  interviewSlots: 'Programmazione',
  interviewPlans: 'Intervista'
};
export const fields: Record<Collection, Field[]> = {
  topics: [
    f('label', 'Nome'),
    f('aliases', 'Alias', 'array'),
    f('description', 'Descrizione', 'markdown')
  ],
  graphLinks: [
    f('source', 'Nodo origine'),
    f('target', 'Nodo destinazione'),
    f('kind', 'Relazione', 'select', [
      'speaker-topic',
      'question-topic',
      'topic-related',
      'speaker-similar',
      'question-similar'
    ]),
    f('decision', 'Decisione', 'select', ['linked', 'confirmed', 'dismissed']),
    f('reason', 'Motivazione', 'markdown')
  ],
  conductorBriefs: [
    f('speakerId', 'Speaker'),
    f('talkId', 'Talk'),
    f('summaryIt', 'Sintesi IT', 'markdown'),
    f('summaryEn', 'Sintesi EN', 'markdown'),
    f('mainQuestionIds', 'Domande principali', 'array'),
    f('optionalQuestionIds', 'Domande opzionali', 'array'),
    f('classicQuestionIds', 'Domande classiche', 'array')
  ],
  speakerInterests: [f('speakerId', 'Speaker'), f('memberUid', 'Membro')],
  interviewSlots: [
    f('primarySpeakerId', 'ID speaker principale'),
    f('originalStart', 'Slot originale'),
    f('primarySpeaker', 'Speaker principale'),
    f('backupSpeaker', 'Speaker backup'),
    f('selectedTalkId', 'Talk collegato'),
    f('chosenStart', 'Inizio scelto (ISO con fuso)'),
    f('interviewerId', 'Intervistatore'),
    f('cameraId', 'Camera'),
    f('status', 'Stato slot')
  ],
  speakers: [
    f('fullName', 'Nome completo'),
    f('firstName', 'Nome'),
    f('lastName', 'Cognome'),
    f('headline', 'Ruolo'),
    f('organization', 'Organizzazione'),
    f('biographyMd', 'Biografia originale', 'markdown'),
    f('biographyIt', 'Descrizione IT', 'markdown'),
    f('biographyEn', 'Description EN', 'markdown'),
    f('translationReviewed', 'Traduzione verificata', 'boolean'),
    f('photoUrl', 'URL foto'),
    f('priority', 'Prioritario', 'boolean'),
    f('inInterviewList', 'In elenco interviste', 'boolean'),
    f('isKeynote', 'Speaker keynote', 'boolean'),
    f('inDirectorySnapshot', 'Nello snapshot directory', 'boolean'),
    tags,
    f('suggestedTags', 'Tag suggeriti', 'array'),
    f('publicLinks', 'Link pubblici (JSON)', 'json'),
    sources,
    f('talkIds', 'ID talk', 'array'),
    f('reviewFlags', 'Segnalazioni da verificare', 'array'),
    notes,
    f('status', 'Stato', 'select', ['active', 'archived'])
  ],
  talks: [
    speakerIds,
    f('title', 'Titolo'),
    f('abstractMd', 'Abstract originale', 'markdown'),
    f('abstractIt', 'Abstract IT', 'markdown'),
    f('abstractEn', 'Abstract EN', 'markdown'),
    f('translationReviewed', 'Traduzione verificata', 'boolean'),
    f('language', 'Lingua'),
    f('topic', 'Argomento'),
    f('level', 'Livello'),
    f('alternateTitles', 'Titoli alternativi', 'array'),
    sources,
    f('day', 'Giorno'),
    f('time', 'Inizio talk (HH:mm)'),
    f('endTime', 'Fine talk (HH:mm)'),
    f('agendaSessionId', 'ID sessione Codemotion'),
    f('stage', 'Palco'),
    f('reviewFlags', 'Segnalazioni', 'array'),
    notes
  ],
  sources: [
    f('title', 'Titolo'),
    f('url', 'URL fonte'),
    f('kind', 'Tipo fonte'),
    f('publisher', 'Editore'),
    notes,
    tags,
    f('status', 'Stato', 'select', ['unreviewed', 'reviewed', 'archived']),
    speakerIds
  ],
  materials: [
    f('title', 'Titolo (facoltativo)'),
    f('bodyMd', 'Testo Markdown', 'markdown'),
    f('url', 'URL originale'),
    f('type', 'Tipo (facoltativo)'),
    f('provenance', 'Provenienza', 'select', [
      'reported_fact',
      'member_interpretation',
      'ai_generated',
      'editorial_question'
    ]),
    notes,
    speakerIds,
    sources,
    tags,
    f('language', 'Lingua'),
    f('readStatus', 'Lettura', 'select', ['unread', 'reading', 'read']),
    f('status', 'Stato', 'select', ['active', 'archived'])
  ],
  insights: [
    f('title', 'Titolo'),
    f('bodyMd', 'Insight', 'markdown'),
    f('provenance', 'Natura del contenuto', 'select', [
      'member_interpretation',
      'reported_fact',
      'ai_generated',
      'editorial_question'
    ]),
    speakerIds,
    sources,
    f('materialIds', 'ID materiali', 'array'),
    tags,
    notes,
    f('status', 'Stato', 'select', ['draft', 'reviewed', 'archived'])
  ],
  questions: [
    f('speakerId', 'ID speaker'),
    f('order', 'Ordine', 'number'),
    f('textIt', 'Domanda IT', 'markdown'),
    f('textEn', 'Domanda EN', 'markdown'),
    f('followUpIt', 'Follow-up IT', 'markdown'),
    f('followUpEn', 'Follow-up EN', 'markdown'),
    f('whyMd', 'Motivazione', 'markdown'),
    tags,
    sources,
    f('materialIds', 'ID materiali', 'array'),
    f('status', 'Stato', 'select', ['suggested', 'draft', 'approved', 'asked', 'rejected']),
    notes
  ],
  interviewPlans: [
    f('assignedTeamId', 'Conduttore'),
    f('speakerId', 'ID speaker'),
    f('assignedToUid', 'Intervistatore'),
    f('cameraId', 'Operatore camera', 'select', ['lorenzo', 'danilo']),
    f('assignedToName', 'Nome visualizzato assegnazione'),
    f('status', 'Preparazione', 'select', ['not_started', 'researching', 'ready', 'done']),
    f('interviewLanguage', 'Lingua intervista', 'select', [
      'language_pending',
      'italian',
      'english_possible',
      'english_confirmed'
    ]),
    f('interviewStatus', 'Stato intervista', 'select', [
      'unconfirmed',
      'requested',
      'confirmed',
      'completed',
      'cancelled'
    ]),
    f('priority', 'Priorità', 'select', ['high', 'normal', 'low']),
    f('targetQuestions', 'Numero domande', 'number'),
    f('date', 'Data'),
    f('startTime', 'Orario'),
    notes
  ]
};
export const auditKeys = [
  'createdAt',
  'updatedAt',
  'createdBy',
  'updatedBy',
  'revision',
  'ratings',
  'entryOrigin',
  'manualFields'
];
export function emptyEntity(collection: Collection, speakerId?: string): Entity {
  const entity: Entity = { id: crypto.randomUUID() };
  for (const field of fields[collection])
    entity[field.key] =
      field.type === 'array'
        ? []
        : field.type === 'boolean'
          ? false
          : field.type === 'number'
            ? 0
            : field.type === 'json'
              ? []
              : '';
  if (speakerId) {
    if ('speakerId' in entity) entity.speakerId = speakerId;
    if ('speakerIds' in entity) entity.speakerIds = [speakerId];
  }
  if (collection === 'interviewPlans' && speakerId) entity.id = speakerId;
  if (collection === 'questions') entity.status = 'suggested';
  if (collection === 'materials') {
    entity.provenance = 'member_interpretation';
    entity.status = 'active';
    entity.readStatus = 'unread';
  }
  if (collection === 'insights') entity.provenance = 'member_interpretation';
  return entity;
}
const translations: Record<string, string> = {
  active: 'Attivo',
  archived: 'Archiviato',
  unreviewed: 'Da verificare',
  reviewed: 'Verificato',
  reported_fact: 'Dato riportato da una fonte',
  member_interpretation: 'Interpretazione del membro',
  ai_generated: 'Testo AI da verificare',
  editorial_question: 'Domanda editoriale',
  unread: 'Da leggere',
  reading: 'In lettura',
  read: 'Letto',
  draft: 'Bozza',
  suggested: 'Suggerita',
  approved: 'Approvata',
  asked: 'Già posta',
  rejected: 'Scartata',
  not_started: 'Da iniziare',
  researching: 'In ricerca',
  ready: 'Pronto',
  done: 'Completato',
  language_pending: 'Da concordare',
  italian: 'Italiano',
  english_possible: 'Forse in inglese',
  english_confirmed: 'Sicuramente in inglese',
  unconfirmed: 'Da confermare',
  requested: 'Richiesta',
  confirmed: 'Confermata',
  completed: 'Completata',
  cancelled: 'Annullata',
  high: 'Alta',
  normal: 'Normale',
  low: 'Bassa'
};
export const translate = (value: unknown): string =>
  translations[String(value)] || String(value ?? '');
