import { generateTrainingPairs, toJSONL } from '@/services/trainingData';

describe('TrainingData Service', () => {
    describe('generateTrainingPairs', () => {
        it('should generate training pairs with correct labels', () => {
            const passages = [
                { content: 'relevant passage about ML', source: 'ml.pdf', score: 0.9, isRelevant: true },
                { content: 'irrelevant passage about cooking', source: 'cook.pdf', score: 0.3, isRelevant: false },
            ];

            const pairs = generateTrainingPairs('machine learning', passages);

            expect(pairs).toHaveLength(2);
            expect(pairs[0].label).toBe(1);
            expect(pairs[0].query).toBe('machine learning');
            expect(pairs[1].label).toBe(0);
        });

        it('should include source and score metadata', () => {
            const passages = [
                { content: 'test passage', source: 'test.pdf', score: 0.85, isRelevant: true },
            ];

            const pairs = generateTrainingPairs('test query', passages);

            expect(pairs[0].source).toBe('test.pdf');
            expect(pairs[0].score).toBe(0.85);
        });

        it('should handle empty passages', () => {
            const pairs = generateTrainingPairs('test', []);
            expect(pairs).toHaveLength(0);
        });
    });

    describe('toJSONL', () => {
        it('should produce valid JSONL format', () => {
            const pairs = [
                { query: 'q1', passage: 'p1', label: 1 as const },
                { query: 'q2', passage: 'p2', label: 0 as const },
            ];

            const jsonl = toJSONL(pairs);
            const lines = jsonl.split('\n');

            expect(lines).toHaveLength(2);

            const parsed1 = JSON.parse(lines[0]);
            expect(parsed1.query).toBe('q1');
            expect(parsed1.passage).toBe('p1');
            expect(parsed1.label).toBe(1);

            const parsed2 = JSON.parse(lines[1]);
            expect(parsed2.query).toBe('q2');
            expect(parsed2.label).toBe(0);
        });

        it('should handle empty pairs', () => {
            const jsonl = toJSONL([]);
            expect(jsonl).toBe('');
        });

        it('should not include extra metadata in JSONL output', () => {
            const pairs = [
                { query: 'q', passage: 'p', label: 1 as const, source: 'test.pdf', score: 0.9 },
            ];

            const jsonl = toJSONL(pairs);
            const parsed = JSON.parse(jsonl);

            expect(Object.keys(parsed)).toEqual(['query', 'passage', 'label']);
            expect(parsed.source).toBeUndefined();
        });
    });
});
