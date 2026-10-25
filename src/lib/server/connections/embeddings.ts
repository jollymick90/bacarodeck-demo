import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { GraphNode } from '../../connections/types';
import { semanticChunks } from './job-state';
export const MODEL_NAME = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';
export const MODEL_REVISION = '2c4055b12046f11709e9df2c122e59ffbdc2f900';
export const MODEL_VERSION = `${MODEL_NAME}@${MODEL_REVISION}:q8:mean:chunks-v2`;
type Extractor = (
  text: string[],
  options: { pooling: 'mean'; normalize: true }
) => Promise<{ tolist(): number[][] }>;
let loading: Promise<Extractor> | undefined;
function extractor(): Promise<Extractor> {
  if (!loading)
    loading = (async () => {
      const { pipeline, env } = await import('@huggingface/transformers');
      env.allowLocalModels = false;
      env.cacheDir = join(tmpdir(), 'bacarodeck-models');
      const result = await pipeline('feature-extraction', MODEL_NAME, {
        revision: MODEL_REVISION,
        dtype: 'q8',
        session_options: { intraOpNumThreads: 2, interOpNumThreads: 1 }
      });
      return result as unknown as Extractor;
    })().catch((error) => {
      loading = undefined;
      throw error;
    });
  return loading;
}
// Serialise CPU inference inside an instance; the shared model holds no workspace data.
let tail: Promise<unknown> = Promise.resolve();
export function embedNode(node: GraphNode): Promise<number[]> {
  const operation = tail
    .catch(() => {})
    .then(async () => {
      const chunks = semanticChunks(node.kind, node.text);
      if (!chunks.length) return [];
      const model = await extractor();
      const result = (await model(chunks, { pooling: 'mean', normalize: true })).tolist();
      const vector = Array.from(
        { length: result[0].length },
        (_, i) => result.reduce((sum, row) => sum + row[i], 0) / result.length
      );
      const norm = Math.hypot(...vector);
      if (!norm || vector.some((x) => !Number.isFinite(x))) throw Error('Embedding non valido.');
      return vector.map((x) => x / norm);
    });
  tail = operation;
  return operation;
}
