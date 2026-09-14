'use client';

import { VectorStore, SearchResultItem } from './vectorStore';
import { RetrievalPipeline } from './retrievalPipeline';
import { OLLAMA_MODEL } from '@/lib/constants';
import type {
  EvalQueryItem,
  EvalDataset,
  RetrievalMetrics,
  PerQueryRetrievalResult,
  RetrievedDocInfo,
  GenerationMetrics,
  PerQueryGenerationResult,
  EfficiencyMetrics,
  EvalRunResult,
  EvalRunConfig,
} from '@/types/evaluation';
import { v4 as uuidv4 } from 'uuid';

// ─── Helper: Percentile ────────────────────────────────────────
export function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}

// ─── Retrieval Metric Calculations ─────────────────────────────

/** Mean Reciprocal Rank: 1/rank of first relevant result */
export function calcReciprocalRank(retrieved: RetrievedDocInfo[]): number {
  for (const doc of retrieved) {
    if (doc.isRelevant) return 1 / doc.rank;
  }
  return 0;
}

/** Precision@k = relevant in top-k / k */
export function calcPrecisionAtK(retrieved: RetrievedDocInfo[], k: number): number {
  const topK = retrieved.slice(0, k);
  const relevant = topK.filter(d => d.isRelevant).length;
  return relevant / k;
}

/** Recall@k = relevant in top-k / total relevant */
export function calcRecallAtK(retrieved: RetrievedDocInfo[], k: number, totalRelevant: number): number {
  if (totalRelevant === 0) return 0;
  const topK = retrieved.slice(0, k);
  const relevant = topK.filter(d => d.isRelevant).length;
  return relevant / totalRelevant;
}

/** NDCG@k with graded relevance */
export function calcNDCG(retrieved: RetrievedDocInfo[], k: number, relevanceGrades: Record<string, number>): number {
  const topK = retrieved.slice(0, k);

  // DCG
  let dcg = 0;
  for (let i = 0; i < topK.length; i++) {
    const grade = relevanceGrades[topK[i].source] || 0;
    dcg += (Math.pow(2, grade) - 1) / Math.log2(i + 2);
  }

  // Ideal DCG
  const idealGrades = Object.values(relevanceGrades).sort((a, b) => b - a).slice(0, k);
  let idcg = 0;
  for (let i = 0; i < idealGrades.length; i++) {
    idcg += (Math.pow(2, idealGrades[i]) - 1) / Math.log2(i + 2);
  }

  if (idcg === 0) return 0;
  return dcg / idcg;
}

// ─── Generation Quality Calculations ───────────────────────────

/** Groundedness: fraction of sentences in answer that reference the context */
export function calcGroundedness(answer: string, contextChunks: string[]): number {
  if (!answer || answer.trim().length === 0) return 0;

  // Split answer into sentences
  const sentences = answer
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 15); // ignore very short fragments

  if (sentences.length === 0) return 1;

  const combinedContext = contextChunks.join(' ').toLowerCase();
  let groundedCount = 0;

  for (const sentence of sentences) {
    // Extract meaningful words (4+ chars)
    const words = sentence.toLowerCase().split(/\s+/).filter(w => w.length >= 4);
    if (words.length === 0) {
      groundedCount++;
      continue;
    }

    // Check what fraction of meaningful words appear in context
    const matchedWords = words.filter(w => combinedContext.includes(w));
    const overlapRatio = matchedWords.length / words.length;

    // If >40% of words from the sentence are in context, consider it grounded
    if (overlapRatio >= 0.4) {
      groundedCount++;
    }
  }

  return groundedCount / sentences.length;
}

/** Correctness: overlap of expected answer fragments with generated answer */
export function calcCorrectness(answer: string, expectedFragments: string[]): number {
  if (!expectedFragments || expectedFragments.length === 0) return -1; // N/A
  const lowerAnswer = answer.toLowerCase();
  const matched = expectedFragments.filter(f => lowerAnswer.includes(f.toLowerCase()));
  return matched.length / expectedFragments.length;
}

