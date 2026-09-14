import { ResearchCoordinator } from '@/services/researchCoordinator';
import { QueryCacheService } from '@/services/queryCache';
import { RetrievalPipeline } from '@/services/retrievalPipeline';
import { FileCreationService } from '@/services/fileCreationService';

// Mock pdfParser to prevent pdfjs-dist ESM syntax issues in Jest
jest.mock('@/services/pdfParser', () => ({
  extractTextWithPages: jest.fn().mockResolvedValue([]),
}));

// Mock QueryCacheService
jest.mock('@/services/queryCache', () => {
  const mockFindCachedResponse = jest.fn();
  const mockSaveResponse = jest.fn().mockResolvedValue(undefined);
  const mockClearCache = jest.fn().mockResolvedValue(undefined);

  return {
    QueryCacheService: {
      getInstance: jest.fn(() => ({
        findCachedResponse: mockFindCachedResponse,
        saveResponse: mockSaveResponse,
        clearCache: mockClearCache,
      })),
    },
  };
});

// Mock RetrievalPipeline
jest.mock('@/services/retrievalPipeline', () => {
  const mockRetrieve = jest.fn();
  const mockSetMode = jest.fn();
  const mockOnDocumentsChanged = jest.fn();

  return {
    RetrievalPipeline: {
      getInstance: jest.fn(() => ({
        retrieve: mockRetrieve,
        setMode: mockSetMode,
        onDocumentsChanged: mockOnDocumentsChanged,
      })),
    },
  };
});

describe('ResearchCoordinator Module', () => {
  let coordinator: ResearchCoordinator;
  let queryCacheMock: any;
  let pipelineMock: any;

  beforeEach(() => {
    jest.clearAllMocks();
    coordinator = ResearchCoordinator.getInstance();
    queryCacheMock = QueryCacheService.getInstance();
    pipelineMock = RetrievalPipeline.getInstance();
  });

  describe('Semantic Cache Interception', () => {
    it('returns cached response immediately on cache hit without invoking retrieval or streamer', async () => {
      queryCacheMock.findCachedResponse.mockResolvedValue('Cached answer about attention mechanisms.');

      const streamChatFn = jest.fn();
      const outcome = await coordinator.ask({
        query: 'What is attention?',
        streamChatFn,
      });

      expect(outcome.isCachedHit).toBe(true);
      expect(outcome.answer).toBe('Cached answer about attention mechanisms.');
      expect(pipelineMock.retrieve).not.toHaveBeenCalled();
      expect(streamChatFn).not.toHaveBeenCalled();
    });

    it('triggers file creation on cache hit if intent is detected', async () => {
      queryCacheMock.findCachedResponse.mockResolvedValue('# Summary\n\nAttention mechanisms.');
      const handleFileCreationSpy = jest
        .spyOn(FileCreationService, 'handleFileCreation')
        .mockResolvedValue({ success: true, filename: 'summary.md' });

      const outcome = await coordinator.ask({
        query: 'Create a file summarizing attention mechanisms',
      });

      expect(outcome.isCachedHit).toBe(true);
      expect(handleFileCreationSpy).toHaveBeenCalledWith(
        'Create a file summarizing attention mechanisms',
        '# Summary\n\nAttention mechanisms.'
      );
      expect(outcome.fileCreationResult?.success).toBe(true);
      expect(outcome.fileCreationResult?.filename).toBe('summary.md');

      handleFileCreationSpy.mockRestore();
    });
  });

  describe('Hybrid Retrieval & Generative Synthesis', () => {
    it('executes retrieval and invokes streamer with prompt-ready context on cache miss', async () => {
      queryCacheMock.findCachedResponse.mockResolvedValue(null);

      const mockGroundedContext = {
        formattedContext: '[Source: paper1.pdf, Page 3]\nAttention is all you need.',
        citations: [{ source: 'paper1.pdf', pageNumber: 3, snippet: 'Attention is all you need.' }],
        candidateCount: 1,
      };

      pipelineMock.retrieve.mockResolvedValue({
        results: [{ doc: { id: 'chunk-1', content: 'Attention is all you need.', metadata: { source: 'paper1.pdf', pageNumber: 3, chunkIdx: 0 } }, score: 0.95 }],
        groundedContext: mockGroundedContext,
        mode: 'enhanced',
        timing: { totalMs: 42, fusionMs: 20, rerankMs: 22 },
        stages: [],
      });

      const streamChatFn = jest.fn().mockResolvedValue('Attention maps queries and keys to values.');

      const outcome = await coordinator.ask({
        query: 'How does attention work?',
        pipelineMode: 'enhanced',
        streamChatFn,
      });

      expect(pipelineMock.setMode).toHaveBeenCalledWith('enhanced');
      expect(pipelineMock.retrieve).toHaveBeenCalledWith('How does attention work?');
      expect(streamChatFn).toHaveBeenCalledWith('How does attention work?', mockGroundedContext.formattedContext);

      expect(outcome.isCachedHit).toBe(false);
      expect(outcome.answer).toBe('Attention maps queries and keys to values.');
      expect(outcome.groundedContext.candidateCount).toBe(1);
      expect(outcome.timing.retrievalMs).toBeGreaterThanOrEqual(0);

      // Verify answer is saved to semantic cache
      expect(queryCacheMock.saveResponse).toHaveBeenCalledWith(
        'How does attention work?',
        'Attention maps queries and keys to values.'
      );
    });

    it('does not save to cache if response contains User Query template text or context is empty', async () => {
      queryCacheMock.findCachedResponse.mockResolvedValue(null);

      pipelineMock.retrieve.mockResolvedValue({
        results: [],
        groundedContext: { formattedContext: '', citations: [], candidateCount: 0 },
        mode: 'baseline',
        timing: { totalMs: 10, fusionMs: 10, rerankMs: 0 },
        stages: [],
      });

      const streamChatFn = jest.fn().mockResolvedValue('General response without context.');

      const outcome = await coordinator.ask({
        query: 'Hello there',
        streamChatFn,
      });

      expect(outcome.answer).toBe('General response without context.');
      expect(queryCacheMock.saveResponse).not.toHaveBeenCalled();
    });
  });

  describe('Session Lifecycle & Invalidation', () => {
    it('clears query cache on clearSession()', async () => {
      await coordinator.clearSession();
      expect(queryCacheMock.clearCache).toHaveBeenCalledTimes(1);
    });

    it('delegates document invalidation to retrieval pipeline on onDocumentsChanged()', () => {
      coordinator.onDocumentsChanged();
      expect(pipelineMock.onDocumentsChanged).toHaveBeenCalledTimes(1);
    });

    it('sets and gets pipeline mode', () => {
      coordinator.setPipelineMode('enhanced');
      expect(coordinator.getPipelineMode()).toBe('enhanced');
      expect(pipelineMock.setMode).toHaveBeenCalledWith('enhanced');

      coordinator.setPipelineMode('baseline');
      expect(coordinator.getPipelineMode()).toBe('baseline');
      expect(pipelineMock.setMode).toHaveBeenCalledWith('baseline');
    });
  });
});
