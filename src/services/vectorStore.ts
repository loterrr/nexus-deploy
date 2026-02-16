'use client';

import { v4 as uuidv4 } from 'uuid';
import type { Pipeline } from '@xenova/transformers';
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { extractTextWithPages, PageText } from './pdfParser';

interface VectorStoreDB extends DBSchema {
  'vector-store': {
    key: string;
    value: DocumentChunk;
    indexes: { 'by-source': string };
  };
}

const DB_NAME = 'the-archive-rag-db';
const DB_VERSION = 1;
const STORE_NAME = 'vector-store';


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

    env.allowLocalModels = false;
    env.allowRemoteModels = true;
    env.useBrowserCache = true;

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

const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';
const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;

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
        upgrade(db) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('by-source', 'metadata.source');
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

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const output = await this.embedder(chunk, { pooling: 'mean', normalize: true });
        const embedding = Array.from(output.data as Float32Array);


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

      this.documents.push(...newDocuments);
      console.log(`Added ${chunks.length} chunks from ${filename}`);
    } catch (error) {
      console.error("Error adding document:", error);
      throw error;
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
    }

    const removed = beforeCount - this.documents.length;
    console.log(`Removed ${removed} chunks from ${filename}`);
  }

  async clearStore(): Promise<void> {
    this.documents = [];
    if (this.db) {
      await this.db.clear(STORE_NAME);
    }
    console.log("VectorStore cleared.");
  }

  async search(query: string, limit: number = 3): Promise<SearchResultItem[]> {
    try {
      if (!this.embedder) await this.init();

      if (!this.embedder) {
        throw new Error('Embedder not initialized');
      }

      const output = await this.embedder(query, { pooling: 'mean', normalize: true });
      const queryVector = Array.from(output.data as Float32Array);

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

  private chunkText(text: string, chunkSize: number, overlap: number): string[] {
    if (!text || text.trim().length === 0) return [];

    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      chunks.push(text.slice(start, end));
      start += chunkSize - overlap;
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
}