/** Completeness: are all expected aspects addressed? */
export function calcCompleteness(_answer: string, relevantDocs: string[], citedSources: string[]): number {
  if (relevantDocs.length === 0) return 1;
  const coveredDocs = relevantDocs.filter(doc =>
    citedSources.some(src => src.includes(doc) || doc.includes(src))
  );
  return coveredDocs.length / relevantDocs.length;
}

/** Extract cited source filenames from a response */
export function extractCitations(text: string): string[] {
  const citations: string[] = [];
  const regex = /\[Source:\s*([^\]]+)\]/gi;
  let match;
  while ((match = regex.exec(text)) !== null) {
    citations.push(match[1].trim());
  }
  return Array.from(new Set(citations));
}

// ─── Sample Evaluation Datasets ────────────────────────────────

export function createAutoDataset(): EvalDataset {
  return {
    id: uuidv4(),
    name: 'Auto-Generated from Knowledge Base',
    description: 'Automatically generates evaluation queries from your uploaded documents. Uses document titles and content snippets as queries to test retrieval accuracy.',
    queries: [], // populated dynamically
    createdAt: Date.now(),
  };
}

export function generateQueriesFromStore(store: VectorStore): EvalQueryItem[] {
  const filenames = store.getUniqueFilenames();
  const allDocs = store.getAllDocuments();

  const queries: EvalQueryItem[] = [];

  for (const filename of filenames) {
    const docsForFile = allDocs.filter(d => d.metadata.source === filename);
    if (docsForFile.length === 0) continue;

    // Query 1: search by filename topic
    const cleanName = filename.replace('.pdf', '').replace(/[_-]/g, ' ');
    queries.push({
      id: uuidv4(),
      query: `What is discussed in ${cleanName}?`,
      relevantDocs: [filename],
      relevanceGrades: { [filename]: 2 },
    });

    // Query 2: use a content snippet as the query
    const midDoc = docsForFile[Math.floor(docsForFile.length / 2)];
    if (midDoc && midDoc.content.length > 30) {
      const snippet = midDoc.content.slice(0, 80).trim();
      queries.push({
        id: uuidv4(),
        query: snippet,
        relevantDocs: [filename],
        expectedAnswerFragments: [snippet.slice(0, 40)],
        relevanceGrades: { [filename]: 3 },
      });
    }

    // Query 3: cross-document query if multiple docs
    if (filenames.length > 1) {
      const otherFile = filenames.find(f => f !== filename);
      if (otherFile) {
        queries.push({
          id: uuidv4(),
          query: `Compare the topics between ${cleanName} and ${otherFile.replace('.pdf', '').replace(/[_-]/g, ' ')}`,
          relevantDocs: [filename, otherFile],
          relevanceGrades: { [filename]: 2, [otherFile]: 2 },
        });
      }
    }
  }

  return queries;
}

// ─── Evaluation Engine ─────────────────────────────────────────

export class EvaluationService {


