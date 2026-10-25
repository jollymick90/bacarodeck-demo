import type { Entity } from '../fields';
export type ConductorBrief = Entity & {
  speakerId: string;
  talkId?: string;
  mainQuestionIds?: string[];
  classicQuestionIds?: string[];
};
export type SpeakerInterest = Entity & { speakerId: string; memberUid: string };
export type ResolvedBrief = {
  brief?: Entity;
  talk?: Entity;
  mainQuestions: Entity[];
  classicQuestions: Entity[];
  summary: string;
  summaryOrigin: 'editorial' | 'abstract_excerpt' | 'missing';
  selectionOrigin: 'editorial' | 'legacy_proposal' | 'empty';
};
