import type { Entity } from '../fields';
export type RelationKind =
  'speaker-topic' | 'question-topic' | 'topic-related' | 'speaker-similar' | 'question-similar';
export type Evidence = { collection: string; id: string; excerpt: string };
export type GraphNode = {
  id: string;
  kind: 'speaker' | 'topic' | 'question';
  entityId: string;
  label: string;
  href: string;
  text: string;
  speakerId?: string;
  aliases?: string[];
  tags?: string[];
  evidence: Evidence[];
};
export type GraphEdge = {
  id: string;
  source: string;
  target: string;
  kind: RelationKind;
  origin: 'explicit' | 'automatic' | 'manual' | 'confirmed';
  reason: string;
  score?: number;
  evidence: Evidence[];
};
export type GraphResponse = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  overrides: Entity[];
  status: {
    state: 'pending' | 'running' | 'ready' | 'error';
    error?: string;
    generatedAt?: number;
    progress?: number;
    total?: number;
  };
  model: string;
  stale: boolean;
};
