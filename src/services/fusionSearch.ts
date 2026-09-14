'use client';

import { RRF_K, RETRIEVAL_TOP_K } from '@/lib/constants';
import { VectorStore, SearchResultItem } from './vectorStore';
import { BM25Index } from './bm25';

export interface FusionResult {
  doc: SearchResultItem['doc'];
  rrfScore: number;
  denseRank: number | null;
  bm25Rank: number | null;
  denseScore: number;
  bm25Score: number;
}

/**
 * Reciprocal Rank Fusion (RRF) search.
 * Runs dense (cosine) and sparse (BM25) searches in parallel,
 * then merges results using RRF formula:
 *   score(d) = Σ 1/(k + rank(d))
 */
export class FusionSearch {
  private bm25Index: BM25Index;
  private vectorStore: VectorStore;
  private isIndexBuilt = false;

  constructor() {
    this.vectorStore = VectorStore.getInstance();
    this.bm25Index = new BM25Index();
  }

  /** Rebuild BM25 index from current VectorStore documents */
  rebuildIndex(): void {
    const docs = this.vectorStore.getAllDocuments();
    this.bm25Index.build(docs);
    this.isIndexBuilt = true;
    console.log(`[FusionSearch] BM25 index built: ${this.bm25Index.getDocumentCount()} docs, ${this.bm25Index.getVocabularySize()} terms`);
  }

  /**
   * Execute hybrid search with RRF fusion.
   * @param query - User's search query
   * @param topK - Number of candidates to return (default from constants)
   * @returns Fused, ranked results
   */
  async search(query: string, topK: number = RETRIEVAL_TOP_K): Promise<FusionResult[]> {
    // Ensure BM25 index is built and in sync with current vectorStore document count
    const currentDocs = this.vectorStore.getAllDocuments();
    if (!this.isIndexBuilt || this.bm25Index.getDocumentCount() !== currentDocs.length) {
      this.rebuildIndex();
    }

    // Run both searches in parallel
    const [denseResults, bm25Results] = await Promise.all([
      this.vectorStore.searchDense(query, topK),
      Promise.resolve(this.bm25Index.search(query, topK)),
    ]);

    // Build rank maps (docId → rank position, 1-indexed)
    const denseRankMap = new Map<string, { rank: number; score: number }>();
    denseResults.forEach((r, i) => {
      denseRankMap.set(r.doc.id, { rank: i + 1, score: r.score });
    });

    const bm25RankMap = new Map<string, { rank: number; score: number }>();
    bm25Results.forEach((r, i) => {
      bm25RankMap.set(r.doc.id, { rank: i + 1, score: r.score });
    });

    // Collect all unique document IDs
    const allDocIds = new Set<string>();
    denseResults.forEach(r => allDocIds.add(r.doc.id));
    bm25Results.forEach(r => allDocIds.add(r.doc.id));

    // Build doc lookup
    const docMap = new Map<string, SearchResultItem['doc']>();
    for (const r of denseResults) docMap.set(r.doc.id, r.doc);
    for (const r of bm25Results) docMap.set(r.doc.id, r.doc);

    // Calculate RRF scores
    const fusionResults: FusionResult[] = [];

    const allDocIdArr = Array.from(allDocIds);
    for (let i = 0; i < allDocIdArr.length; i++) {
      const docId = allDocIdArr[i];
      const doc = docMap.get(docId)!;
      const denseEntry = denseRankMap.get(docId);
      const bm25Entry = bm25RankMap.get(docId);

      let rrfScore = 0;
      if (denseEntry) rrfScore += 1 / (RRF_K + denseEntry.rank);
      if (bm25Entry) rrfScore += 1 / (RRF_K + bm25Entry.rank);

      fusionResults.push({
        doc,
        rrfScore,
        denseRank: denseEntry?.rank ?? null,
        bm25Rank: bm25Entry?.rank ?? null,
        denseScore: denseEntry?.score ?? 0,
        bm25Score: bm25Entry?.score ?? 0,
      });
    }

    // Sort by RRF score descending
    fusionResults.sort((a, b) => b.rrfScore - a.rrfScore);

    console.log(`[FusionSearch] RRF merged: ${denseResults.length} dense + ${bm25Results.length} BM25 → ${fusionResults.length} unique → top-${topK}`);

    return fusionResults.slice(0, topK);
  }

  /** Invalidate BM25 index (call when documents change) */
  invalidateIndex(): void {
    this.isIndexBuilt = false;
  }
}
