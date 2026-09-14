import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { VectorStore } from './vectorStore';
import { v4 as uuidv4 } from 'uuid';

interface QueryCacheEntry {
  id: string;
  query: string;
  embedding: number[];
  response: string;
  timestamp: number;
}

interface QueryCacheDB extends DBSchema {
  'query-cache': {
    key: string;
    value: QueryCacheEntry;
    indexes: { 'by-timestamp': number };
  };
}

const DB_NAME = 'the-archive-query-cache-db';
const DB_VERSION = 1;
const STORE_NAME = 'query-cache';
const SIMILARITY_THRESHOLD = 0.91;

export class QueryCacheService {
  private static instance: QueryCacheService;
  private db: IDBPDatabase<QueryCacheDB> | null = null;
  private isReady = false;

  private constructor() {}

  static getInstance(): QueryCacheService {
    if (!QueryCacheService.instance) {
      QueryCacheService.instance = new QueryCacheService();
    }
    return QueryCacheService.instance;
  }

  async init() {
    if (this.isReady) return;
    if (typeof window === 'undefined') return;

    try {
      this.db = await openDB<QueryCacheDB>(DB_NAME, DB_VERSION, {
        upgrade(db) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('by-timestamp', 'timestamp');
        },
      });
      this.isReady = true;
    } catch (err) {
      console.error('Failed to init QueryCache DB', err);
    }
  }

  /**
   * Searches the cache for a semantically similar query.
   * Returns the cached response if similarity > SIMILARITY_THRESHOLD.
   */
  async findCachedResponse(query: string): Promise<string | null> {
    if (!this.db) await this.init();
    if (!this.db) return null;

    try {
      // 1. Generate embedding for the new query
      const store = VectorStore.getInstance();
      const queryEmbedding = await store.embed(query);

      // 2. Fetch all cached queries
      const cachedEntries = await this.db.getAll(STORE_NAME);

      // 3. Find the most similar cached query
      let bestMatch: QueryCacheEntry | null = null;
      let highestSimilarity = -1;

      for (const entry of cachedEntries) {
        const sim = store.computeCosineSimilarity(queryEmbedding, entry.embedding);
        if (sim > highestSimilarity) {
          highestSimilarity = sim;
          bestMatch = entry;
        }
      }

      if (highestSimilarity >= SIMILARITY_THRESHOLD && bestMatch) {
        // Auto-purge any corrupted or multi-turn hallucinated responses
        if (
          bestMatch.response.includes('User Query:') ||
          bestMatch.response.includes('**User Query:**') ||
          bestMatch.response.includes('\nUser:')
        ) {
          console.log(`[QueryCache] Purging corrupted cache entry ${bestMatch.id}`);
          await this.db.delete(STORE_NAME, bestMatch.id);
          return null;
        }

        console.log(`[QueryCache] Cache HIT (Similarity: ${highestSimilarity.toFixed(3)})`);
        return bestMatch.response;
      }

      console.log(`[QueryCache] Cache MISS (Highest Similarity: ${highestSimilarity.toFixed(3)})`);
      return null;
    } catch (error) {
      console.error('[QueryCache] Search failed:', error);
      return null;
    }
  }

  /**
   * Saves a new query and its generated response to the cache.
   */
  async saveResponse(query: string, response: string): Promise<void> {
    if (!this.db) await this.init();
    if (!this.db) return;

    // Never cache empty, failed, or hallucinated runaway outputs
    if (!response || response.includes('User Query:') || response.includes('**User Query:**')) {
      return;
    }

    try {
      const store = VectorStore.getInstance();
      const embedding = await store.embed(query);

      const entry: QueryCacheEntry = {
        id: uuidv4(),
        query,
        embedding,
        response,
        timestamp: Date.now()
      };

      await this.db.put(STORE_NAME, entry);
      console.log(`[QueryCache] Saved response for query: "${query.substring(0, 30)}..."`);
    } catch (error) {
      console.error('[QueryCache] Save failed:', error);
    }
  }

  async clearCache(): Promise<void> {
    if (!this.db) await this.init();
    if (!this.db) return;
    await this.db.clear(STORE_NAME);
  }
}
