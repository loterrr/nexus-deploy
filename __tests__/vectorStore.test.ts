import { VectorStore } from '@/services/vectorStore';

// Mock dependencies
jest.mock('idb', () => ({
  openDB: jest.fn().mockResolvedValue({
    getAll: jest.fn().mockResolvedValue([]),
    put: jest.fn(),
    transaction: jest.fn(() => ({
      store: { put: jest.fn() },
      objectStore: jest.fn(() => ({ delete: jest.fn() })),
      done: Promise.resolve(),
    })),
    get: jest.fn(),
    delete: jest.fn(),
    clear: jest.fn(),
  }),
}));

jest.mock('@xenova/transformers', () => {
  const mockPipeline = jest.fn().mockResolvedValue(
    jest.fn().mockResolvedValue({
      data: new Float32Array(384).fill(0.1) // Mock embedding vector
    })
  );
  return {
    pipeline: mockPipeline,
    env: {
      allowLocalModels: false,
      allowRemoteModels: true,
      useBrowserCache: true
    }
  };
});

jest.mock('@/services/pdfParser', () => ({
  extractTextWithPages: jest.fn().mockResolvedValue([])
}));

describe('VectorStore', () => {
  let store: VectorStore;

  beforeEach(() => {
    // Reset singleton for testing
    // @ts-ignore - accessing private field for testing
    VectorStore.instance = undefined;
    store = VectorStore.getInstance();
  });

  describe('Initialization', () => {
    it('should initialize successfully on client', async () => {
      // Mock window
      global.window = {} as any;
      
      await store.init();
      // @ts-ignore
      expect(store.isReady).toBe(true);
      // @ts-ignore
      expect(store.embedder).toBeDefined();
      // @ts-ignore
      expect(store.db).toBeDefined();
    });
  });

  describe('Chunking Logic (Sentence-Aware)', () => {
    it('should split text into overlapping chunks based on sentences', () => {
      // Access private method for testing
      // @ts-ignore
      const chunkText = store.chunkText.bind(store);
      
      const text = "First sentence. Second sentence! Third sentence? Fourth sentence. Fifth sentence.";
      // Small chunk size to force splits
      const chunks = chunkText(text, 40, 20);
      
      expect(chunks.length).toBeGreaterThan(1);
      
      // Each chunk should have full sentences, not cut off mid-word
      for (const chunk of chunks) {
        expect(chunk).toMatch(/sentence[.!?[\]]*$/);
      }
      
      // Check overlap: chunk 2 should contain the end of chunk 1
      if (chunks.length > 1) {
        const lastSentenceOfFirstChunk = chunks[0].split(/(?<=[.!?])\s+/).pop();
        expect(chunks[1]).toContain(lastSentenceOfFirstChunk);
      }
    });

    it('should handle empty text', () => {
      // @ts-ignore
      const chunkText = store.chunkText.bind(store);
      expect(chunkText('', 100, 10)).toEqual([]);
      expect(chunkText('   ', 100, 10)).toEqual([]);
    });
  });

  describe('Document Management', () => {
    beforeEach(async () => {
      global.window = {} as any;
      await store.init();
    });

    it('should add documents and create embeddings', async () => {
      await store.addDocument('test.pdf', 'This is a test document.');
      
      const docs = store.getAllDocuments();
      expect(docs.length).toBe(1);
      expect(docs[0].metadata.source).toBe('test.pdf');
      expect(docs[0].embedding).toBeDefined();
      expect(docs[0].embedding?.length).toBe(384);
    });

    it('should track unique filenames', async () => {
      await store.addDocument('test1.pdf', 'Doc 1');
      await store.addDocument('test2.pdf', 'Doc 2');
      await store.addDocument('test1.pdf', 'Doc 1 part 2'); // duplicate name
      
      const names = store.getUniqueFilenames();
      expect(names).toEqual(['test1.pdf', 'test2.pdf']);
    });

    it('should remove documents by filename', async () => {
      await store.addDocument('keep.pdf', 'Keep this');
      await store.addDocument('remove.pdf', 'Remove this');
      
      expect(store.getAllDocuments().length).toBe(2);
      
      await store.removeDocument('remove.pdf');
      
      const docs = store.getAllDocuments();
      expect(docs.length).toBe(1);
      expect(docs[0].metadata.source).toBe('keep.pdf');
    });

    it('should calculate cosine similarity correctly via public method', () => {
      const v1 = [1, 0, 0];
      const v2 = [1, 0, 0];
      const v3 = [0, 1, 0];
      const v4 = [0.707, 0.707, 0];
      
      expect(store.computeCosineSimilarity(v1, v2)).toBeCloseTo(1.0);
      expect(store.computeCosineSimilarity(v1, v3)).toBe(0);
      expect(store.computeCosineSimilarity(v1, v4)).toBeCloseTo(0.707);
    });

    it('should generate embeddings via public embed method', async () => {
      const embedding = await store.embed('Test sentence for embedding');
      expect(embedding).toBeDefined();
      expect(embedding.length).toBe(384);
    });
  });
});
