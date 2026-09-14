import type { PipelineMode } from '@/lib/constants';

// ─── Evaluation Dataset Types ─────────────────────────────────

export interface EvalQueryItem {
  id: string;
  query: string;
  /** Ground-truth relevant document filenames */
  relevantDocs: string[];
  /** Optional: expected answer substring(s) for correctness checking */
  expectedAnswerFragments?: string[];
  /** Optional: relevance grade per doc (for NDCG). Defaults to binary (1) */
  relevanceGrades?: Record<string, number>;
}

export interface EvalDataset {
  id: string;
  name: string;
  description: string;
  queries: EvalQueryItem[];
  createdAt: number;
}

// ─── Retrieval Metric Results ─────────────────────────────────

export interface RetrievalMetrics {
  mrr: number;
  precisionAtK: number;
  recallAtK: number;
  ndcg: number;
  k: number;
  perQueryResults: PerQueryRetrievalResult[];
}

export interface PerQueryRetrievalResult {
  queryId: string;
  query: string;
  reciprocalRank: number;
  precisionAtK: number;
  recallAtK: number;
  ndcg: number;
  retrievedDocs: RetrievedDocInfo[];
  relevantDocs: string[];
  latencyMs: number;
}

export interface RetrievedDocInfo {
  source: string;
  score: number;
  rank: number;
  isRelevant: boolean;
  snippet: string;
}

// ─── Generation Quality Results ───────────────────────────────

export interface GenerationMetrics {
  averageGroundedness: number;
  averageCorrectness: number;
  averageCompleteness: number;
  perQueryResults: PerQueryGenerationResult[];
}

export interface PerQueryGenerationResult {
  queryId: string;
  query: string;
  generatedAnswer: string;
  groundedness: number;
  correctness: number;
  completeness: number;
  citedSources: string[];
  latencyMs: number;
  tokensGenerated: number;
}

// ─── System Efficiency Results ────────────────────────────────

export interface EfficiencyMetrics {
  avgRetrievalLatencyMs: number;
  avgGenerationLatencyMs: number;
  avgTotalLatencyMs: number;
  avgTimeToFirstTokenMs: number;
  p95RetrievalLatencyMs: number;
  p95GenerationLatencyMs: number;
  peakMemoryUsageMb: number | null;
  totalQueriesRun: number;
}

// ─── Overall Evaluation Run ───────────────────────────────────

export type EvalStatus = 'idle' | 'running' | 'completed' | 'error';

export interface EvalRunConfig {
  k: number;
  runGeneration: boolean;
  datasetId: string;
  pipelineMode: PipelineMode;
}

export interface EvalRunResult {
  id: string;
  timestamp: number;
  status: EvalStatus;
  config: EvalRunConfig;
  dataset: EvalDataset;
  retrieval: RetrievalMetrics | null;
  generation: GenerationMetrics | null;
  efficiency: EfficiencyMetrics | null;
  error?: string;
  progress: number;
  currentStep: string;
}