  async runFullEvaluation(
    dataset: EvalDataset,
    config: EvalRunConfig,
    onProgress: (result: Partial<EvalRunResult>) => void
  ): Promise<EvalRunResult> {
    const runId = uuidv4();
    const queries = dataset.queries;

    if (queries.length === 0) {
      return {
        id: runId,
        timestamp: Date.now(),
        status: 'error',
        config,
        dataset,
        retrieval: null,
        generation: null,
        efficiency: null,
        error: 'No evaluation queries in dataset. Upload documents first.',
        progress: 0,
        currentStep: 'Error',
      };
    }

    const totalSteps = config.runGeneration ? queries.length * 2 : queries.length;
    let currentStepIdx = 0;

    // ── Phase 1: Retrieval Evaluation ──
    onProgress({ progress: 5, currentStep: 'Starting retrieval evaluation...' });

    const retrievalPerQuery: PerQueryRetrievalResult[] = [];
    const retrievalLatencies: number[] = [];

    for (const q of queries) {
      const startTime = performance.now();

      const pipelineRes = await RetrievalPipeline.getInstance().retrieve(q.query, {
        modeOverride: config.pipelineMode,
        topKOverride: Math.max(config.k, 10),
        topNOverride: config.k,
      });
      const searchResults = pipelineRes.results;
      const latencyMs = performance.now() - startTime;
      retrievalLatencies.push(latencyMs);

      const retrieved: RetrievedDocInfo[] = searchResults.map((r: SearchResultItem, idx: number) => ({
        source: r.doc.metadata.source,
        score: r.score,
        rank: idx + 1,
        isRelevant: q.relevantDocs.includes(r.doc.metadata.source),
        snippet: r.doc.content.slice(0, 120),
      }));

      const relevanceGrades = q.relevanceGrades || Object.fromEntries(q.relevantDocs.map(d => [d, 1]));

      const result: PerQueryRetrievalResult = {
        queryId: q.id,
        query: q.query,
        reciprocalRank: calcReciprocalRank(retrieved),
        precisionAtK: calcPrecisionAtK(retrieved, config.k),
        recallAtK: calcRecallAtK(retrieved, config.k, q.relevantDocs.length),
        ndcg: calcNDCG(retrieved, config.k, relevanceGrades),
        retrievedDocs: retrieved.slice(0, config.k),
        relevantDocs: q.relevantDocs,
        latencyMs,
      };

      retrievalPerQuery.push(result);
      currentStepIdx++;
      onProgress({
        progress: Math.round((currentStepIdx / totalSteps) * 90) + 5,
        currentStep: `Retrieval: query ${currentStepIdx}/${queries.length}`,
      });
    }

    const retrievalMetrics: RetrievalMetrics = {
      mrr: retrievalPerQuery.reduce((sum, r) => sum + r.reciprocalRank, 0) / retrievalPerQuery.length,
      precisionAtK: retrievalPerQuery.reduce((sum, r) => sum + r.precisionAtK, 0) / retrievalPerQuery.length,
      recallAtK: retrievalPerQuery.reduce((sum, r) => sum + r.recallAtK, 0) / retrievalPerQuery.length,
      ndcg: retrievalPerQuery.reduce((sum, r) => sum + r.ndcg, 0) / retrievalPerQuery.length,
      k: config.k,
      perQueryResults: retrievalPerQuery,
    };

    // ── Phase 2: Generation Evaluation (optional) ──
    let generationMetrics: GenerationMetrics | null = null;
    const generationLatencies: number[] = [];
    const ttftValues: number[] = [];

    if (config.runGeneration) {
      onProgress({ progress: 55, currentStep: 'Starting generation evaluation...' });

      const genPerQuery: PerQueryGenerationResult[] = [];

      for (const q of queries) {
        try {
          // Get context
          const pipelineRes = await RetrievalPipeline.getInstance().retrieve(q.query, {
            modeOverride: config.pipelineMode,
            topKOverride: Math.max(config.k, 10),
            topNOverride: config.k,
          });
          const contextResults = pipelineRes.results;
          
          const context = contextResults.map((r: SearchResultItem) => {
            const page = r.doc.metadata.pageNumber || 1;
            return `[Source: ${r.doc.metadata.source}, Page ${page}]\n${r.doc.content}`;
          }).join('\n\n---\n\n');

          const contextChunks = contextResults.map((r: SearchResultItem) => r.doc.content);

          // Time the generation
          const genStart = performance.now();

          const chatMessages = [
            {
              role: 'system',
              content: 'You are a research assistant. Answer ONLY using the provided context. Cite sources using [Source: filename] format.'
            },
            {
              role: 'user',
              content: `**Context:**\n${context}\n\n**Question:** ${q.query}\n\nAnswer concisely using ONLY the context above.`
            }
          ];

          const res = await fetch('/api/ollama', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'chat',
              model: OLLAMA_MODEL,
              messages: chatMessages,
              stream: false,
            }),
          });

          const ttft = performance.now() - genStart;
          ttftValues.push(ttft);

          if (!res.ok) {
            throw new Error(`Ollama returned ${res.status}`);
          }

          const data = await res.json();
          const genLatency = performance.now() - genStart;
          generationLatencies.push(genLatency);

          const answer = data.message?.content || '';
          const citedSources = extractCitations(answer);
          const tokensGenerated = answer.split(/\s+/).length;

          const correctnessScore = calcCorrectness(answer, q.expectedAnswerFragments || []);

          genPerQuery.push({
            queryId: q.id,
            query: q.query,
            generatedAnswer: answer,
            groundedness: calcGroundedness(answer, contextChunks),
            correctness: correctnessScore >= 0 ? correctnessScore : -1,
            completeness: calcCompleteness(answer, q.relevantDocs, citedSources),
            citedSources,
            latencyMs: genLatency,
            tokensGenerated,
          });
        } catch (err) {
          console.error(`Generation failed for query "${q.query}":`, err);
          genPerQuery.push({
            queryId: q.id,
            query: q.query,
            generatedAnswer: `[Error: ${err instanceof Error ? err.message : 'Unknown error'}]`,
            groundedness: 0,
            correctness: 0,
            completeness: 0,
            citedSources: [],
            latencyMs: 0,
            tokensGenerated: 0,
          });
        }

