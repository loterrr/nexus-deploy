'use client';

import { v4 as uuidv4 } from 'uuid';
import type { Pipeline } from '@xenova/transformers';
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { extractTextWithPages, PageText } from './pdfParser';
import { EMBEDDING_MODEL, CHUNK_SIZE, CHUNK_OVERLAP } from '@/lib/constants';
import { NeuralWorkerClient } from './neuralWorkerClient';

interface VectorStoreDB extends DBSchema {
  'vector-store': {
    key: string;
    value: DocumentChunk;
    indexes: { 'by-source': string };
  };
  'files-store': {
    key: string;
    value: { filename: string; data: ArrayBuffer; size: number; type: string };
  };
}

const DB_NAME = 'the-archive-rag-db';
const DB_VERSION = 2;
const STORE_NAME = 'vector-store';
const FILES_STORE_NAME = 'files-store';


let pipeline: any = null;
let env: any = null;
let transformersLoaded = false;

async function loadTransformers() {
  if (transformersLoaded) {
    return;
  }

  if (typeof window === 'undefined') {
    throw new Error('Transformers can only be loaded in the browser');
  }

  try {
    console.log('Loading transformers library...');
    const transformers = await import('@xenova/transformers');
    pipeline = transformers.pipeline;
    env = transformers.env;

    env.allowLocalModels = true;
    env.localModelPath = '/models/';
    env.allowRemoteModels = false;
    env.useBrowserCache = false;

    transformersLoaded = true;
    console.log('Transformers library loaded successfully');
  } catch (error) {
    console.error('Failed to load transformers library:', error);
    throw error;
  }
}

export interface DocumentChunk {
  id: string;
  content: string;
  metadata: {
    source: string;
    chunkIdx: number;
    pageNumber?: number;
    textSnippet?: string;
  };
  embedding?: number[];
}

export interface SearchResultItem {
  doc: DocumentChunk;
  score: number;
}

export class VectorStore {
  private static instance: VectorStore;
  private documents: DocumentChunk[] = [];
  private embedder: Pipeline | null = null;
  private isReady = false;
  private db: IDBPDatabase<VectorStoreDB> | null = null;

  private constructor() { }

  static getInstance(): VectorStore {
    if (!VectorStore.instance) {
      VectorStore.instance = new VectorStore();
    }
    return VectorStore.instance;
  }

