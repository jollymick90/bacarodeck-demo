import type { Collection, Entity } from '../fields';
import { assignmentOwner } from './assignment';
export function guardConductorDelete(collection: Collection, existing: Entity) {
  if (
    (collection === 'interviewPlans' && assignmentOwner(existing)) ||
    (collection === 'interviewSlots' && existing.interviewerId)
  )
    throw Error(
      'Un piano o slot assegnato non si elimina direttamente: conserva l’assegnazione o riassegna dalla scheda speaker.'
    );
}
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
