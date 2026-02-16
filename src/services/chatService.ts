import { VectorStore } from './vectorStore';
export class ChatService {
    private vectorStore: VectorStore;
    constructor() {
        this.vectorStore = VectorStore.getInstance();
    }
    async getRelevantContext(query: string, limit: number = 12): Promise<string> {
        try {
            const results = await this.vectorStore.search(query, limit);

            if (results.length === 0) return '';

            return results
                .map(r => `[Source: ${r.source}]\n${r.content}`)
                .join('\n\n---\n\n');
        } catch (err) {
            console.error('Context retrieval failed:', err);
            return '';
        }
    }
}