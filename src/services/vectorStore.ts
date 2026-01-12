// src/services/vectorStore.ts
import { v4 as uuidv4 } from 'uuid';
import { pipeline, env } from '@xenova/transformers';

// Skip local model checks since we are running in the browser
env.allowLocalModels = false;
env.useBrowserCache = true;

// --- Types ---
export interface DocumentChunk {
  id: string;
  content: string;
  metadata: {
    source: string;
    chunkIdx: number;
  };
}

export interface SearchResultItem {
  content: string;
  score: number;
  source: string;
}

// --- Configuration ---
const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2'; 

export class VectorStore {
  private static instance: VectorStore;
  private documents: DocumentChunk[] = [];
  private embedder: any = null;
  private isReady: boolean = false;

  private constructor() {}

  public static getInstance(): VectorStore {
    if (!VectorStore.instance) {
      VectorStore.instance = new VectorStore();
    }
    return VectorStore.instance;
  }

  async init() {
    if (this.isReady) return;

    try {
      console.log("Initializing VectorStore...");
      
      this.embedder = await pipeline('feature-extraction', EMBEDDING_MODEL, {
        quantized: true,
      });

      this.isReady = true;
      console.log("VectorStore initialized successfully.");
    } catch (error) {
      console.error("Failed to initialize VectorStore:", error);
      throw new Error(`VectorStore initialization failed`);
    }
  }

  async addDocument(filename: string, fullText: string) {
    try {
      if (!this.embedder) await this.init();

      // Chunking text
      const chunks = this.chunkText(fullText, 500, 50); 
      console.log(`Processing ${chunks.length} chunks for ${filename}...`);

      if (chunks.length === 0) throw new Error("PDF resulted in no text content");

      const newDocuments: DocumentChunk[] = [];

      for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          if (!chunk || chunk.trim().length === 0) continue;
          
          newDocuments.push({
            id: uuidv4(),
            content: chunk,
            metadata: { source: filename, chunkIdx: i }
          });
      }

      this.documents.push(...newDocuments);
      console.log(`Indexed ${filename} successfully (${newDocuments.length} chunks).`);
    } catch (error) {
      console.error(`Error adding document ${filename}:`, error);
      throw error;
    }
  }

  async search(query: string, limit: number = 3): Promise<SearchResultItem[]> {
    try {
      if (!this.embedder) await this.init();

      if (this.documents.length === 0) return [];

      console.log(`Searching ${this.documents.length} chunks for: "${query}"`);

      // 1. Embed Query
      const queryOutput = await this.embedder(query, { pooling: 'mean', normalize: true });
      const queryVector = Array.from(queryOutput.data as Float32Array);

      // 2. Embed & Score Documents
      const results: Array<{ doc: DocumentChunk; score: number }> = [];

      for (const doc of this.documents) {
          // Note: In a real production app, we would cache these document embeddings 
          // instead of regenerating them on every search. For this demo, this is fine.
          const docOutput = await this.embedder(doc.content, { pooling: 'mean', normalize: true });
          const docVector = Array.from(docOutput.data as Float32Array);

          const similarity = this.cosineSimilarity(queryVector, docVector);
          results.push({ doc, score: similarity });
      }

      // 3. Sort by Score
      results.sort((a, b) => b.score - a.score);

      // --- CRITICAL FIX: LOG SCORES AND REMOVE STRICT THRESHOLD ---
      if (results.length > 0) {
          console.log(`Top Match Score: ${results[0].score.toFixed(4)}`);
          console.log(`Worst Match Score: ${results[results.length-1].score.toFixed(4)}`);
      }

      // Return the top 3 results REGARDLESS of score (Fallback mechanism)
      const topResults = results.slice(0, limit).map(r => ({
        content: r.doc.content,
        score: r.score,
        source: r.doc.metadata.source
      }));

      console.log(`Returning ${topResults.length} chunks to Chatbot.`);
      return topResults;

    } catch (error) {
      console.error("Search error:", error);
      return [];
    }
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return (normA === 0 || normB === 0) ? 0 : dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private chunkText(text: string, chunkSize: number, overlap: number): string[] {
    const chunks: string[] = [];
    let start = 0;
    while (start < text.length) {
      const end = start + chunkSize;
      let chunk = text.slice(start, end);
      // Try to break at a space
      const lastSpace = chunk.lastIndexOf(' ');
      if (lastSpace > chunkSize * 0.8) {
          chunk = chunk.slice(0, lastSpace);
          start += lastSpace + 1 - overlap;
      } else {
          start += chunkSize - overlap;
      }
      chunks.push(chunk.trim());
    }
    return chunks.filter(c => c.length > 0);
  }
}