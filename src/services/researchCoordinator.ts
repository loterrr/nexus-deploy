'use client';

import { QueryCacheService } from './queryCache';
import { FileCreationService, FileCreationResult } from './fileCreationService';
import { RetrievalPipeline, GroundedContext } from './retrievalPipeline';
import type { PipelineMode } from '@/lib/constants';
import { DEFAULT_PIPELINE_MODE } from '@/lib/constants';

// ─── Research Coordinator Types ─────────────────────────────────

export interface ResearchQueryRequest {
  query: string;
  pipelineMode?: PipelineMode;
  /**
   * Optional streaming chat function adapter.
   * If provided, the coordinator delegates answer synthesis through it.
   */
  streamChatFn?: (query: string, context?: string) => Promise<string | undefined>;
  /**
   * Optional latest assistant message content for file creation post-processing.
   */
  latestAssistantContent?: string;
}

export interface ResearchQueryOutcome {
  query: string;
  answer: string;
  isCachedHit: boolean;
  groundedContext: GroundedContext;
  pipelineMode: PipelineMode;
  timing: {
    totalMs: number;
    retrievalMs: number;
    generationMs: number;
  };
  fileCreationResult?: FileCreationResult;
}

// ─── Deep Research Coordinator Module ───────────────────────────

/**
 * Deep module coordinating the end-to-end research query lifecycle.
 *
 * Sits at the seam between user interaction and underlying retrieval,
 * semantic caching, neural reranking, and generative synthesis.
 */
export class ResearchCoordinator {
  private static instance: ResearchCoordinator;
  private queryCache: QueryCacheService;
  private pipeline: RetrievalPipeline;
  private mode: PipelineMode;

  private constructor() {
    this.queryCache = QueryCacheService.getInstance();
    this.pipeline = RetrievalPipeline.getInstance();
    this.mode = DEFAULT_PIPELINE_MODE;
  }

  static getInstance(): ResearchCoordinator {
    if (!ResearchCoordinator.instance) {
      ResearchCoordinator.instance = new ResearchCoordinator();
    }
    return ResearchCoordinator.instance;
  }

  getPipelineMode(): PipelineMode {
    return this.mode;
  }

  setPipelineMode(mode: PipelineMode): void {
    this.mode = mode;
    this.pipeline.setMode(mode);
  }

  /**
   * Invalidate semantic caches and indices when documents are added/removed.
   */
  onDocumentsChanged(): void {
    this.pipeline.onDocumentsChanged();
  }

  /**
   * Clear active query cache and reset session state.
   */
  async clearSession(): Promise<void> {
    await this.queryCache.clearCache();
  }

  /**
   * Execute the end-to-end research query lifecycle:
   * 1. Intercept query via semantic cache lookup.
   * 2. If cached, short-circuit retrieval and handle any file creation intent.
   * 3. If cache miss, execute hybrid retrieval (BM25 + Dense + RRF +/- Cross-Encoder).
   * 4. Invoke LLM generation with prompt-ready grounded context.
   * 5. Save grounded response to semantic cache.
   * 6. Execute file creation intent if requested by query.
   */
  async ask(request: ResearchQueryRequest): Promise<ResearchQueryOutcome> {
    const totalStart = performance.now();
    const query = request.query.trim();
    const mode = request.pipelineMode || this.mode;
    const isFileCreation = FileCreationService.detectFileCreationIntent(query);

    // ── 1. Semantic Cache Interception ──
    const cachedResponse = await this.queryCache.findCachedResponse(query);
    if (cachedResponse) {
      console.log(`[ResearchCoordinator] Cache HIT for: "${query.slice(0, 50)}..."`);
      let fileResult: FileCreationResult | undefined;

      if (isFileCreation) {
        fileResult = await FileCreationService.handleFileCreation(query, cachedResponse);
      }

      const totalMs = performance.now() - totalStart;

      return {
        query,
        answer: cachedResponse,
        isCachedHit: true,
        groundedContext: {
          formattedContext: '',
          citations: [],
          candidateCount: 0,
        },
        pipelineMode: mode,
        timing: {
          totalMs,
          retrievalMs: 0,
          generationMs: 0,
        },
        fileCreationResult: fileResult,
      };
    }

    // ── 2. Hybrid Retrieval Pipeline ──
    const retrievalStart = performance.now();
    this.pipeline.setMode(mode);
    const pipelineResult = await this.pipeline.retrieve(query);
    const retrievalMs = performance.now() - retrievalStart;

    const groundedContext = pipelineResult.groundedContext;

    // ── 3. Generative Synthesis ──
    const genStart = performance.now();
    let answer = '';
    if (request.streamChatFn) {
      const streamed = await request.streamChatFn(
        query,
        groundedContext.formattedContext || undefined
      );
      answer = streamed || '';
    }
    const generationMs = performance.now() - genStart;

    // ── 4. Cache Persistence ──
    if (
      answer &&
      groundedContext.formattedContext &&
      groundedContext.formattedContext.trim().length > 0 &&
      !answer.includes('User Query:')
    ) {
      await this.queryCache.saveResponse(query, answer);
    }

    // ── 5. Intent Artifact Creation ──
    let fileCreationResult: FileCreationResult | undefined;
    if (isFileCreation) {
      const contentForFile = answer || request.latestAssistantContent;
      fileCreationResult = await FileCreationService.handleFileCreation(
        query,
        contentForFile
      );
    }

    const totalMs = performance.now() - totalStart;

    return {
      query,
      answer,
      isCachedHit: false,
      groundedContext,
      pipelineMode: pipelineResult.mode,
      timing: {
        totalMs,
        retrievalMs,
        generationMs,
      },
      fileCreationResult,
    };
  }
}
