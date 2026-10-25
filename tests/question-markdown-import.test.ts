import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseQuestionMarkdown } from '../src/lib/question-markdown-import';

const example = readFileSync(new URL('./fixtures/generated-questions.md', import.meta.url), 'utf8');
describe('question Markdown import', () => {
  it('extracts the seven bilingual questions without duplicating the recommended brief', async () => {
    const result = await parseQuestionMarkdown(example, 'raponi', []);
    expect(result.questions).toHaveLength(7);
    expect(result.questions[0]).toMatchObject({ speakerId: 'raponi', status: 'suggested' });
    expect(result.questions[0].textIt).toContain('metodo EARS');
    expect(result.questions[0].textEn).toContain('When presenting EARS');
    expect(result.questions[0].followUpIt).toContain('esempio concreto');
    expect(result.questions[0].followUpEn).toContain('concrete example');
    expect(result.questions[0].whyMd).toContain('tecnica di specifica');
    expect(result.questions[0].notesMd).toContain('[R1]');
    expect(result.questions[0].notesMd).toContain('Da verificare');
    expect(
      result.questions.filter((q) => String(q.notesMd).includes('Scaletta consigliata: sì'))
    ).toHaveLength(3);
    expect(result.questions[0].sourceIds).toBeUndefined();
  });
  it('uses stable speaker-scoped IDs and skips questions already present', async () => {
    const first = await parseQuestionMarkdown(example, 'raponi', []);
    const again = await parseQuestionMarkdown(example, 'raponi', first.questions);
    expect(again.questions).toHaveLength(0);
    expect(again.skipped).toBe(7);
    expect((await parseQuestionMarkdown(example, 'raponi', [])).questions[0].id).toBe(
      first.questions[0].id
    );
    expect((await parseQuestionMarkdown(example, 'other', [])).questions[0].id).not.toBe(
      first.questions[0].id
    );
  });
  it('accepts plain labels, multiline text and English-only questions', async () => {
    const result = await parseQuestionMarkdown(
      '### Question 1\n- Question EN: First line\nsecond line?\n- Follow-up EN: Why?',
      's',
      []
    );
    expect(result.questions[0].textEn).toBe('First line\nsecond line?');
    expect(result.questions[0].followUpEn).toBe('Why?');
  });
  it('rejects unsupported prose instead of silently saving it as a question', async () => {
    await expect(parseQuestionMarkdown('Un testo libero senza campi.', 's', [])).rejects.toThrow(
      'Domanda IT'
    );
  });
});
