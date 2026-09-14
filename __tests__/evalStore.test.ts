import { EvalStore } from '@/services/evalStore';
import type { EvalRunResult } from '@/types/evaluation';

// Mock IndexedDB
const mockRuns: Record<string, EvalRunResult> = {};

const mockIndex = {
  openCursor: jest.fn(),
};

const mockTransaction = {
  store: {
    index: jest.fn(() => mockIndex),
  },
};

const mockDb = {
  put: jest.fn((_store: string, val: EvalRunResult) => {
    mockRuns[val.id] = val;
    return Promise.resolve();
  }),
  get: jest.fn((_store: string, id: string) => Promise.resolve(mockRuns[id])),
  delete: jest.fn((_store: string, id: string) => {
    delete mockRuns[id];
    return Promise.resolve();
  }),
  transaction: jest.fn(() => mockTransaction),
};

jest.mock('idb', () => ({
  openDB: jest.fn(() => Promise.resolve(mockDb)),
}));

describe('EvalStore', () => {
  let store: EvalStore;

  const mockRun: EvalRunResult = {
    id: 'run-1',
    timestamp: 1700000000000,
    status: 'completed',
    config: {
      k: 5,
      runGeneration: false,
      datasetId: 'dataset-1',
      pipelineMode: 'enhanced',
    },
    dataset: {
      id: 'dataset-1',
      name: 'Test Dataset',
      description: 'Test',
      queries: [],
      createdAt: 1700000000000,
    },
    retrieval: null,
    generation: null,
    efficiency: null,
    progress: 100,
    currentStep: 'Done',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    global.window = {} as any;
    // @ts-ignore
    EvalStore.instance = undefined;
    store = EvalStore.getInstance();
  });

  it('should implement the singleton pattern', () => {
    const i1 = EvalStore.getInstance();
    const i2 = EvalStore.getInstance();
    expect(i1).toBe(i2);
  });

  it('should save an evaluation run result', async () => {
    await store.saveRun(mockRun);
    expect(mockDb.put).toHaveBeenCalledWith('eval-runs', mockRun);
  });

  it('should fetch a single run by id', async () => {
    mockRuns['run-1'] = mockRun;
    const result = await store.getRun('run-1');
    expect(result).toEqual(mockRun);
  });

  it('should delete a run by id', async () => {
    mockRuns['run-1'] = mockRun;
    await store.deleteRun('run-1');
    expect(mockDb.delete).toHaveBeenCalledWith('eval-runs', 'run-1');
  });

  it('should get runs sorted descending by timestamp', async () => {
    // Simulate cursor returning two entries
    const runEarlier: EvalRunResult = { ...mockRun, id: 'run-early', timestamp: 1000 };
    const runLater: EvalRunResult = { ...mockRun, id: 'run-late', timestamp: 2000 };

    interface MockCursor {
      value: EvalRunResult;
      continue: () => Promise<MockCursor | null>;
    }

    let step = 0;
    const cursor: MockCursor = {
      get value() {
        return step === 1 ? runEarlier : runLater;
      },
      continue: jest.fn((): Promise<MockCursor | null> => {
        step++;
        return Promise.resolve(step <= 2 ? cursor : null);
      }),
    };

    mockIndex.openCursor.mockImplementation(() => {
      step = 1;
      return Promise.resolve(cursor);
    });

    const results = await store.getRuns();
    expect(results.length).toBe(2);
    // reversed descending
    expect(results[0].id).toBe('run-late');
    expect(results[1].id).toBe('run-early');
  });
});
