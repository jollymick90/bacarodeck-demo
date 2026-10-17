import type { Entity } from './fields';
const prompts = [
  [
    'Quale problema concreto ti ha portato a scegliere questo argomento?',
    'What concrete problem led you to choose this topic?'
  ],
  [
    'Puoi raccontare un esempio reale e il suo contesto?',
    'Could you walk us through a real example and its context?'
  ],
  [
    'Quale compromesso è stato più difficile e quali alternative hai valutato?',
    'Which trade-off was hardest, and which alternatives did you consider?'
  ],
  [
    'Come distingueresti una demo convincente da una soluzione pronta per la produzione?',
    'How would you distinguish a compelling demo from a production-ready solution?'
  ],
  ['Quale errore iniziale ti ha insegnato di più?', 'Which early mistake taught you the most?'],
  [
    'Quali segnali o misure useresti per verificare che l’approccio funzioni?',
    'Which signals or measurements would you use to check whether the approach works?'
  ],
  [
    'In quali situazioni sconsiglieresti questo approccio?',
    'In which situations would you advise against this approach?'
  ],
  [
    'Come cambia il lavoro quotidiano delle persone che lo adottano?',
    'How does adoption change people’s day-to-day work?'
  ],
  [
    'Quale piccolo esperimento consiglieresti a chi vuole iniziare domani?',
    'What small experiment would you recommend to someone starting tomorrow?'
  ],
  [
    'Quale domanda rimane aperta e cosa vorresti verificare nei prossimi mesi?',
    'Which question remains open, and what would you like to investigate over the next few months?'
  ]
];
export function draftQuestions(speaker: Entity, talk?: Entity, materials: Entity[] = []): Entity[] {
  const topic = String(talk?.title || 'il tuo lavoro / your work');
  const sourceText = String(
    talk?.abstractMd || materials.find((m) => m.bodyMd)?.bodyMd || speaker.biographyMd || ''
  );
  const excerpts = sourceText
    .split(/(?<=[.!?])\s+/)
    .map((text) => text.trim())
    .filter(Boolean);
  return prompts.map(([it, en], i) => ({
    id: `q-${speaker.id.slice(0, 100)}-editorial-${i + 1}`,
    speakerId: speaker.id,
    order: i + 1,
    textIt: excerpts.length
      ? `Nel materiale di partenza: «${excerpts[i % excerpts.length].slice(0, 280)}». ${it}`
      : `A proposito di «${topic}»: ${it}`,
    textEn: excerpts.length
      ? `The source material says: “${excerpts[i % excerpts.length].slice(0, 280)}”. ${en}`
      : `Regarding “${topic}”: ${en}`,
    status: 'suggested',
    tags: ['bozza-editoriale'],
    sourceIds: talk?.sourceIds || speaker.sourceIds || [],
    whyMd:
      'Traccia esplorativa da personalizzare e verificare sui materiali. Non presuppone risultati o esperienze non documentati.',
    notesMd: excerpts.length
      ? 'Bozza bilingue ancorata a un estratto originale, mantenuto nella lingua della fonte. Verificare pertinenza e contesto.'
      : 'Fonti descrittive mancanti: traccia esplorativa basata solo sul titolo.'
  }));
}
