import catalog from '../../../data/editorial/2026-10-25-topic-connections.json';
import type { Dataset, Entity, Value } from '../fields';
import type { Evidence, GraphNode, GraphEdge, RelationKind } from './types';

export const SEMANTIC_TOP_K = 4;
// Suggestions, not equivalence: multilingual fixture scores .645 for independent verification
// across IT/EN and .587 for a lexical distractor; question threshold separates these cases.
export const SEMANTIC_THRESHOLDS: Record<RelationKind, number> = {
  'question-similar': 0.63,
  'speaker-similar': 0.74,
  'topic-related': 0.72,
  'speaker-topic': 0.62,
  'question-topic': 0.62
};
export const MAX_SEMANTIC_TEXT = 6000;
const string = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const strings = (v: Value | undefined) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
export const normalizeTopic = (v: string) =>
  v
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-');
const excerpt = (text: string, limit = 240) => text.replace(/\s+/g, ' ').trim().slice(0, limit);
const live = (e: Entity) => e.status !== 'archived' && e.status !== 'rejected';
const evidence = (collection: string, entity: Entity, text: string): Evidence => ({
  collection,
  id: entity.id,
  excerpt: excerpt(text)
});
const join = (values: unknown[]) => [...new Set(values.map(string).filter(Boolean))].join('\n');
const sorted = <T extends { id: string }>(values: T[]) =>
  [...values].sort((a, b) => a.id.localeCompare(b.id));

