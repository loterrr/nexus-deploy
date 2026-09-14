'use client';

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { EvalRunResult } from '@/types/evaluation';

interface EvalStoreDB extends DBSchema {
  'eval-runs': {
    key: string;
    value: EvalRunResult;
    indexes: { 'by-timestamp': number };
  };
}

const DB_NAME = 'the-archive-eval-db';
const DB_VERSION = 1;
const STORE_NAME = 'eval-runs';

export class EvalStore {
  private static instance: EvalStore;
  private db: IDBPDatabase<EvalStoreDB> | null = null;
  private isReady = false;

  private constructor() {}

  static getInstance(): EvalStore {
    if (!EvalStore.instance) {
      EvalStore.instance = new EvalStore();
    }
    return EvalStore.instance;
  }

  async init() {
    if (this.isReady) return;
    
    if (typeof window === 'undefined') {
      return; // Only run on client
    }

    try {
      this.db = await openDB<EvalStoreDB>(DB_NAME, DB_VERSION, {
        upgrade(db) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('by-timestamp', 'timestamp');
        },
      });
      this.isReady = true;
    } catch (err) {
      console.error('Failed to init EvalStore DB', err);
    }
  }

  async saveRun(result: EvalRunResult): Promise<void> {
    if (!this.db) await this.init();
    if (!this.db) return;
    
    await this.db.put(STORE_NAME, result);
  }

  async getRuns(): Promise<EvalRunResult[]> {
    if (!this.db) await this.init();
    if (!this.db) return [];
    
    const tx = this.db.transaction(STORE_NAME, 'readonly');
    const index = tx.store.index('by-timestamp');
    
    // Get all runs, sorted by timestamp ascending
    let cursor = await index.openCursor();
    const runs: EvalRunResult[] = [];
    
    while (cursor) {
      runs.push(cursor.value);
      cursor = await cursor.continue();
    }
    
    // Return descending (newest first)
    return runs.reverse();
  }

  async getRun(id: string): Promise<EvalRunResult | undefined> {
    if (!this.db) await this.init();
    if (!this.db) return undefined;
    
    return await this.db.get(STORE_NAME, id);
  }

  async deleteRun(id: string): Promise<void> {
    if (!this.db) await this.init();
    if (!this.db) return;
    
    await this.db.delete(STORE_NAME, id);
  }
}
