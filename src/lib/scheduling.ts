import type { Entity } from './fields';
export function suggestInterview(end: string): string {
  const date = new Date(end);
  if (!Number.isFinite(date.getTime())) throw new Error('Orario talk non valido.');
  return new Date(date.getTime() + 30 * 60 * 1000).toISOString();
}
export function localTime(iso: string): string {
  return new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(iso));
}
export function findConflicts(slots: Entity[]): string[] {
  const result: string[] = [];
  for (let i = 0; i < slots.length; i++)
    for (let j = i + 1; j < slots.length; j++) {
      const a = slots[i],
        b = slots[j];
      if (!a.chosenStart || !b.chosenStart) continue;
      const startA = Date.parse(String(a.chosenStart)),
        startB = Date.parse(String(b.chosenStart));
      if (Math.abs(startA - startB) >= 30 * 60 * 1000) continue;
      for (const key of ['primarySpeaker', 'interviewerId', 'cameraId'])
        if (a[key] && a[key] === b[key])
          result.push(`${a.id} / ${b.id}: sovrapposizione ${a[key]}`);
    }
  return result;
}

export function outsideWindows(iso: string): boolean {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return true;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Rome',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);
  const part = (type: string) => parts.find((p) => p.type === type)?.value;
  const day = part('day');
  const minutes = Number(part('hour')) * 60 + Number(part('minute'));
  if (part('year') !== '2026' || part('month') !== '10' || !['28', '29'].includes(day || ''))
    return true;
  return !(
    (minutes >= 660 && minutes + 30 <= 780) ||
    (minutes >= 900 && minutes + 30 <= (day === '28' ? 1020 : 960))
  );
}
