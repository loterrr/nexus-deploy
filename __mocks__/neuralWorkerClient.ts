/**
 * Jest Mock for NeuralWorkerClient
 * Signals that Web Workers are unavailable, allowing test suites to test in-thread fallbacks.
 */

export class NeuralWorkerClient {
  private static instance: NeuralWorkerClient;

  static getInstance(): NeuralWorkerClient {
    if (!NeuralWorkerClient.instance) {
      NeuralWorkerClient.instance = new NeuralWorkerClient();
    }
    return NeuralWorkerClient.instance;
  }

  isAvailable(): boolean {
    return false;
  }

  async embed(): Promise<number[]> {
    throw new Error('Worker not available in mock');
  }

  async embedBatch(): Promise<number[][]> {
    throw new Error('Worker not available in mock');
  }

  async rerank(): Promise<any[]> {
    throw new Error('Worker not available in mock');
  }
}
