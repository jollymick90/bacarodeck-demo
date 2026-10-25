import { describe, expect, it } from 'vitest';
import {
  buildGraphNodes,
  buildAutomaticEdges,
  mergeGraphEdges,
  relationId,
  validateRelation,
  SEMANTIC_TOP_K
} from '../src/lib/connections/model';
import type { Dataset, Entity } from '../src/lib/fields';
import type { GraphNode } from '../src/lib/connections/types';
const data: Dataset = {
  speakers: [
    { id: 's1', fullName: 'Uno', notesMd: 'Note pertinenti. '.repeat(1000) },
    { id: 's2', fullName: 'Due' }
  ],
  talks: [
    {
      id: 't',
      speakerIds: ['s1'],
      title: 'Verifica agenti',
      abstractIt: 'Controllare risultati indipendenti',
      topic: 'code-review'
    }
  ],
  questions: [
    {
      id: 'q1',
      speakerId: 's1',
      textIt: 'Chi verifica il risultato?',
      textEn: 'Who verifies the result?',
      followUpEn: 'With which evidence?',
      tags: [' CODE_REVIEW ']
    },
    { id: 'q2', speakerId: 's2', textEn: 'Who checks the outcome?', tags: ['code-review'] }
  ],
  insights: [{ id: 'i1', speakerIds: ['s1'], bodyMd: 'Evidenza del team.' }]
};
const node = (id: string, kind: GraphNode['kind'] = 'question'): GraphNode => ({
  id: `${kind}:${id}`,
  kind,
  entityId: id,
  label: id,
  href: '/',
  text: id,
  speakerId: id,
  evidence: [{ collection: 'questions', id, excerpt: id }]
});
describe('connection graph', () => {
  it('builds stable canonical topics from aliases and bounded source context', () => {
    const nodes = buildGraphNodes(data);
    const speaker = nodes.find((n) => n.id === 'speaker:s1')!;
    expect(speaker.text).toContain('Verifica agenti');
    expect(speaker.text).toContain('Controllare risultati');
    expect(speaker.text).toContain('Evidenza del team.');
    expect(speaker.text.length).toBeLessThanOrEqual(6000);
    expect(nodes.find((n) => n.id === 'question:q1')?.text).toContain('With which evidence?');
    const edges = buildAutomaticEdges(nodes, {});
    expect(
      edges.some(
        (e) =>
          e.source === 'question:q1' &&
          e.target === 'topic:review-verifica' &&
          e.origin === 'explicit'
      )
    ).toBe(true);
    expect(edges.some((e) => e.kind === 'question-similar')).toBe(false);
  });
  it('retains catalog topics with empty/custom data and exposes question themes on speakers', () => {
    const nodes = buildGraphNodes({ ...data, topics: [{ id: 'custom', label: 'Custom theme' }] });
    expect(nodes.some((n) => n.id === 'topic:review-verifica')).toBe(true);
    expect(nodes.some((n) => n.id === 'topic:custom')).toBe(true);
    const edge = buildAutomaticEdges(nodes, {}).find(
      (e) => e.source === 'speaker:s2' && e.target === 'topic:review-verifica'
    );
    expect(edge?.origin).toBe('explicit');
    expect(edge?.evidence.some((e) => e.collection === 'questions' && e.id === 'q2')).toBe(true);
  });
  it('keeps default catalog for empty persisted topics and links questions to their editor', () => {
    const nodes = buildGraphNodes({ ...data, topics: [] });
    expect(nodes.some((n) => n.id === 'topic:review-verifica')).toBe(true);
    expect(nodes.find((n) => n.id === 'question:q1')?.href).toBe(
      '/backoffice/contenuti/questions/q1?speaker=s1'
    );
  });
  it('uses vectors for cross-speaker similarity, never shared tags; rejects broken vectors', () => {
    const nodes = [node('a'), node('b'), node('c')];
    nodes[2].speakerId = 'a';
    expect(buildAutomaticEdges(nodes, {})).toEqual([]);
    const edges = buildAutomaticEdges(nodes, {
      'question:a': [1, 0],
      'question:b': [0.99, 0.01],
      'question:c': [1, 0]
    });
    expect(edges.some((e) => e.source === 'question:a' && e.target === 'question:b')).toBe(true);
    expect(edges.some((e) => e.source === 'question:a' && e.target === 'question:c')).toBe(false);
    expect(
      buildAutomaticEdges(nodes, {
        'question:a': [1, 0],
        'question:b': [0, 1],
        'question:c': [NaN, 0]
      })
    ).toEqual([]);
  });
  it('caps semantic degree and is deterministic under input reordering', () => {
    const nodes = Array.from({ length: 15 }, (_, i) => node(String(i)));
    const vectors = Object.fromEntries(nodes.map((n) => [n.id, [1, 0]]));
    const edges = buildAutomaticEdges(nodes, vectors);
    for (const n of nodes)
      expect(
        edges.filter((e) => e.source === n.id || e.target === n.id).length
      ).toBeLessThanOrEqual(SEMANTIC_TOP_K);
    expect(buildAutomaticEdges([...nodes].reverse(), vectors)).toEqual(edges);
  });
  it('canonicalizes endpoints and rejects invalid pairs and self loops', () => {
    expect(relationId('question-similar', 'question:a', 'question:b')).toBe(
      relationId('question-similar', 'question:b', 'question:a')
    );
    expect(relationId('speaker-topic', 'topic:t', 'speaker:s')).toBe(
      relationId('speaker-topic', 'speaker:s', 'topic:t')
    );
    expect(
      relationId('question-similar', 'question:' + 'a'.repeat(128), 'question:' + 'b'.repeat(128))
        .length
    ).toBeLessThanOrEqual(128);
    expect(() =>
      validateRelation('speaker-topic', node('s', 'speaker'), node('t', 'topic'))
    ).not.toThrow();
    expect(() => validateRelation('speaker-topic', node('s'), node('t', 'topic'))).toThrow();
    expect(() => validateRelation('question-similar', node('a'), node('a'))).toThrow();
  });
  it('persists manual/confirmed edges and dismissals across recomputation, removes missing endpoints', () => {
    const nodes = [node('a'), node('b')];
    const automatic = buildAutomaticEdges(nodes, { 'question:a': [1, 0], 'question:b': [1, 0] });
    const base: Entity = {
      id: 'override',
      source: 'question:a',
      target: 'question:b',
      kind: 'question-similar',
      decision: 'dismissed'
    };
    expect(mergeGraphEdges(nodes, automatic, [base])).toEqual([]);
    expect(mergeGraphEdges(nodes, automatic, [])).toHaveLength(1);
    for (const decision of ['linked', 'confirmed']) {
      const merged = mergeGraphEdges(nodes, [], [{ ...base, decision }]);
      expect(merged).toHaveLength(1);
      expect(merged[0].origin).toBe(decision === 'linked' ? 'manual' : 'confirmed');
    }
    expect(mergeGraphEdges([nodes[0]], automatic, [{ ...base, decision: 'linked' }])).toEqual([]);
  });
});
