/**
 * Dedicated Neural Web Worker
 * Offloads ONNX embedding and cross-encoder inference from the UI thread.
 */

let pipeline: any = null;
let embedder: any = null;
let reranker: any = null;
let transformersLoaded = false;

const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';
const RERANKER_MODEL = 'Xenova/ms-marco-MiniLM-L-6-v2';

async function initTransformers() {
  if (transformersLoaded) return;
  const transformers = await import('@xenova/transformers');
  pipeline = transformers.pipeline;
  const env = transformers.env;

  env.allowLocalModels = true;
  env.localModelPath = '/models/';
  env.allowRemoteModels = false;
  env.useBrowserCache = false;

  transformersLoaded = true;
}

async function getEmbedder() {
  if (embedder) return embedder;
  await initTransformers();
  embedder = await pipeline('feature-extraction', EMBEDDING_MODEL, { quantized: true });
  return embedder;
}

async function getReranker() {
  if (reranker) return reranker;
  await initTransformers();
  reranker = await pipeline('text-classification', RERANKER_MODEL, { quantized: true });
  return reranker;
}

self.onmessage = async (event: MessageEvent) => {
  const { id, type, payload } = event.data;

  try {
    switch (type) {
      case 'INIT': {
        await initTransformers();
        self.postMessage({ id, success: true });
        break;
      }

      case 'EMBED': {
        const model = await getEmbedder();
        const text = payload.text as string;
        const output = await model(text, { pooling: 'mean', normalize: true });
        const vector = Array.from(output.data as Float32Array);
        self.postMessage({ id, success: true, data: vector });
        break;
      }

      case 'EMBED_BATCH': {
        const model = await getEmbedder();
        const texts = payload.texts as string[];
        const vectors: number[][] = [];
        for (const text of texts) {
          const output = await model(text, { pooling: 'mean', normalize: true });
          vectors.push(Array.from(output.data as Float32Array));
        }
        self.postMessage({ id, success: true, data: vectors });
        break;
      }

      case 'RERANK': {
        const model = await getReranker();
        const { query, candidates, topN } = payload as {
          query: string;
          candidates: { id: string; content: string; originalScore: number }[];
          topN: number;
        };

        const BATCH_SIZE = 4;
        const scored: { id: string; ceScore: number; originalScore: number }[] = [];

        for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
          const batch = candidates.slice(i, i + BATCH_SIZE);
          const batchResults = await Promise.all(
            batch.map(async (c) => {
              try {
                const input = `${query} [SEP] ${c.content}`;
                const output = await model(input, { topk: 2 });
                let score = 0;
                if (Array.isArray(output)) {
                  const positive = output.find((item: any) => item.label === 'LABEL_1');
                  score = positive ? positive.score : output[0]?.score ?? 0;
                } else if (output && typeof output === 'object') {
                  score = (output as any).score ?? 0;
                }
                return { id: c.id, ceScore: score, originalScore: c.originalScore };
              } catch {
                return { id: c.id, ceScore: -999, originalScore: c.originalScore };
              }
            })
          );
          scored.push(...batchResults);
        }

        scored.sort((a, b) => b.ceScore - a.ceScore);
        const topResults = scored.slice(0, topN).map((r, index) => ({
          id: r.id,
          crossEncoderScore: r.ceScore,
          originalScore: r.originalScore,
          rank: index + 1,
        }));

        self.postMessage({ id, success: true, data: topResults });
        break;
      }

      default:
        throw new Error(`Unknown worker task type: ${type}`);
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    self.postMessage({ id, success: false, error: errorMsg });
  }
};
