'use client';

import { RERANKER_MODEL } from '@/lib/constants';
import type { DocumentChunk } from './vectorStore';
import { NeuralWorkerClient } from './neuralWorkerClient';

/**
 * Cross-Encoder Reranker using Transformers.js.
 * Evaluates query-document pairs jointly for deep contextual relevance scoring.
 * Uses Xenova/ms-marco-MiniLM-L-6-v2 (ONNX, runs in-browser).
 */

export interface RerankCandidate {
  doc: DocumentChunk;
  originalScore: number;
}

export interface RerankResult {
  doc: DocumentChunk;
  crossEncoderScore: number;
  originalScore: number;
  rank: number;
}

// Module-level singleton state
let classifierPipeline: any = null;
let isLoading = false;
let loadPromise: Promise<void> | null = null;

async function loadReranker(): Promise<void> {
  if (classifierPipeline) return;
  if (loadPromise) return loadPromise;

  isLoading = true;
  loadPromise = (async () => {
    try {
      console.log(`[CrossEncoder] Loading reranker model: ${RERANKER_MODEL}...`);
      const transformers = await import('@xenova/transformers');
      transformers.env.allowLocalModels = true;
      transformers.env.localModelPath = '/models/';
      transformers.env.allowRemoteModels = false;
      transformers.env.useBrowserCache = false;

      // ms-marco models are text-classification pipelines
      classifierPipeline = await transformers.pipeline(
        'text-classification',
        RERANKER_MODEL,
        { quantized: true }
      );

      console.log('[CrossEncoder] Reranker model loaded successfully');
    } catch (err) {
      console.error('[CrossEncoder] Failed to load reranker:', err);
      classifierPipeline = null;
      throw err;
    } finally {
      isLoading = false;
    }
  })();

  return loadPromise;
}

export class CrossEncoder {
  private static instance: CrossEncoder;

  private constructor() {}

  static getInstance(): CrossEncoder {
    if (!CrossEncoder.instance) {
      CrossEncoder.instance = new CrossEncoder();
    }
    return CrossEncoder.instance;
  }

  /** Pre-load the reranker model (call during app init if desired) */
  async warmup(): Promise<void> {
    await loadReranker();
  }

  isReady(): boolean {
    return classifierPipeline !== null;
  }

  isLoadingModel(): boolean {
    return isLoading;
  }

  /**
   * Rerank candidates by evaluating each (query, passage) pair through
   * the cross-encoder. Returns results sorted by cross-encoder score.
   *
   * @param query - The user's query
   * @param candidates - Broad candidate list from fusion search
   * @param topN - Number of top results to return
   */
  async rerank(
    query: string,
    candidates: RerankCandidate[],
    topN: number = 5
  ): Promise<RerankResult[]> {
    const workerClient = NeuralWorkerClient.getInstance();
    if (workerClient.isAvailable() && candidates.length > 0) {
      try {
        const workerResults = await workerClient.rerank(
          query,
          candidates.map(c => ({ id: c.doc.id, content: c.doc.content, originalScore: c.originalScore })),
          topN
        );
        const docMap = new Map<string, DocumentChunk>();
        for (const c of candidates) docMap.set(c.doc.id, c.doc);

        return workerResults.map(r => ({
          doc: docMap.get(r.id)!,
          crossEncoderScore: r.crossEncoderScore,
          originalScore: r.originalScore,
          rank: r.rank,
        }));
      } catch (err) {
        console.warn('[CrossEncoder] Worker rerank failed, falling back to local:', err);
      }
    }

    await loadReranker();

    if (!classifierPipeline) {
      console.warn('[CrossEncoder] Reranker not available, returning candidates as-is');
      return candidates.slice(0, topN).map((c, i) => ({
        doc: c.doc,
        crossEncoderScore: c.originalScore,
        originalScore: c.originalScore,
        rank: i + 1,
      }));
    }

    console.log(`[CrossEncoder] Reranking ${candidates.length} candidates for query: "${query.slice(0, 60)}..."`);
    const startTime = performance.now();

    // Score candidates in batches of 4 to prevent WebAssembly memory spikes and UI thread freezing
    const BATCH_SIZE = 4;
    const scoredResults: { doc: DocumentChunk; ceScore: number; originalScore: number }[] = [];

    for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
      const batch = candidates.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(async (candidate) => {
        try {
          const input = `${query} [SEP] ${candidate.doc.content}`;
          const output = await classifierPipeline(input, { topk: 2 });
          let score = 0;
          if (Array.isArray(output)) {
            const positive = output.find((item: any) => item.label === 'LABEL_1');
            score = positive ? positive.score : output[0]?.score ?? 0;
          } else if (output && typeof output === 'object') {
            score = (output as any).score ?? 0;
          }
          return { doc: candidate.doc, ceScore: score, originalScore: candidate.originalScore };
        } catch (err) {
          console.warn(`[CrossEncoder] Failed to score candidate ${candidate.doc.id}:`, err);
          return { doc: candidate.doc, ceScore: -999, originalScore: candidate.originalScore };
        }
      });

      const settled = await Promise.allSettled(batchPromises);
      for (const item of settled) {
        if (item.status === 'fulfilled') {
          scoredResults.push(item.value);
        }
      }
    }

    // Sort by cross-encoder score descending
    scoredResults.sort((a, b) => b.ceScore - a.ceScore);

    const elapsed = performance.now() - startTime;
    console.log(`[CrossEncoder] Reranking complete in ${elapsed.toFixed(0)}ms`);

    // Return top-N with rank assignments
    return scoredResults.slice(0, topN).map((r, i) => ({
      doc: r.doc,
      crossEncoderScore: r.ceScore,
      originalScore: r.originalScore,
      rank: i + 1,
    }));
  }
}
