import type { Entity } from './fields';
import { validateEntity } from './domain';

const normalize = (value: unknown) =>
  String(value || '')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
const names: Record<string, string> = {
  'domanda it': 'textIt',
  'question it': 'textIt',
  'domanda en': 'textEn',
  'question en': 'textEn',
  'follow-up it': 'followUpIt',
  'follow-up en': 'followUpEn',
  'perché è utile': 'whyMd',
  motivazione: 'whyMd',
  ruolo: 'role',
  origine: 'origin',
  riferimenti: 'references',
  'da verificare': 'verify'
};
type Block = { fields: Record<string, string>; recommended: boolean; title: string };

/** Reads labelled Markdown, never executes or infers missing question text. */
export async function parseQuestionMarkdown(text: string, speakerId: string, existing: Entity[]) {
  if (new TextEncoder().encode(text).length > 500_000)
    throw Error('Testo troppo grande: massimo 500 KB.');
  const blocks: Block[] = [];
  let recommended = false;
  let block: Block = { fields: {}, recommended, title: '' };
  let field = '';
  const flush = () => {
    if (block.fields.textIt || block.fields.textEn) blocks.push(block);
    block = { fields: {}, recommended, title: '' };
    field = '';
  };
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    const heading = line.match(/^\s*(#{1,6})\s+(.+)/);
    if (heading) {
      flush();
      if (heading[1].length <= 2) recommended = /scaletta consigliata/i.test(heading[2]);
      block.recommended = recommended;
      block.title = heading[2];
      continue;
    }
    const clean = line.replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)?/, '');
    const label = clean.match(/^(?:\*\*)?([^:*]+?)(?:\*\*)?:\s*(?:\*\*)?\s*(.*)$/);
    const mapped = label && names[normalize(label[1])];
    if (mapped) {
      // Also support numbered lists without question headings.
      if ((mapped === 'textIt' || mapped === 'textEn') && block.fields[mapped]) flush();
      field = mapped;
      block.fields[field] = label![2].trim();
    } else if (/^(---+|```)/.test(clean) || (label && /^\*\*/.test(clean))) {
      field = '';
    } else if (field && line.trim()) {
      block.fields[field] += '\n' + line.trim();
    }
  }
  flush();
  if (!blocks.length)
    throw Error(
      'Nessuna domanda riconosciuta. Incolla il Markdown con i campi “Domanda IT” o “Question EN”, come nel prompt precompilato.'
    );
  const unique: Block[] = [];
  const same = (a: Record<string, unknown>, b: Record<string, unknown>) =>
    ['textIt', 'textEn'].some(
      (key) => normalize(a[key]) && normalize(a[key]) === normalize(b[key])
    );
  for (const candidate of blocks) {
    const previous = unique.find((item) => same(item.fields, candidate.fields));
    if (previous) previous.recommended ||= candidate.recommended;
    else unique.push(candidate);
  }
  if (unique.length > 30) throw Error('Importa al massimo 30 domande per volta.');
  const questions: Entity[] = [];
  let skipped = 0;
  for (const item of unique) {
    const f = item.fields;
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(`${speakerId}\n${normalize(f.textIt || f.textEn)}`)
    );
    const id =
      'q-import-' +
      Array.from(new Uint8Array(digest), (n) => n.toString(16).padStart(2, '0')).join('');
    if (existing.some((q) => q.speakerId === speakerId && (q.id === id || same(q, f)))) {
      skipped++;
      continue;
    }
    const question: Entity = { id, speakerId, status: 'suggested' };
    for (const key of ['textIt', 'textEn', 'followUpIt', 'followUpEn', 'whyMd'])
      if (f[key]) question[key] = f[key];
    question.notesMd = [
      'Importata da un risultato AI: verificare contenuto e riferimenti.',
      item.title && `Titolo: ${item.title}`,
      f.role && `Ruolo: ${f.role}`,
      f.origin && `Origine: ${f.origin}`,
      item.recommended && 'Scaletta consigliata: sì (da selezionare nell’intervista).',
      f.references && `Riferimenti del testo originale (non verificati): ${f.references}`,
      f.verify && `Da verificare: ${f.verify}`
    ]
      .filter(Boolean)
      .join('\n\n');
    const errors = validateEntity('questions', question);
    if (errors.length) throw Error(`Domanda ${questions.length + 1}: ${errors.join('; ')}`);
    questions.push(question);
  }
  return { questions, skipped };
}
