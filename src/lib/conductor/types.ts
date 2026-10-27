import type { Entity } from '../fields';
export type ConductorBrief = Entity & {
  speakerId: string;
  talkId?: string;
  mainQuestionIds?: string[];
  optionalQuestionIds?: string[];
  classicQuestionIds?: string[];
};
export type SpeakerInterest = Entity & { speakerId: string; memberUid: string };
export type ResolvedBrief = {
  brief?: Entity;
  talk?: Entity;
  mainQuestions: Entity[];
  optionalQuestions: Entity[];
  interviewQuestions: Entity[];
  classicQuestions: Entity[];
  summary: string;
  abstract: string;
  summaryOrigin: 'editorial' | 'abstract_excerpt' | 'missing';
  selectionOrigin: 'editorial' | 'legacy_proposal' | 'empty';
};
