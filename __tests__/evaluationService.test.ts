import {
  percentile,
  calcReciprocalRank,
  calcPrecisionAtK,
  calcRecallAtK,
  calcNDCG,
  calcGroundedness,
  calcCorrectness,
  calcCompleteness,
  extractCitations
} from '@/services/evaluationService';
import type { RetrievedDocInfo } from '@/types/evaluation';

jest.mock('@/services/pdfParser', () => ({
  extractTextWithPages: jest.fn().mockResolvedValue([])
}));

describe('EvaluationService Metrics', () => {
  describe('percentile', () => {
    it('should calculate correct percentiles', () => {
      const arr = [10, 20, 30, 40, 50];
      expect(percentile(arr, 0)).toBe(10);
      expect(percentile(arr, 50)).toBe(30);
      expect(percentile(arr, 100)).toBe(50);
      expect(percentile(arr, 25)).toBe(20);
    });

    it('should handle empty arrays', () => {
      expect(percentile([], 50)).toBe(0);
    });
  });

  describe('Retrieval Metrics', () => {
    const docs: RetrievedDocInfo[] = [
      { source: 'doc1.pdf', score: 0.9, rank: 1, isRelevant: false, snippet: 'A' },
      { source: 'doc2.pdf', score: 0.8, rank: 2, isRelevant: true, snippet: 'B' },
      { source: 'doc3.pdf', score: 0.7, rank: 3, isRelevant: true, snippet: 'C' },
      { source: 'doc4.pdf', score: 0.6, rank: 4, isRelevant: false, snippet: 'D' },
    ];

    it('should calculate MRR correctly', () => {
      // First relevant is at rank 2 -> MRR = 1/2
      expect(calcReciprocalRank(docs)).toBe(0.5);
      
      const noRelevant: RetrievedDocInfo[] = [
        { source: 'doc1.pdf', score: 0.9, rank: 1, isRelevant: false, snippet: 'A' }
      ];
      expect(calcReciprocalRank(noRelevant)).toBe(0);
    });

    it('should calculate Precision@k correctly', () => {
      expect(calcPrecisionAtK(docs, 2)).toBe(0.5); // 1 relevant out of top 2
      expect(calcPrecisionAtK(docs, 3)).toBe(2/3); // 2 relevant out of top 3
      expect(calcPrecisionAtK(docs, 1)).toBe(0);   // 0 relevant out of top 1
    });

    it('should calculate Recall@k correctly', () => {
      const totalRelevant = 2; // doc2, doc3
      expect(calcRecallAtK(docs, 1, totalRelevant)).toBe(0);   // 0 out of 2
      expect(calcRecallAtK(docs, 2, totalRelevant)).toBe(0.5); // 1 out of 2
      expect(calcRecallAtK(docs, 3, totalRelevant)).toBe(1.0); // 2 out of 2
    });

    it('should calculate NDCG correctly', () => {
      const grades = { 'doc2.pdf': 3, 'doc3.pdf': 2 };
      
      // Top 3 DCG = (2^0-1)/log2(2) + (2^3-1)/log2(3) + (2^2-1)/log2(4)
      // Rank 1 (doc1): grade 0 -> 0
      // Rank 2 (doc2): grade 3 -> 7 / log2(3) = 7 / 1.585 = 4.417
      // Rank 3 (doc3): grade 2 -> 3 / log2(4) = 3 / 2 = 1.5
      // DCG = 5.917
      
      // Ideal DCG (top 3 from ideal ranking: doc2, doc3)
      // Rank 1: grade 3 -> 7 / log2(2) = 7
      // Rank 2: grade 2 -> 3 / log2(3) = 1.892
      // IDCG = 8.892
      
      // NDCG = 5.917 / 8.892 ≈ 0.665
      
      const ndcg = calcNDCG(docs, 3, grades);
      expect(ndcg).toBeCloseTo(0.665, 2);
    });
  });

  describe('Generation Metrics', () => {
    it('should calculate groundedness correctly', () => {
      const answer = "Machine learning is a subset of AI. It uses data to train models. Quantum computing is totally different.";
      const context = [
        "Machine learning focuses on using data and algorithms to imitate the way that humans learn.",
        "It is considered a subset of artificial intelligence."
      ];
      
      // Sentences:
      // 1. "Machine learning is a subset of AI" (Words: machine, learning, subset) -> all in context -> grounded
      // 2. "It uses data to train models" (Words: uses, data, train, models) -> uses, data in context (2/4 = 50%) -> grounded
      // 3. "Quantum computing is totally different" (Words: quantum, computing, totally, different) -> 0 in context -> ungrounded
      // 2 / 3 = 0.66
      
      const score = calcGroundedness(answer, context);
      expect(score).toBeCloseTo(0.666, 2);
    });

    it('should calculate correctness correctly', () => {
      const answer = "The capital of France is Paris and it has the Eiffel Tower.";
      const fragments = ["Paris", "Eiffel Tower", "Louvre"];
      
      // 2 out of 3 fragments matched
      expect(calcCorrectness(answer, fragments)).toBe(2/3);
    });

    it('should calculate completeness correctly', () => {
      const citedSources = ["doc1.pdf", "doc3.pdf"];
      const relevantDocs = ["doc1.pdf", "doc2.pdf", "doc3.pdf"];
      
      // 2 out of 3 relevant docs cited
      expect(calcCompleteness("", relevantDocs, citedSources)).toBe(2/3);
    });

    it('should extract citations', () => {
      const answer = "This is a fact [Source: docA.pdf]. Here is another [Source: docB.pdf, Page 2]. And repeating [Source: docA.pdf].";
      const citations = extractCitations(answer);
      
      expect(citations).toContain('docA.pdf');
      expect(citations).toContain('docB.pdf, Page 2');
      expect(citations.length).toBe(2); // Set dedupes
    });
  });
});
