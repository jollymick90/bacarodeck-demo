import manifest from '../../BacaroTech_Schede_Speaker_2026/manifest.json';
import type { Entity } from './fields';

// "In elenco" refers to the Bacaro interview selection, not the conference directory.
const interviewIds = new Set(
  manifest.speakers.filter((speaker) => speaker.group === 'in').map((speaker) => speaker.speakerId)
);
export function isInInterviewList(speaker: Entity): boolean {
  return typeof speaker.inInterviewList === 'boolean'
    ? speaker.inInterviewList
    : interviewIds.has(speaker.id);
}
