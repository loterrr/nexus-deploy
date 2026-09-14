import { NeuralWorkerClient } from '@/services/neuralWorkerClient';

describe('NeuralWorkerClient', () => {
  it('should instantiate as a singleton', () => {
    const client1 = NeuralWorkerClient.getInstance();
    const client2 = NeuralWorkerClient.getInstance();
    expect(client1).toBe(client2);
  });

  it('should safely report availability in test environment without throwing', () => {
    const client = NeuralWorkerClient.getInstance();
    expect(typeof client.isAvailable()).toBe('boolean');
  });
});
