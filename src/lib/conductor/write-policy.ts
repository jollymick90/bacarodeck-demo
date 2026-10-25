import type { Collection, Entity } from '../fields';
export function guardConductorWrite(
  collection: Collection,
  incoming: Entity,
  existing: Entity | null
) {
  if (collection === 'speakerInterests')
    throw Error('Modifica gli interessi dalla vista conduttore.');
  const keys =
    collection === 'interviewPlans'
      ? ['assignedTeamId', 'assignedToUid', 'assignedToName']
      : collection === 'interviewSlots'
        ? ['interviewerId']
        : [];
  if (keys.some((k) => String(incoming[k] || '') !== String(existing?.[k] || '')))
    throw Error('Modifica l’assegnazione dalla scheda speaker con conferma del riepilogo.');
  if (
    collection === 'interviewSlots' &&
    existing?.interviewerId &&
    incoming.primarySpeaker !== existing.primarySpeaker
  )
    throw Error('Prima di cambiare speaker, verifica l’assegnazione dalla scheda conduttore.');
}
