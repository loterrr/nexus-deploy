'use client';

/**
 * Training Data Export Service
 * 
 * Exports evaluation results as JSONL training data for offline
 * cross-encoder fine-tuning with PyTorch.
 * 
 * Format: { query: string, passage: string, label: 0 | 1 }
 * 
 * This data can be used with the supervised training environment
 * described in the upgrade spec (Python + PyTorch offline training).
 */

export interface TrainingPair {
  query: string;
  passage: string;
  label: 0 | 1;
  source?: string;
  score?: number;
}

/**
 * Generate JSONL training data from search results.
 * Relevant documents get label=1, non-relevant get label=0.
 */
export function generateTrainingPairs(
  query: string,
  retrievedPassages: { content: string; source: string; score: number; isRelevant: boolean }[]
): TrainingPair[] {
  return retrievedPassages.map(p => ({
    query,
    passage: p.content,
    label: p.isRelevant ? 1 : 0,
    source: p.source,
    score: p.score,
  }));
}

/**
 * Convert training pairs to JSONL string format.
 * Each line is a valid JSON object.
 */
export function toJSONL(pairs: TrainingPair[]): string {
  return pairs
    .map(p => JSON.stringify({
      query: p.query,
      passage: p.passage,
      label: p.label,
    }))
    .join('\n');
}

/**
 * Download training data as a .jsonl file.
 */
export function downloadTrainingData(pairs: TrainingPair[], filename?: string): void {
  const content = toJSONL(pairs);
  const blob = new Blob([content], { type: 'application/jsonl' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `cross-encoder-training-${Date.now()}.jsonl`;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();

  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}