        currentStepIdx++;
        onProgress({
          progress: Math.round((currentStepIdx / totalSteps) * 90) + 5,
          currentStep: `Generation: query ${currentStepIdx - queries.length}/${queries.length}`,
        });
      }

      // Filter out N/A correctness for averaging
      const validCorrectness = genPerQuery.filter(r => r.correctness >= 0);

      generationMetrics = {
        averageGroundedness: genPerQuery.reduce((sum, r) => sum + r.groundedness, 0) / genPerQuery.length,
        averageCorrectness: validCorrectness.length > 0
          ? validCorrectness.reduce((sum, r) => sum + r.correctness, 0) / validCorrectness.length
          : -1,
        averageCompleteness: genPerQuery.reduce((sum, r) => sum + r.completeness, 0) / genPerQuery.length,
        perQueryResults: genPerQuery,
      };
    }

    // ── Phase 3: Efficiency Metrics ──
    const efficiency: EfficiencyMetrics = {
      avgRetrievalLatencyMs: retrievalLatencies.reduce((a, b) => a + b, 0) / retrievalLatencies.length,
      avgGenerationLatencyMs: generationLatencies.length > 0
        ? generationLatencies.reduce((a, b) => a + b, 0) / generationLatencies.length
        : 0,
      avgTotalLatencyMs: (
        retrievalLatencies.reduce((a, b) => a + b, 0) +
        generationLatencies.reduce((a, b) => a + b, 0)
      ) / queries.length,
      avgTimeToFirstTokenMs: ttftValues.length > 0
        ? ttftValues.reduce((a, b) => a + b, 0) / ttftValues.length
        : 0,
      p95RetrievalLatencyMs: percentile(retrievalLatencies, 95),
      p95GenerationLatencyMs: generationLatencies.length > 0
        ? percentile(generationLatencies, 95)
        : 0,
      peakMemoryUsageMb: typeof performance !== 'undefined' && (performance as any).memory
        ? Math.round(((performance as any).memory.usedJSHeapSize / 1024 / 1024) * 10) / 10
        : null,
      totalQueriesRun: queries.length,
    };

    onProgress({ progress: 100, currentStep: 'Evaluation complete!' });

    return {
      id: runId,
      timestamp: Date.now(),
      status: 'completed',
      config,
      dataset,
      retrieval: retrievalMetrics,
      generation: generationMetrics,
      efficiency,
      progress: 100,
      currentStep: 'Evaluation complete!',
    };
  }
}
