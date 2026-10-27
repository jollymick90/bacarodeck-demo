import type { Dataset, Entity } from '../fields';
import type { ResolvedBrief } from './types';
export function briefId(speakerId: string, talkId = ''): string {
  const input = JSON.stringify([speakerId, talkId]);
  let hash = 14695981039346656037n;
  for (const char of input) {
    hash ^= BigInt(char.codePointAt(0)!);
    hash = BigInt.asUintN(64, hash * 1099511628211n);
  }
  return `brief-${hash.toString(16).padStart(16, '0')}`;
}
export function prepareBriefUpdate(brief: Entity, data: Dataset): Entity {
  validateBrief(brief, data);
  return { ...brief };
}
export function validateBrief(brief: Entity, data: Dataset): void {
  if (!data.speakers?.some((s) => s.id === brief.speakerId))
    throw new Error('Speaker non trovato.');
  if (
    brief.talkId &&
    !data.talks?.some(
      (t) =>
        t.id === brief.talkId &&
        ((t.speakerIds as string[]) || []).includes(String(brief.speakerId))
    )
  )
    throw new Error('Talk non collegato allo speaker.');
  for (const key of ['mainQuestionIds', 'optionalQuestionIds', 'classicQuestionIds']) {
    const ids = brief[key] || [];
    if (
      !Array.isArray(ids) ||
      !ids.every((id) => typeof id === 'string') ||
      new Set(ids).size !== ids.length
    )
      throw new Error('Scegli elenchi di domande validi e non ripetere le domande.');
    if (
      ids.some(
        (id) =>
          !data.questions?.some(
            (q) => q.id === id && q.speakerId === brief.speakerId && q.status !== 'rejected'
          )
      )
    )
      throw new Error('Una domanda non è disponibile per questo speaker. Ricarica la scheda.');
  }
  const mainIds = new Set((brief.mainQuestionIds || []) as string[]);
  if (((brief.optionalQuestionIds || []) as string[]).some((id) => mainIds.has(id)))
    throw new Error('Una domanda non può essere sia principale sia opzionale.');
}
export function resolveBrief(
  data: Dataset,
  speakerId: string,
  talkId = '',
  language: 'it' | 'en' = 'it'
): ResolvedBrief {
  const talk = data.talks?.find(
    (t) => t.id === talkId && ((t.speakerIds as string[]) || []).includes(speakerId)
  );
  const brief = data.conductorBriefs?.find(
    (b) => b.speakerId === speakerId && String(b.talkId || '') === talkId
  );
  const questions = (data.questions || []).filter(
    (q) => q.speakerId === speakerId && q.status !== 'rejected'
  );
  const chosen = (key: string) =>
    ((brief?.[key] || []) as string[]).flatMap((id) => questions.find((q) => q.id === id) || []);
  const mainQuestions = brief
    ? chosen('mainQuestionIds')
    : [...questions].sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  const optionalQuestions = chosen('optionalQuestionIds').filter(
    (question) => !mainQuestions.some((main) => main.id === question.id)
  );
  const closingQuestion = mainQuestions.at(-1);
  const interviewQuestions = closingQuestion
    ? [...mainQuestions.slice(0, -1), ...optionalQuestions, closingQuestion]
    : [];
  const editorial = String(brief?.[language === 'it' ? 'summaryIt' : 'summaryEn'] || '');
  const abstract = String(
    talk?.[language === 'it' ? 'abstractIt' : 'abstractEn'] || talk?.abstractMd || ''
  );
  return {
    brief,
    talk,
    mainQuestions,
    optionalQuestions,
    interviewQuestions,
    classicQuestions: chosen('classicQuestionIds'),
    summary: editorial || abstract.slice(0, 500),
    summaryOrigin: editorial ? 'editorial' : abstract ? 'abstract_excerpt' : 'missing',
    selectionOrigin: brief ? 'editorial' : mainQuestions.length ? 'legacy_proposal' : 'empty'
  };
}