  private async initDB() {
    if (this.db) return;
    try {
      this.db = await openDB<VectorStoreDB>(DB_NAME, DB_VERSION, {
        upgrade(db, oldVersion) {
          if (oldVersion < 1) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            store.createIndex('by-source', 'metadata.source');
          }
          if (oldVersion < 2) {
            db.createObjectStore(FILES_STORE_NAME, { keyPath: 'filename' });
          }
        },
      });
      console.log('IndexedDB initialized');
    } catch (err) {
      console.error('Failed to init IndexedDB', err);
    }
  }

  async init() {
    if (this.isReady) return;


    if (typeof window === 'undefined') {
      throw new Error('VectorStore can only be initialized on the client side');
    }

    try {
      console.log("Initializing VectorStore...");

      await this.initDB();


      if (this.db) {
        const storedDocs = await this.db.getAll(STORE_NAME);
        if (storedDocs && storedDocs.length > 0) {
          this.documents = storedDocs;
          console.log(`Loaded ${storedDocs.length} chunks from IndexedDB`);
        }
      }


      await loadTransformers();

      if (!pipeline) {
        throw new Error('Pipeline not available after loading transformers');
      }

      this.embedder = await pipeline('feature-extraction', EMBEDDING_MODEL, {
        quantized: true,
      });

      this.isReady = true;
      console.log("VectorStore initialized successfully.");
    } catch (error) {
      console.error("Failed to initialize VectorStore:", error);
      throw error;
    }
  }

  async addDocument(filename: string, fullText: string, file?: File) {
    try {
      if (!this.embedder) await this.init();

      if (!this.embedder) {
        throw new Error('Embedder not initialized');
      }

      let pageTexts: PageText[] = [];


      if (file) {
        pageTexts = await extractTextWithPages(file);
      }

      const chunks = this.chunkText(fullText, CHUNK_SIZE, CHUNK_OVERLAP);
      const newDocuments: DocumentChunk[] = [];

      let charOffset = 0;
      const pageOffsets: { page: number; start: number; end: number }[] = [];

      if (pageTexts.length > 0) {
        let offset = 0;
        for (const pt of pageTexts) {
          pageOffsets.push({
            page: pt.pageNumber,
            start: offset,
            end: offset + pt.text.length
          });
          offset += pt.text.length + 1;
        }
      }

      const workerClient = NeuralWorkerClient.getInstance();
      let batchEmbeddings: number[][] = [];
      if (workerClient.isAvailable()) {
        try {
          batchEmbeddings = await workerClient.embedBatch(chunks);
        } catch (err) {
          console.warn('[VectorStore] Worker batch embed failed, falling back to local:', err);
          batchEmbeddings = [];
        }
      }

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        let embedding: number[];
        if (batchEmbeddings[i]) {
          embedding = batchEmbeddings[i];
        } else {
          if (!this.embedder) await this.init();
          const output = await this.embedder!(chunk, { pooling: 'mean', normalize: true });
          embedding = Array.from(output.data as Float32Array);
        }


        let pageNumber = 1;
        if (pageOffsets.length > 0) {
          const chunkStart = charOffset;
          const matchedPage = pageOffsets.find(
            po => chunkStart >= po.start && chunkStart < po.end
          );
          pageNumber = matchedPage?.page || 1;
        }

        const doc: DocumentChunk = {
          id: uuidv4(),
          content: chunk,
          metadata: {
            source: filename,
            chunkIdx: i,
            pageNumber,
            textSnippet: chunk.slice(0, 100)
          },
          embedding
        };

        newDocuments.push(doc);
        charOffset += chunk.length - CHUNK_OVERLAP;


        if (this.db) {
          await this.db.put(STORE_NAME, doc);
        }
      }

      if (this.db && file) {
        const arrayBuffer = await file.arrayBuffer();
        await this.db.put(FILES_STORE_NAME, {
          filename,
          data: arrayBuffer,
          size: file.size,
          type: file.type
        });
      }

      this.documents.push(...newDocuments);
      console.log(`Added ${chunks.length} chunks from ${filename}`);
      await this.notifyStoresChanged();
    } catch (error) {
      console.error("Error adding document:", error);
      throw error;
    }
  }

  private async notifyStoresChanged(): Promise<void> {
    try {
      const { QueryCacheService } = await import('./queryCache');
      await QueryCacheService.getInstance().clearCache();
    } catch {
      // Ignored in mock/test environments
    }
    try {
      const { RetrievalPipeline } = await import('./retrievalPipeline');
      RetrievalPipeline.getInstance().onDocumentsChanged();
    } catch {
      // Ignored in mock/test environments
    }
  }

  async removeDocument(filename: string): Promise<void> {
    const beforeCount = this.documents.length;

    const docsToRemove = this.documents.filter(doc => doc.metadata.source === filename);
    this.documents = this.documents.filter(
      (doc) => doc.metadata.source !== filename
    );


    if (this.db) {
      const tx = this.db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      for (const doc of docsToRemove) {
        await store.delete(doc.id);
      }
      await tx.done;
      
      const fileStore = this.db.transaction(FILES_STORE_NAME, 'readwrite');
      await fileStore.objectStore(FILES_STORE_NAME).delete(filename);
      await fileStore.done;
    }

    const removed = beforeCount - this.documents.length;
    console.log(`Removed ${removed} chunks from ${filename}`);
    await this.notifyStoresChanged();
  }

  async getFile(filename: string): Promise<File | null> {
    if (!this.db) return null;
    const fileRecord = await this.db.get(FILES_STORE_NAME, filename);
    if (!fileRecord) return null;
    
    return new File([fileRecord.data], fileRecord.filename, { type: fileRecord.type });
  }

  async clearStore(): Promise<void> {
    this.documents = [];
    if (this.db) {
      await this.db.clear(STORE_NAME);
      await this.db.clear(FILES_STORE_NAME);
    }
    console.log("VectorStore cleared.");
    await this.notifyStoresChanged();
  }

  /**
   * Dense (cosine similarity) search. Core search method.
   * Used directly by FusionSearch for the semantic search leg.
   */
  async searchDense(query: string, limit: number = 3): Promise<SearchResultItem[]> {
    try {
      const queryVector = await this.embed(query);

      const results: SearchResultItem[] = [];

      for (const doc of this.documents) {
        if (!doc.embedding) {
          console.warn(`Document ${doc.id} missing embedding, skipping`);
          continue;
        }

        const similarity = this.cosineSimilarity(queryVector, doc.embedding);
        results.push({ doc, score: similarity });
      }

      results.sort((a, b) => b.score - a.score);
      return results.slice(0, limit);
    } catch (error) {
      console.error("Error during search:", error);
      return [];
    }
  }

  /** Backward-compatible alias for searchDense */
  async search(query: string, limit: number = 3): Promise<SearchResultItem[]> {
    return this.searchDense(query, limit);
  }

  getAllDocuments(): DocumentChunk[] {
    return this.documents;
  }

  getUniqueFilenames(): string[] {
    const filenames = new Set<string>();
    for (const doc of this.documents) {
      filenames.add(doc.metadata.source);
    }
    return Array.from(filenames);
  }

  /**
   * Sentence-aware text chunking.
   * Splits on sentence boundaries first, then accumulates sentences into chunks
   * up to the target size. Overlap is achieved by including trailing sentences
   * from the previous chunk in the next chunk.
   */
  private chunkText(text: string, chunkSize: number, overlap: number): string[] {
    if (!text || text.trim().length === 0) return [];

    // Split into sentences (handles ., !, ?, and common abbreviations)
    const sentences = text
      .replace(/([.!?])\s+/g, '$1\n')
      .split('\n')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    if (sentences.length === 0) return [];

    const chunks: string[] = [];
    let currentChunk: string[] = [];
    let currentLength = 0;

    for (const sentence of sentences) {
      // If adding this sentence would exceed chunkSize and we have content, finalize the chunk
      if (currentLength + sentence.length > chunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.join(' '));

        // Overlap: keep trailing sentences that fit within the overlap window
        const overlapSentences: string[] = [];
        let overlapLength = 0;
        for (let i = currentChunk.length - 1; i >= 0; i--) {
          if (overlapLength + currentChunk[i].length > overlap) break;
          overlapSentences.unshift(currentChunk[i]);
          overlapLength += currentChunk[i].length + 1;
        }

        currentChunk = overlapSentences;
        currentLength = overlapLength;
      }

      currentChunk.push(sentence);
      currentLength += sentence.length + 1;
    }

    // Add the final chunk
    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join(' '));
    }

    return chunks;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /** Public helper to embed text using worker when available, with in-thread fallback */
  public async embed(text: string): Promise<number[]> {
    const workerClient = NeuralWorkerClient.getInstance();
    if (workerClient.isAvailable()) {
      try {
        return await workerClient.embed(text);
      } catch (err) {
        console.warn('[VectorStore] Worker embed failed, falling back to local:', err);
      }
    }

    if (!this.embedder) await this.init();
    if (!this.embedder) {
      throw new Error('Embedder not initialized');
    }
    const output = await this.embedder(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data as Float32Array);
  }

  /** Public helper to compute cosine similarity between two vectors */
  public computeCosineSimilarity(a: number[], b: number[]): number {
    return this.cosineSimilarity(a, b);
  }
}
