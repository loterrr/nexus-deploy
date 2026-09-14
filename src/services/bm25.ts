'use client';

import { BM25_K1, BM25_B } from '@/lib/constants';
import type { DocumentChunk, SearchResultItem } from './vectorStore';

// ─── Stopwords (common English) ────────────────────────────────
const STOPWORDS = new Set([
  'a','an','the','and','or','but','in','on','at','to','for','of','with',
  'by','from','is','it','its','are','was','were','be','been','being',
  'have','has','had','do','does','did','will','would','could','should',
  'may','might','can','shall','this','that','these','those','i','you',
  'he','she','we','they','me','him','her','us','them','my','your','his',
  'our','their','what','which','who','whom','when','where','why','how',
  'not','no','nor','so','if','then','than','too','very','just','about',
  'also','as','into','each','only','own','same','other','such','both',
]);

// ─── Simple Stemmer (Porter-like suffix stripping) ─────────────
function stem(word: string): string {
  let w = word;
  if (w.length > 4) {
    if (w.endsWith('ing')) w = w.slice(0, -3);
    else if (w.endsWith('tion')) w = w.slice(0, -4);
    else if (w.endsWith('ness')) w = w.slice(0, -4);
    else if (w.endsWith('ment')) w = w.slice(0, -4);
    else if (w.endsWith('able')) w = w.slice(0, -4);
    else if (w.endsWith('ible')) w = w.slice(0, -4);
    else if (w.endsWith('ally')) w = w.slice(0, -4);
    else if (w.endsWith('ous')) w = w.slice(0, -3);
    else if (w.endsWith('ive')) w = w.slice(0, -3);
    else if (w.endsWith('ful')) w = w.slice(0, -3);
    else if (w.endsWith('less')) w = w.slice(0, -4);
    else if (w.endsWith('ly')) w = w.slice(0, -2);
    else if (w.endsWith('ed')) w = w.slice(0, -2);
    else if (w.endsWith('es')) w = w.slice(0, -2);
    else if (w.endsWith('er')) w = w.slice(0, -2);
    else if (w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
  }
  return w.length >= 2 ? w : word;
}

/** Tokenize text → lowercased, stemmed, stopword-filtered tokens */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 2 && !STOPWORDS.has(w))
    .map(stem);
}

// ─── Inverted Index Entry ──────────────────────────────────────
interface PostingEntry {
  docIdx: number;
  tf: number;  // term frequency in this doc
}

// ─── BM25 Search Engine ────────────────────────────────────────
export class BM25Index {
  private documents: DocumentChunk[] = [];
  private docLengths: number[] = [];
  private avgDl: number = 0;
  private invertedIndex: Map<string, PostingEntry[]> = new Map();
  private docTokenCounts: number[] = [];
  private isBuilt = false;

  /**
   * Build the BM25 inverted index from document chunks.
   * Call this whenever documents change.
   */
  build(documents: DocumentChunk[]): void {
    this.documents = documents;
    this.invertedIndex.clear();
    this.docLengths = [];
    this.docTokenCounts = [];

    let totalLength = 0;

    for (let i = 0; i < documents.length; i++) {
      const tokens = tokenize(documents[i].content);
      this.docLengths.push(tokens.length);
      this.docTokenCounts.push(tokens.length);
      totalLength += tokens.length;

      // Count term frequencies
      const tfMap = new Map<string, number>();
      for (const token of tokens) {
        tfMap.set(token, (tfMap.get(token) || 0) + 1);
      }

      // Add to inverted index
      const entries = Array.from(tfMap.entries());
      for (let e = 0; e < entries.length; e++) {
        const term = entries[e][0];
        const tf = entries[e][1];
        if (!this.invertedIndex.has(term)) {
          this.invertedIndex.set(term, []);
        }
        this.invertedIndex.get(term)!.push({ docIdx: i, tf });
      }
    }

    this.avgDl = documents.length > 0 ? totalLength / documents.length : 0;
    this.isBuilt = true;
  }

  /**
   * Search using Okapi BM25 scoring.
   * Returns ranked results compatible with SearchResultItem.
   */
  search(query: string, limit: number = 20): SearchResultItem[] {
    if (!this.isBuilt || this.documents.length === 0) return [];

    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) return [];

    const N = this.documents.length;
    const scores = new Float64Array(N);

    for (const term of queryTokens) {
      const postings = this.invertedIndex.get(term);
      if (!postings) continue;

      // IDF: log((N - df + 0.5) / (df + 0.5) + 1)
      const df = postings.length;
      const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1);

      for (const { docIdx, tf } of postings) {
        const dl = this.docLengths[docIdx];
        // BM25 TF component
        const tfNorm = (tf * (BM25_K1 + 1)) /
          (tf + BM25_K1 * (1 - BM25_B + BM25_B * (dl / this.avgDl)));
        scores[docIdx] += idf * tfNorm;
      }
    }

    // Collect and sort
    const results: { idx: number; score: number }[] = [];
    for (let i = 0; i < N; i++) {
      if (scores[i] > 0) {
        results.push({ idx: i, score: scores[i] });
      }
    }
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, limit).map(r => ({
      doc: this.documents[r.idx],
      score: r.score,
    }));
  }

  getDocumentCount(): number {
    return this.documents.length;
  }

  getVocabularySize(): number {
    return this.invertedIndex.size;
  }
}
