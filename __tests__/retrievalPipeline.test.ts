import { RetrievalPipeline } from '@/services/retrievalPipeline';
import { FusionSearch } from '@/services/fusionSearch';
import { CrossEncoder } from '@/services/crossEncoder';
import type { DocumentChunk } from '@/services/vectorStore';

// Mock dependencies
jest.mock('@/services/pdfParser', () => ({
  extractTextWithPages: jest.fn().mockResolvedValue([]),
  extractTextFromPDF: jest.fn().mockResolvedValue(''),
}));
jest.mock('@/services/fusionSearch');
jest.mock('@/services/crossEncoder');

describe('RetrievalPipeline', () => {
  let pipeline: RetrievalPipeline;
  const mockDoc1: DocumentChunk = {
    id: 'doc-1',
    content: 'Quantum computing and entanglement fundamentals',
    metadata: { source: 'quantum.pdf', chunkIdx: 0, pageNumber: 1 },
    embedding: Array(384).fill(0.1),
  };
  const mockDoc2: DocumentChunk = {
    id: 'doc-2',
    content: 'Classical computing versus quantum algorithms',
    metadata: { source: 'computing.pdf', chunkIdx: 1, pageNumber: 3 },
    embedding: Array(384).fill(0.2),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // @ts-ignore - reset singleton instance for clean test state
    RetrievalPipeline.instance = undefined;
    pipeline = RetrievalPipeline.getInstance();

    (FusionSearch.prototype.search as jest.Mock).mockResolvedValue([
      {
        doc: mockDoc1,
        rrfScore: 0.033,
        denseRank: 1,
        bm25Rank: 1,
        denseScore: 0.85,
        bm25Score: 4.2,
      },
      {
        doc: mockDoc2,
        rrfScore: 0.031,
        denseRank: 2,
        bm25Rank: 2,
        denseScore: 0.78,
        bm25Score: 3.5,
      },
    ]);

    (CrossEncoder.getInstance as jest.Mock).mockReturnValue({
      warmup: jest.fn().mockResolvedValue(undefined),
      rerank: jest.fn().mockResolvedValue([
        {
          doc: mockDoc2,
          crossEncoderScore: 0.96,
          originalScore: 0.031,
          rank: 1,
        },
        {
          doc: mockDoc1,
          crossEncoderScore: 0.42,
          originalScore: 0.033,
          rank: 2,
        },
      ]),
    });
  });

  it('should initialize with default mode (enhanced)', () => {
    expect(pipeline.getMode()).toBe('enhanced');
  });

  it('should allow toggling modes between baseline and enhanced', () => {
    pipeline.setMode('baseline');
    expect(pipeline.getMode()).toBe('baseline');

    pipeline.setMode('enhanced');
    expect(pipeline.getMode()).toBe('enhanced');
  });

  it('should invalidate fusion index on onDocumentsChanged', () => {
    pipeline.onDocumentsChanged();
    expect(FusionSearch.prototype.invalidateIndex).toHaveBeenCalled();
  });

  it('should execute baseline pipeline correctly without reranking', async () => {
    pipeline.setMode('baseline');
    const result = await pipeline.retrieve('quantum computing');

    expect(result.mode).toBe('baseline');
    expect(result.results.length).toBe(2);
    expect(result.results[0].doc.id).toBe('doc-1');
    expect(result.timing.fusionMs).toBeGreaterThanOrEqual(0);
    expect(result.timing.rerankMs).toBe(0);
    expect(result.stages.some(s => s.includes('baseline'))).toBe(true);
  });

  it('should execute enhanced pipeline with cross-encoder reranking', async () => {
    pipeline.setMode('enhanced');
    const result = await pipeline.retrieve('quantum computing');

    expect(result.mode).toBe('enhanced');
    expect(result.results.length).toBe(2);
    // Reranked result puts doc-2 first
    expect(result.results[0].doc.id).toBe('doc-2');
    expect(result.results[0].score).toBe(0.96);
    expect(result.timing.rerankMs).toBeGreaterThanOrEqual(0);
    expect(result.stages.some(s => s.includes('Rerank'))).toBe(true);
  });

  it('should respect modeOverride and topNOverride in options', async () => {
    pipeline.setMode('enhanced');
    const result = await pipeline.retrieve('quantum computing', {
      modeOverride: 'baseline',
      topNOverride: 1,
    });

    expect(result.mode).toBe('baseline');
    expect(result.results.length).toBe(1);
    expect(result.results[0].doc.id).toBe('doc-1');
  });

  it('should construct structured groundedContext with prompt text and citations', async () => {
    pipeline.setMode('enhanced');
    const result = await pipeline.retrieve('quantum computing');

    expect(result.groundedContext).toBeDefined();
    expect(result.groundedContext.candidateCount).toBe(2);
    expect(result.groundedContext.citations.length).toBe(2);
    expect(result.groundedContext.citations[0].source).toBe('computing.pdf');
    expect(result.groundedContext.formattedContext).toContain('[Source: computing.pdf, Page 3]');
    expect(result.groundedContext.formattedContext).toContain('[Source: quantum.pdf, Page 1]');
  });
});
