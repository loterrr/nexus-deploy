import { QueryCacheService } from '@/services/queryCache';
import { VectorStore } from '@/services/vectorStore';

// Mock IndexedDB
const mockDb = {
  getAll: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  clear: jest.fn(),
};

jest.mock('idb', () => ({
  openDB: jest.fn(() => Promise.resolve(mockDb)),
}));

const mockVectorStoreInstance = {
  embed: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
  computeCosineSimilarity: jest.fn(),
};

// Mock VectorStore
jest.mock('@/services/vectorStore', () => {
  return {
    VectorStore: {
      getInstance: jest.fn(() => mockVectorStoreInstance),
    },
  };
});

describe('QueryCacheService', () => {
  let cacheService: QueryCacheService;
  let mockVectorStore: any;

  beforeEach(() => {
    jest.clearAllMocks();
    global.window = {} as any;
    // @ts-ignore
    QueryCacheService.instance = undefined;
    cacheService = QueryCacheService.getInstance();
    mockVectorStore = VectorStore.getInstance();
  });

  it('should implement the singleton pattern', () => {
    const instance1 = QueryCacheService.getInstance();
    const instance2 = QueryCacheService.getInstance();
    expect(instance1).toBe(instance2);
  });

  it('should save clean responses to cache', async () => {
    await cacheService.saveResponse('What is RAG?', 'RAG combines retrieval and generation.');

    expect(mockDb.put).toHaveBeenCalledWith(
      'query-cache',
      expect.objectContaining({
        query: 'What is RAG?',
        response: 'RAG combines retrieval and generation.',
        embedding: [0.1, 0.2, 0.3],
      })
    );
  });

  it('should refuse to cache corrupted or runaway responses', async () => {
    await cacheService.saveResponse('Test', 'Some response User Query: runaway loop');
    expect(mockDb.put).not.toHaveBeenCalled();

    await cacheService.saveResponse('Test', '');
    expect(mockDb.put).not.toHaveBeenCalled();
  });

  it('should return cached response on high semantic similarity (>= 0.91)', async () => {
    mockDb.getAll.mockResolvedValue([
      {
        id: 'entry-1',
        query: 'Explain quantum supremacy',
        response: 'Quantum supremacy is the demonstration of quantum advantages.',
        embedding: [0.1, 0.2, 0.3],
        timestamp: 1000,
      },
    ]);

    mockVectorStore.computeCosineSimilarity.mockReturnValue(0.95);

    const response = await cacheService.findCachedResponse('What is quantum supremacy?');
    expect(response).toBe('Quantum supremacy is the demonstration of quantum advantages.');
  });

  it('should return null on cache miss (similarity < 0.91)', async () => {
    mockDb.getAll.mockResolvedValue([
      {
        id: 'entry-1',
        query: 'Explain quantum computing',
        response: 'Quantum computing details...',
        embedding: [0.1, 0.2, 0.3],
        timestamp: 1000,
      },
    ]);

    mockVectorStore.computeCosineSimilarity.mockReturnValue(0.75);

    const response = await cacheService.findCachedResponse('How to bake sourdough?');
    expect(response).toBeNull();
  });

  it('should purge corrupted entries found in cache and return null', async () => {
    mockDb.getAll.mockResolvedValue([
      {
        id: 'corrupted-entry',
        query: 'Corrupted question',
        response: 'Response containing User Query: corrupted loop',
        embedding: [0.1, 0.2, 0.3],
        timestamp: 1000,
      },
    ]);

    mockVectorStore.computeCosineSimilarity.mockReturnValue(0.98);

    const response = await cacheService.findCachedResponse('Corrupted question');
    expect(response).toBeNull();
    expect(mockDb.delete).toHaveBeenCalledWith('query-cache', 'corrupted-entry');
  });

  it('should clear the cache store', async () => {
    await cacheService.clearCache();
    expect(mockDb.clear).toHaveBeenCalledWith('query-cache');
  });
});
