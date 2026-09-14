/**
 * Neural Worker Client Bridge
 * Manages communication between main thread and neural.worker.ts with Promise request/response mapping.
 */

interface WorkerResponse {
  id: string;
  success: boolean;
  data?: any;
  error?: string;
}

export class NeuralWorkerClient {
  private static instance: NeuralWorkerClient;
  private worker: Worker | null = null;
  private pendingRequests = new Map<string, { resolve: (data: any) => void; reject: (err: Error) => void }>();
  private isSupported: boolean;

  private constructor() {
    this.isSupported = typeof window !== 'undefined' && typeof Worker !== 'undefined';
  }

  static getInstance(): NeuralWorkerClient {
    if (!NeuralWorkerClient.instance) {
      NeuralWorkerClient.instance = new NeuralWorkerClient();
    }
    return NeuralWorkerClient.instance;
  }

  isAvailable(): boolean {
    return this.isSupported;
  }

  private getWorker(): Worker {
    if (!this.isSupported) {
      throw new Error('Web Workers are not supported in this environment');
    }

    if (!this.worker) {
      this.worker = new Worker(new URL('../workers/neural.worker.ts', import.meta.url));
      this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const { id, success, data, error } = event.data;
        const pending = this.pendingRequests.get(id);
        if (pending) {
          this.pendingRequests.delete(id);
          if (success) {
            pending.resolve(data);
          } else {
            pending.reject(new Error(error || 'Worker execution failed'));
          }
        }
      };

      this.worker.onerror = (errorEvent) => {
        console.error('[NeuralWorker] Worker error event:', errorEvent);
        const err = new Error(`Neural Web Worker error: ${(errorEvent as any).message || 'Unknown worker error'}`);
        for (const handler of Array.from(this.pendingRequests.values())) {
          handler.reject(err);
        }
        this.pendingRequests.clear();
      };
    }

    return this.worker;
  }

  private sendRequest<T>(type: string, payload?: any, timeoutMs: number = 30000): Promise<T> {
    const worker = this.getWorker();
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`[NeuralWorker] Request ${type} timed out after ${timeoutMs / 1000}s`));
        }
      }, timeoutMs);

      this.pendingRequests.set(id, {
        resolve: (data: any) => {
          clearTimeout(timer);
          resolve(data);
        },
        reject: (err: Error) => {
          clearTimeout(timer);
          reject(err);
        },
      });

      worker.postMessage({ id, type, payload });
    });
  }

  async embed(text: string): Promise<number[]> {
    return this.sendRequest<number[]>('EMBED', { text });
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return this.sendRequest<number[][]>('EMBED_BATCH', { texts });
  }

  async rerank(
    query: string,
    candidates: { id: string; content: string; originalScore: number }[],
    topN: number = 5
  ): Promise<{ id: string; crossEncoderScore: number; originalScore: number; rank: number }[]> {
    return this.sendRequest('RERANK', { query, candidates, topN });
  }
}
