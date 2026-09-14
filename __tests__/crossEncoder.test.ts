import { CrossEncoder, RerankCandidate } from '@/services/crossEncoder';

const mockPipelineFunction = jest.fn();

jest.mock('@xenova/transformers', () => ({
  pipeline: jest.fn().mockImplementation(() => Promise.resolve(mockPipelineFunction)),
  env: {
    allowLocalModels: true,
    localModelPath: '/models/',
    allowRemoteModels: false,
    useBrowserCache: false,
  },
}));

describe('CrossEncoder', () => {
  let crossEncoder: CrossEncoder;

  const mockCandidates: RerankCandidate[] = [
    {
      doc: {
        id: 'candidate-1',
        content: 'Irrelevant content about gardening and botany.',
        metadata: { source: 'plants.pdf', chunkIdx: 0 },
      },
      originalScore: 0.04,
    },
    {
      doc: {
        id: 'candidate-2',
        content: 'Directly relevant findings on neural attention mechanisms.',
        metadata: { source: 'attention.pdf', chunkIdx: 1 },
      },
      originalScore: 0.03,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    // @ts-ignore - reset singleton instance
    CrossEncoder.instance = undefined;
    crossEncoder = CrossEncoder.getInstance();
  });

  it('should implement the singleton pattern', () => {
    const instance1 = CrossEncoder.getInstance();
    const instance2 = CrossEncoder.getInstance();
    expect(instance1).toBe(instance2);
  });

  it('should rerank candidates and order by cross-encoder score descending', async () => {
    mockPipelineFunction.mockImplementation((input: string) => {
      if (input.includes('Directly relevant')) {
        return Promise.resolve([{ label: 'LABEL_1', score: 0.98 }]);
      }
      return Promise.resolve([{ label: 'LABEL_1', score: 0.12 }]);
    });

    const results = await crossEncoder.rerank('attention mechanisms', mockCandidates, 5);

    expect(results.length).toBe(2);
    // Candidate 2 should be reordered to rank 1 despite lower originalScore
    expect(results[0].doc.id).toBe('candidate-2');
    expect(results[0].crossEncoderScore).toBe(0.98);
    expect(results[0].rank).toBe(1);

    expect(results[1].doc.id).toBe('candidate-1');
    expect(results[1].crossEncoderScore).toBe(0.12);
    expect(results[1].rank).toBe(2);
  });

  it('should respect topN limit', async () => {
    mockPipelineFunction.mockResolvedValue([{ label: 'LABEL_1', score: 0.5 }]);

    const results = await crossEncoder.rerank('test query', mockCandidates, 1);
    expect(results.length).toBe(1);
  });

  it('should handle candidate scoring exceptions gracefully without failing entire batch', async () => {
    mockPipelineFunction.mockImplementation((input: string) => {
      if (input.includes('gardening')) {
        throw new Error('Inference failure on corrupted text');
      }
      return Promise.resolve([{ label: 'LABEL_1', score: 0.88 }]);
    });

    const results = await crossEncoder.rerank('test query', mockCandidates, 5);

    expect(results.length).toBe(2);
    expect(results[0].doc.id).toBe('candidate-2');
    expect(results[0].crossEncoderScore).toBe(0.88);
    expect(results[1].doc.id).toBe('candidate-1');
    expect(results[1].crossEncoderScore).toBe(-999);
  });
});
