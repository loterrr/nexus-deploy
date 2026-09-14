'use client';

import { RETRIEVAL_TOP_K, RERANKER_TOP_N, DEFAULT_PIPELINE_MODE } from '@/lib/constants';
import type { PipelineMode } from '@/lib/constants';
import type { SearchResultItem } from './vectorStore';
import { FusionSearch } from './fusionSearch';
import { CrossEncoder } from './crossEncoder';

// ─── Pipeline Result Types ─────────────────────────────────────

export interface GroundedCitation {
  source: string;
  pageNumber?: number;
  snippet?: string;
}

export interface GroundedContext {
  formattedContext: string;
  citations: GroundedCitation[];
  candidateCount: number;
}

export interface PipelineResult {
  results: SearchResultItem[];
  groundedContext: GroundedContext;
  mode: PipelineMode;
  timing: PipelineTiming;
  stages: string[];
}

export interface PipelineTiming {
  totalMs: number;
  fusionMs: number;
  rerankMs: number;
}

// ─── Retrieval Pipeline Orchestrator ───────────────────────────

export class RetrievalPipeline {
  private static instance: RetrievalPipeline;
  private fusionSearch: FusionSearch;
  private crossEncoder: CrossEncoder;
  private mode: PipelineMode;

  private constructor() {
    this.fusionSearch = new FusionSearch();
    this.crossEncoder = CrossEncoder.getInstance();
    this.mode = DEFAULT_PIPELINE_MODE;
  }

  static getInstance(): RetrievalPipeline {
    if (!RetrievalPipeline.instance) {
      RetrievalPipeline.instance = new RetrievalPipeline();
    }
    return RetrievalPipeline.instance;
  }

  getMode(): PipelineMode {
    return this.mode;
  }

  setMode(mode: PipelineMode): void {
    this.mode = mode;
    console.log(`[Pipeline] Mode set to: ${mode}`);
  }

  /** Invalidate caches when documents change */
  onDocumentsChanged(): void {
    this.fusionSearch.invalidateIndex();
  }

  /** Pre-load cross-encoder model */
  async warmup(): Promise<void> {
    if (this.mode === 'enhanced') {
      await this.crossEncoder.warmup();
    }
  }

  /**
   * Build structured GroundedContext with prompt-ready context and citation metadata.
   */
  buildGroundedContext(results: SearchResultItem[]): GroundedContext {
    const citations: GroundedCitation[] = results.map(r => ({
      source: r.doc.metadata.source,
      pageNumber: r.doc.metadata.pageNumber || 1,
      snippet: r.doc.content.slice(0, 160),
    }));

    const formattedContext = results
      .map(r => {
        const page = r.doc.metadata.pageNumber || 1;
        return `[Source: ${r.doc.metadata.source}, Page ${page}]\n${r.doc.content}`;
      })
      .join('\n\n---\n\n');

    return {
      formattedContext,
      citations,
      candidateCount: results.length,
    };
  }

  /**
   * Execute the full retrieval pipeline.
   *
   * Baseline: BM25 + Dense → RRF → Top-K directly to LLM
   * Enhanced: BM25 + Dense → RRF → Cross-Encoder → Top-N to LLM
   */
  async retrieve(query: string, options?: { modeOverride?: PipelineMode, topKOverride?: number, topNOverride?: number }): Promise<PipelineResult> {
    const totalStart = performance.now();
    const stages: string[] = [];

    // ── Stage 1: Hybrid Fusion Search (BM25 + Dense + RRF) ──
    const fusionStart = performance.now();
    const topK = options?.topKOverride || RETRIEVAL_TOP_K;
    const topN = options?.topNOverride || RERANKER_TOP_N;
    const currentMode = options?.modeOverride || this.mode;

    const fusionResults = await this.fusionSearch.search(query, topK);
    const fusionMs = performance.now() - fusionStart;
    stages.push(`Fusion: ${fusionResults.length} candidates in ${fusionMs.toFixed(0)}ms`);

    if (currentMode === 'baseline') {
      // Baseline: return fusion results directly (truncated to top-N for context window)
      const topResults: SearchResultItem[] = fusionResults.slice(0, topN).map(r => ({
        doc: r.doc,
        score: r.rrfScore,
      }));

      const totalMs = performance.now() - totalStart;
      stages.push(`Total: ${totalMs.toFixed(0)}ms (baseline)`);

      console.log(`[Pipeline][Baseline] ${topResults.length} results in ${totalMs.toFixed(0)}ms`);

      const groundedContext = this.buildGroundedContext(topResults);

      return {
        results: topResults,
        groundedContext,
        mode: 'baseline',
        timing: { totalMs, fusionMs, rerankMs: 0 },
        stages,
      };
    }

    // ── Stage 2: Cross-Encoder Reranking (Enhanced only) ──
    const rerankStart = performance.now();
    const candidates = fusionResults.map(r => ({
      doc: r.doc,
      originalScore: r.rrfScore,
    }));

    const reranked = await this.crossEncoder.rerank(query, candidates, topN);
    const rerankMs = performance.now() - rerankStart;
    stages.push(`Rerank: ${reranked.length} selected in ${rerankMs.toFixed(0)}ms`);

    const topResults: SearchResultItem[] = reranked.map(r => ({
      doc: r.doc,
      score: r.crossEncoderScore,
    }));

    const totalMs = performance.now() - totalStart;
    stages.push(`Total: ${totalMs.toFixed(0)}ms (enhanced)`);

    console.log(`[Pipeline][Enhanced] ${topResults.length} results in ${totalMs.toFixed(0)}ms (fusion: ${fusionMs.toFixed(0)}ms, rerank: ${rerankMs.toFixed(0)}ms)`);

    const groundedContext = this.buildGroundedContext(topResults);

    return {
      results: topResults,
      groundedContext,
      mode: 'enhanced',
      timing: { totalMs, fusionMs, rerankMs },
      stages,
    };
  }
}
