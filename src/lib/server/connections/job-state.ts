export type JobState = {
  state?: 'pending' | 'running' | 'ready' | 'error';
  generation?: number;
  leaseOwner?: string;
  leaseUntil?: number;
  publishedRun?: string;
  publishedInputHash?: string;
  model?: string;
  generatedAt?: number;
  error?: string;
  progress?: number;
  total?: number;
};
export const leaseAvailable = (job: JobState, now: number) => (job.leaseUntil || 0) <= now;
export const canPublish = (
  job: JobState,
  claim: { generation: number; owner: string },
  inputHash: string,
  currentHash: string
) =>
  job.generation === claim.generation &&
  job.leaseOwner === claim.owner &&
  inputHash === currentHash;

// The model accepts 128 tokens: sample short chunks across the context instead of
// silently truncating all notes behind a long abstract. Questions include translations and follow-ups.
export function semanticChunks(_kind: string, text: string): string[] {
  const paragraphs = text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  const pieces = paragraphs
    .flatMap((s) => s.match(/[\s\S]{1,420}(?:\s|$)/g) || [s.slice(0, 420)])
    .map((s) => s.trim())
    .filter(Boolean);
  if (pieces.length <= 8) return pieces;
  return Array.from({ length: 8 }, (_, i) => pieces[Math.round((i * (pieces.length - 1)) / 7)]);
}
