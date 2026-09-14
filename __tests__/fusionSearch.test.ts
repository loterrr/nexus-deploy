import { FusionSearch } from '@/services/fusionSearch';

// Mock the VectorStore
jest.mock('@/services/vectorStore', () => {
    const mockDocuments = [
        {
            id: '1',
            content: 'machine learning algorithms for data analysis',
            metadata: { source: 'ml.pdf', chunkIdx: 0 },
            embedding: Array(384).fill(0.1),
        },
        {
            id: '2',
            content: 'deep learning neural networks architecture design',
            metadata: { source: 'dl.pdf', chunkIdx: 0 },
            embedding: Array(384).fill(0.2),
        },
    ];

    return {
        VectorStore: {
            getInstance: jest.fn(() => ({
                getAllDocuments: jest.fn(() => mockDocuments),
                searchDense: jest.fn(async (_query: string, limit: number) => {
                    return mockDocuments.slice(0, limit).map((doc, i) => ({
                        doc,
                        score: 0.9 - i * 0.1,
                    }));
                }),
            })),
        },
    };
});

describe('FusionSearch', () => {
    let fusionSearch: FusionSearch;

    beforeEach(() => {
        fusionSearch = new FusionSearch();
    });

    describe('search', () => {
        it('should return fused results', async () => {
            const results = await fusionSearch.search('machine learning', 5);
            expect(results.length).toBeGreaterThan(0);
        });

        it('should assign RRF scores', async () => {
            const results = await fusionSearch.search('learning', 5);
            for (const result of results) {
                expect(result.rrfScore).toBeGreaterThan(0);
            }
        });

        it('should sort results by RRF score descending', async () => {
            const results = await fusionSearch.search('learning', 5);
            for (let i = 1; i < results.length; i++) {
                expect(results[i - 1].rrfScore).toBeGreaterThanOrEqual(results[i].rrfScore);
            }
        });

        it('should include rank information', async () => {
            const results = await fusionSearch.search('learning', 5);
            for (const result of results) {
                // At least one rank should be populated
                expect(result.denseRank !== null || result.bm25Rank !== null).toBe(true);
            }
        });

        it('should respect topK limit', async () => {
            const results = await fusionSearch.search('learning', 1);
            expect(results.length).toBeLessThanOrEqual(1);
        });
    });

    describe('invalidateIndex', () => {
        it('should rebuild index on next search after invalidation', async () => {
            // First search builds the index
            await fusionSearch.search('test', 5);

            // Invalidate
            fusionSearch.invalidateIndex();

            // Next search should rebuild
            const results = await fusionSearch.search('learning', 5);
            expect(results.length).toBeGreaterThan(0);
        });
    });
});
