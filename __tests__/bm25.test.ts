import { BM25Index } from '@/services/bm25';
import type { DocumentChunk } from '@/services/vectorStore';

function createChunk(id: string, content: string, source: string): DocumentChunk {
    return {
        id,
        content,
        metadata: { source, chunkIdx: 0 },
    };
}

describe('BM25Index', () => {
    let index: BM25Index;

    beforeEach(() => {
        index = new BM25Index();
    });

    describe('build', () => {
        it('should build index from documents', () => {
            const docs = [
                createChunk('1', 'machine learning algorithms are powerful tools', 'ml.pdf'),
                createChunk('2', 'deep learning is a subset of machine learning', 'dl.pdf'),
                createChunk('3', 'natural language processing uses neural networks', 'nlp.pdf'),
            ];

            index.build(docs);

            expect(index.getDocumentCount()).toBe(3);
            expect(index.getVocabularySize()).toBeGreaterThan(0);
        });

        it('should handle empty document list', () => {
            index.build([]);
            expect(index.getDocumentCount()).toBe(0);
            expect(index.getVocabularySize()).toBe(0);
        });
    });

    describe('search', () => {
        beforeEach(() => {
            const docs = [
                createChunk('1', 'machine learning algorithms are powerful tools for data analysis', 'ml.pdf'),
                createChunk('2', 'deep learning neural networks transformers attention mechanism', 'dl.pdf'),
                createChunk('3', 'natural language processing text classification sentiment analysis', 'nlp.pdf'),
                createChunk('4', 'reinforcement learning reward policy optimization agents', 'rl.pdf'),
            ];
            index.build(docs);
        });

        it('should return relevant results for a query', () => {
            const results = index.search('machine learning');
            expect(results.length).toBeGreaterThan(0);
            // First result should be the machine learning document
            expect(results[0].doc.metadata.source).toBe('ml.pdf');
        });

        it('should respect limit parameter', () => {
            const results = index.search('learning', 2);
            expect(results.length).toBeLessThanOrEqual(2);
        });

        it('should return empty results for non-matching query', () => {
            const results = index.search('quantum computing photonics');
            expect(results.length).toBe(0);
        });

        it('should return empty results for empty query', () => {
            const results = index.search('');
            expect(results.length).toBe(0);
        });

        it('should return results sorted by score descending', () => {
            const results = index.search('learning');
            for (let i = 1; i < results.length; i++) {
                expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
            }
        });

        it('should filter stopwords from queries', () => {
            // 'the' and 'is' are stopwords — query should still find results
            const results = index.search('the learning is');
            expect(results.length).toBeGreaterThan(0);
        });

        it('should not search before index is built', () => {
            const freshIndex = new BM25Index();
            const results = freshIndex.search('machine learning');
            expect(results.length).toBe(0);
        });
    });

    describe('stemming', () => {
        it('should match stemmed variants', () => {
            const docs = [
                createChunk('1', 'the researchers investigated the optimization problem', 'a.pdf'),
                createChunk('2', 'cats and dogs are domesticated animals', 'b.pdf'),
            ];
            index.build(docs);

            // 'investigating' should match 'investigated' after stemming
            const results = index.search('research optimization');
            expect(results.length).toBeGreaterThan(0);
            expect(results[0].doc.metadata.source).toBe('a.pdf');
        });
    });
});
