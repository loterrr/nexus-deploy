import { VectorStore } from './vectorStore';
import { MLCEngineInterface } from "@mlc-ai/web-llm";

export class DeepResearchService {
    private engine: MLCEngineInterface;
    private vectorStore: VectorStore;

    constructor(engine: MLCEngineInterface) {
        this.engine = engine;
        this.vectorStore = VectorStore.getInstance();
    }

    async runDeepResearch(userQuery: string, onStep: (step: string) => void): Promise<string> {

        onStep("Analyzing query complexity...");
        const subQueries = await this.decomposeQuery(userQuery);
        console.log("Deep Research Plan:", subQueries);
        onStep(`Researching ${subQueries.length} distinct topics...`);
        let aggregatedContext = "";

        for (const query of subQueries) {
            onStep(`Searching knowledge base for: "${query}"...`);
            const results = await this.vectorStore.search(query, 3);
            if (results.length > 0) {
                aggregatedContext += `\n### Context regarding "${query}":\n`;
                aggregatedContext += results.map(r => `[Source: ${r.doc.metadata.source}]\n${r.doc.content}`).join('\n\n');
                aggregatedContext += "\n---\n";
            }
        }

        if (!aggregatedContext) {
            return "I researched your query but couldn't find any relevant information in the uploaded documents.";
        }

        onStep("Synthesizing research report...");
        const finalAnswer = await this.synthesizeReport(userQuery, aggregatedContext);

        return finalAnswer;
    }

    private async decomposeQuery(query: string): Promise<string[]> {
        const prompt = `You are a research planning agent. Your goal is to break down a complex user question into 3 distinct, targeted search queries.

    User Question: "${query}"

    Instructions:
    1. Identify the core topics in the question.
    2. Generate 3 specific search queries that cover different aspects.
    3. Return ONLY a JSON array of strings.
    
    Example Output: ["history of neural networks", "transformer architecture details", "LLM training techniques"]`;

        try {
            const response = await this.engine.chat.completions.create({
                messages: [{ role: "user", content: prompt }],
                temperature: 0.1,
                response_format: { type: "json_object" }
            });

            const content = response.choices[0]?.message?.content || "[]";

            try {
                const parsed = JSON.parse(content);
                if (Array.isArray(parsed)) return parsed.slice(0, 3);
                if (parsed.queries && Array.isArray(parsed.queries)) return parsed.queries.slice(0, 3);
                return [query];
            } catch (e) {
                const matches = content.match(/"([^"]+)"/g);
                if (matches) return matches.map(s => s.replace(/"/g, '')).slice(0, 3);
                return [query];
            }

        } catch (err) {
            console.warn("Decomposition failed, using original query", err);
            return [query];
        }
    }

    private async synthesizeReport(query: string, context: string): Promise<string> {
        const prompt = `You are a Deep Research Agent. Your goal is to write a comprehensive answer based on the gathered context.

    User Question: "${query}"

    Context:
    ${context}

    Instructions:
    1. Synthesize the information from the context above.
    2. Structure the answer with clear headings.
    3. **CRITICAL:** Cite your sources explicitly using [Source: filename].
    4. If the context is insufficient, state clearly what is missing.
    5. Maintain a professional and objective tone.`;

        const response = await this.engine.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            temperature: 0.5
        });

        return response.choices[0]?.message?.content || "Analysis failed.";
    }
}