export function buildGraphNodes(data: Dataset): GraphNode[] {
  const nodes: GraphNode[] = [];
  const topics = [
    ...new Map<string, Entity>(
      [...catalog.topics, ...(data.topics ?? [])].map((t) => [t.id, t])
    ).values()
  ];
  for (const topic of topics) {
    const label = string(topic.label) || topic.id;
    const aliases = strings(topic.aliases);
    const text = join([label, 'description' in topic ? topic.description : '', ...aliases]);
    nodes.push({
      id: `topic:${topic.id}`,
      kind: 'topic',
      entityId: topic.id,
      label,
      href: `/topic/connessioni?node=${encodeURIComponent(`topic:${topic.id}`)}`,
      text: text.slice(0, MAX_SEMANTIC_TEXT),
      aliases: [topic.id, label, ...aliases].map(normalizeTopic),
      evidence: [evidence('topics', topic, text)]
    });
  }
  const speakers = sorted((data.speakers ?? []).filter(live));
  for (const speaker of speakers) {
    const talks = sorted(
      (data.talks ?? []).filter(
        (t) =>
          live(t) &&
          (strings(t.speakerIds).includes(speaker.id) || strings(speaker.talkIds).includes(t.id))
      )
    );
    const insights = sorted(
      (data.insights ?? []).filter((i) => live(i) && strings(i.speakerIds).includes(speaker.id))
    ).slice(0, 3);
    const materials = sorted(
      (data.materials ?? []).filter((i) => live(i) && strings(i.speakerIds).includes(speaker.id))
    ).slice(0, 2);
    const chunks: string[] = [];
    const sources: Evidence[] = [];
    for (const talk of talks.slice(0, 3)) {
      const text = join([
        talk.title,
        talk.topic,
        talk.abstractIt,
        talk.abstractEn,
        talk.abstractMd
      ]).slice(0, 1200);
      if (text) {
        chunks.push(text);
        sources.push(evidence('talks', talk, text));
      }
    }
    for (const [collection, items] of [
      ['insights', insights],
      ['materials', materials]
    ] as const)
      for (const item of items) {
        const text = join([item.title, item.bodyMd]).slice(0, 350);
        if (text) {
          chunks.push(text);
          sources.push(evidence(collection, item, text));
        }
      }
    const notes = string(speaker.notesMd).slice(0, 500);
    if (notes) {
      chunks.push(notes);
      sources.push(evidence('speakers', speaker, notes));
    }
    nodes.push({
      id: `speaker:${speaker.id}`,
      kind: 'speaker',
      entityId: speaker.id,
      label: string(speaker.fullName) || join([speaker.firstName, speaker.lastName]) || speaker.id,
      href: `/speaker/${encodeURIComponent(speaker.id)}`,
      text: chunks.join('\n').slice(0, MAX_SEMANTIC_TEXT),
      tags: [
        ...strings(speaker.tags),
        ...talks.flatMap((t) => [string(t.topic), ...strings(t.tags)])
      ]
        .filter(Boolean)
        .map(normalizeTopic),
      evidence: sources
    });
  }
  const speakerIds = new Set(speakers.map((s) => s.id));
  for (const q of sorted((data.questions ?? []).filter(live))) {
    const speakerId = string(q.speakerId);
    if (!speakerIds.has(speakerId)) continue;
    const text = join([q.textIt, q.textEn, q.followUpIt, q.followUpEn]).slice(0, MAX_SEMANTIC_TEXT);
    nodes.push({
      id: `question:${q.id}`,
      kind: 'question',
      entityId: q.id,
      label: excerpt(string(q.textIt) || string(q.textEn) || q.id, 140),
      href: `/backoffice/contenuti/questions/${encodeURIComponent(q.id)}?speaker=${encodeURIComponent(speakerId)}`,
      speakerId,
      text,
      tags: strings(q.tags).map(normalizeTopic),
      evidence: [evidence('questions', q, text)]
    });
  }
  return sorted(nodes);
}
function endpoints(kind: RelationKind, source: string, target: string): [string, string] {
  if (kind === 'speaker-topic' || kind === 'question-topic')
    return source.startsWith('topic:') ? [target, source] : [source, target];
  return source < target ? [source, target] : [target, source];
}
export function relationId(kind: RelationKind, source: string, target: string): string {
  const key = JSON.stringify([kind, ...endpoints(kind, source, target)]);
  // Four independently seeded 32-bit lanes keep IDs portable, bounded and stable.
  const hash = [2166136261, 2246822507, 3266489909, 668265263]
    .map((seed) => {
      let h = seed;
      for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
      return (h >>> 0).toString(16).padStart(8, '0');
    })
    .join('');
  return `rel-${hash}`;
}
export function validateRelation(kind: RelationKind, source: GraphNode, target: GraphNode): void {
  if (source.id === target.id) throw new Error('Non puoi collegare un nodo a sé stesso.');
  const pairs: Record<RelationKind, string[]> = {
    'speaker-topic': ['speaker', 'topic'],
    'question-topic': ['question', 'topic'],
    'topic-related': ['topic', 'topic'],
    'speaker-similar': ['speaker', 'speaker'],
    'question-similar': ['question', 'question']
  };
  const expected = pairs[kind];
  if (!expected || [source.kind, target.kind].sort().join(':') !== [...expected].sort().join(':'))
    throw new Error('Tipo di relazione non compatibile con i nodi.');
}
function makeEdge(
  kind: RelationKind,
  a: GraphNode,
  b: GraphNode,
  origin: GraphEdge['origin'],
  reason: string,
  score?: number
): GraphEdge {
  const [source, target] = endpoints(kind, a.id, b.id);
  return {
    id: relationId(kind, source, target),
    source,
    target,
    kind,
    origin,
    reason,
    ...(score === undefined ? {} : { score }),
    evidence: [...a.evidence.slice(0, 2), ...b.evidence.slice(0, 2)]
  };
}
function cosine(a: number[] | undefined, b: number[] | undefined): number {
  if (!a?.length || !b || a.length !== b.length) return -1;
  let dot = 0,
    aa = 0,
    bb = 0;
  for (let i = 0; i < a.length; i++) {
    if (!Number.isFinite(a[i]) || !Number.isFinite(b[i])) return -1;
    dot += a[i] * b[i];
    aa += a[i] * a[i];
    bb += b[i] * b[i];
  }
  return aa && bb ? Math.max(-1, Math.min(1, dot / Math.sqrt(aa * bb))) : -1;
}
export function buildAutomaticEdges(
  nodes: GraphNode[],
  vectors: Record<string, number[]>
): GraphEdge[] {
  const ordered = sorted(nodes);
  const edges = new Map<string, GraphEdge>();
  const candidates: GraphEdge[] = [];
  for (const node of ordered.filter((n) => n.kind !== 'topic'))
    for (const topic of ordered.filter((n) => n.kind === 'topic')) {
      const match = (node.tags ?? []).find((tag) =>
        (topic.aliases ?? [topic.entityId, topic.label]).some(
          (alias) => normalizeTopic(alias) === normalizeTopic(tag)
        )
      );
      if (match) {
        const kind = node.kind === 'speaker' ? 'speaker-topic' : 'question-topic';
        const edge = makeEdge(
          kind,
          node,
          topic,
          'explicit',
          `Tag «${match}» associato al tema «${topic.label}».`
        );
        edges.set(edge.id, edge);
      }
    }
  // A question's declared theme is editorial context, never an assertion of expertise.
  for (const edge of [...edges.values()]) {
    if (edge.kind !== 'question-topic') continue;
    const question = ordered.find((n) => n.id === edge.source)!;
    const speaker = ordered.find((n) => n.id === `speaker:${question.speakerId}`);
    const topic = ordered.find((n) => n.id === edge.target)!;
    if (!speaker) continue;
    const derived = makeEdge(
      'speaker-topic',
      speaker,
      topic,
      'explicit',
      `Tema dichiarato nella domanda «${excerpt(question.text, 140)}»; non attesta competenze o posizioni dello speaker.`
    );
    derived.evidence = [...question.evidence, ...topic.evidence].slice(0, 4);
    if (!edges.has(derived.id)) edges.set(derived.id, derived);
  }
  for (let i = 0; i < ordered.length; i++)
    for (let j = i + 1; j < ordered.length; j++) {
      const a = ordered[i],
        b = ordered[j];
      let kind: RelationKind;
      if (a.kind === b.kind) {
        kind =
          a.kind === 'question'
            ? 'question-similar'
            : a.kind === 'speaker'
              ? 'speaker-similar'
              : 'topic-related';
        if (a.kind === 'question' && (!a.speakerId || !b.speakerId || a.speakerId === b.speakerId))
          continue;
      } else if (a.kind === 'topic' || b.kind === 'topic')
        kind = a.kind === 'speaker' || b.kind === 'speaker' ? 'speaker-topic' : 'question-topic';
      else continue;
      if (!a.text.trim() || !b.text.trim()) continue;
      const score = cosine(vectors[a.id], vectors[b.id]);
      if (score < SEMANTIC_THRESHOLDS[kind]) continue;
      const edge = makeEdge(
        kind,
        a,
        b,
        'automatic',
        `Vicinanza semantica automatica, da verificare: «${excerpt(a.text, 110)}» / «${excerpt(b.text, 110)}».`,
        score
      );
      if (!edges.has(edge.id)) candidates.push(edge);
    }
  const degree = new Map<string, number>();
  for (const edge of candidates.sort(
    (a, b) => (b.score ?? 0) - (a.score ?? 0) || a.id.localeCompare(b.id)
  )) {
    if (
      (degree.get(edge.source) ?? 0) >= SEMANTIC_TOP_K ||
      (degree.get(edge.target) ?? 0) >= SEMANTIC_TOP_K
    )
      continue;
    edges.set(edge.id, edge);
    for (const id of [edge.source, edge.target]) degree.set(id, (degree.get(id) ?? 0) + 1);
  }
  return sorted([...edges.values()]);
}
export function mergeGraphEdges(
  nodes: GraphNode[],
  automatic: GraphEdge[],
  overrides: Entity[]
): GraphEdge[] {
  const index = new Map(nodes.map((n) => [n.id, n]));
  const result = new Map<string, GraphEdge>();
  for (const edge of automatic) {
    const a = index.get(edge.source),
      b = index.get(edge.target);
    if (!a || !b) continue;
    try {
      validateRelation(edge.kind, a, b);
    } catch {
      continue;
    }
    const [source, target] = endpoints(edge.kind, a.id, b.id);
    const id = relationId(edge.kind, source, target);
    result.set(id, { ...edge, id, source, target });
  }
  for (const override of sorted(overrides)) {
    const a = index.get(string(override.source)),
      b = index.get(string(override.target)),
      kind = string(override.kind) as RelationKind;
    if (!a || !b) continue;
    try {
      validateRelation(kind, a, b);
    } catch {
      continue;
    }
    const id = relationId(kind, a.id, b.id);
    if (override.decision === 'dismissed') {
      result.delete(id);
      continue;
    }
    if (override.decision !== 'linked' && override.decision !== 'confirmed') continue;
    const old = result.get(id);
    const reason =
      string(override.reason) ||
      old?.reason ||
      (override.decision === 'confirmed'
        ? 'Collegamento confermato dalla redazione.'
        : 'Collegamento aggiunto dalla redazione.');
    result.set(
      id,
      makeEdge(kind, a, b, override.decision === 'confirmed' ? 'confirmed' : 'manual', reason)
    );
  }
  return sorted([...result.values()]);
}
