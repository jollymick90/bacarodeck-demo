import type { Dataset, Entity } from '../fields';
import type { Change } from '../domain';

export function nextInterview(data: Dataset): Entity | undefined {
  const plan = data.interviewPlans?.find(
    (p) =>
      p.nextInterview === true &&
      p.interviewStatus !== 'completed' &&
      data.speakers?.some((s) => s.id === p.speakerId && s.status !== 'archived')
  );
  return data.speakers?.find((s) => s.id === plan?.speakerId);
}

export function validateNextInterview(data: Dataset): void {
  const selected = (data.interviewPlans || []).filter((p) => p.nextInterview === true);
  if (selected.length > 1)
    throw Error('Conflitto: un altro speaker è già indicato come prossimo. Aggiorna e riprova.');
  for (const plan of selected) {
    if (!data.speakers?.some((s) => s.id === plan.speakerId && s.status !== 'archived'))
      throw Error('Togli lo speaker dalla prossima intervista prima di archiviarlo o eliminarlo.');
    if (plan.interviewStatus === 'completed') throw Error('Questa intervista è già stata fatta.');
  }
}

export function nextInterviewChanges(
  data: Dataset,
  speakerId: string,
  selected: boolean
): Change[] {
  const speaker = data.speakers?.find((s) => s.id === speakerId);
  if (!speaker || (selected && speaker.status === 'archived'))
    throw Error('Lo speaker da intervistare non è disponibile.');
  const plans = data.interviewPlans || [];
  const plan = plans.find((p) => p.speakerId === speakerId);
  if (selected && plan?.interviewStatus === 'completed')
    throw Error('Questa intervista è già stata fatta.');
  const change = (record: Entity, next: boolean): Change => ({
    collection: 'interviewPlans',
    data: { ...record, nextInterview: next },
    expectedRevision: record.revision ?? null
  });
  if (!selected) return plan?.nextInterview === true ? [change(plan, false)] : [];
  return [
    ...plans
      .filter((p) => p.nextInterview === true && p.id !== plan?.id)
      .map((p) => change(p, false)),
    ...(plan?.nextInterview === true ? [] : [change(plan || { id: speakerId, speakerId }, true)])
  ];
}
