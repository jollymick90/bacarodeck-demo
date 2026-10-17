import type { Dataset, Entity } from './fields';
const categories: [string, RegExp][] = [
  [
    'AI',
    /\b(ai|llms?|rag|agents?|agenti|machine learning|deep learning|intelligenza artificiale|artificial intelligence|generative|generativa|neural|neurali)\b/i
  ],
  [
    'Backend',
    /\b(backend|back.end|node\.?js|java|spring|dotnet|\.net|microservices|microservizi|server.side|apis?|graphql|grpc)\b/i
  ],
  [
    'Frontend',
    /\b(frontend|front.end|react|angular|vue|svelte|css|html|javascript|typescript|web components|accessibilita|accessibility)\b/i
  ],
  ['Cloud', /\b(cloud|aws|azure|gcp|kubernetes|serverless|containers|container|docker)\b/i],
  [
    'DevOps',
    /\b(devops|ci\/cd|continuous delivery|continuous integration|deployment|observability|osservabilita|sre|terraform|kubernetes)\b/i
  ],
  [
    'Sicurezza',
    /\b(security|sicurezza|cybersecurity|authentication|autenticazione|authorization|autorizzazione|owasp|vulnerabilit\w*|privacy|crittografia|cryptography)\b/i
  ],
  [
    'Dati',
    /\b(databases?|data engineering|data science|data pipelines?|sql|nosql|postgres\w*|mongodb|analytics|analisi dei dati|basi di dati)\b/i
  ],
  [
    'Leadership',
    /\b(leadership|management|mentoring|mentorship|team culture|engineering manager|gestione del team|cultura aziendale)\b/i
  ]
];
export type TagProposal = {
  speaker: Entity;
  additions: string[];
  evidence: Record<string, string>;
};
export function suggestSpeakerTags(data: Dataset): TagProposal[] {
  const proposals: TagProposal[] = [];
  for (const speaker of data.speakers || []) {
    const talks = (data.talks || []).filter(
      (talk) => Array.isArray(talk.speakerIds) && talk.speakerIds.includes(speaker.id)
    );
    const text = talks
      .flatMap((talk) => [
        talk.title,
        talk.abstractMd,
        talk.abstractIt,
        talk.abstractEn,
        talk.topic
      ])
      .filter((value) => typeof value === 'string')
      .join('\n')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const current = new Set(
      (Array.isArray(speaker.tags) ? speaker.tags : []).map((tag) =>
        String(tag).trim().toLowerCase()
      )
    );
    const evidence: Record<string, string> = {};
    for (const [tag, pattern] of categories) {
      const match = text.match(pattern);
      if (match && !current.has(tag.toLowerCase())) evidence[tag] = match[0];
    }
    const additions = Object.keys(evidence);
    if (additions.length) proposals.push({ speaker, additions, evidence });
  }
  return proposals;
}
