// ─── In-Browser WebLLM Configuration ───────────────────────────
export const WEBLLM_MODEL = "Llama-3.2-1B-Instruct-q4f32_1-MLC";
export const WEBLLM_MODEL_LABEL = "Llama-3.2-1B";
export const WEBLLM_TEMPERATURE = 0.2;
export const WEBLLM_MAX_TOKENS = 2048;

// Deprecated Ollama aliases kept for backward compatibility
export const OLLAMA_MODEL = WEBLLM_MODEL;
export const OLLAMA_MODEL_FALLBACK = "Llama-3.2-1B-Instruct-q4f16_1-MLC";
export const OLLAMA_BASE_URL = "http://localhost:11434";
export const OLLAMA_REPEAT_PENALTY = 1.1;
export const OLLAMA_STOP_SEQUENCES = [
  "\n**User Query:**",
  "\nUser Query:",
  "\n**User:**",
  "\nUser:",
  "<|end|>",
  "<|user|>",
  "<|assistant|>",
];

// ─── Embedding & Reranker Models ───────────────────────────────
export const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";
export const RERANKER_MODEL = "Xenova/ms-marco-MiniLM-L-6-v2";

// ─── Retrieval Pipeline Configuration ──────────────────────────
/** Number of candidates from each search method before fusion */
export const RETRIEVAL_TOP_K = 20;
/** Final number of passages sent to LLM after reranking */
export const RERANKER_TOP_N = 5;
/** RRF constant (higher = less aggressive rank weighting) */
export const RRF_K = 60;

// ─── BM25 Configuration ───────────────────────────────────────
export const BM25_K1 = 1.5;
export const BM25_B = 0.75;

// ─── Chunking Configuration ───────────────────────────────────
export const CHUNK_SIZE = 800;
export const CHUNK_OVERLAP = 120;

// ─── Pipeline Modes ───────────────────────────────────────────
export type PipelineMode = 'baseline' | 'enhanced';
export const DEFAULT_PIPELINE_MODE: PipelineMode = 'enhanced';

// ─── Conversation Configuration ───────────────────────────────
/** Number of recent messages to include in the LLM conversation window */
export const CONVERSATION_HISTORY_WINDOW = 6;

/** Initial greeting message shown to users */
export const INITIAL_GREETING = "The Archive is ready. Index manuscripts to begin synthesis, citation verification, and cross-paper analysis.";

// ─── LLM System Prompt ────────────────────────────────────────
export const SYSTEM_PROMPT = `You are The Archive, a specialized research paper assistant. You ONLY help with academic research, thesis work, and document analysis based on uploaded PDFs.

**Your Scope (ONLY answer questions about):**
- Summarizing uploaded research papers and documents
- Explaining concepts FROM the provided document context
- Comparing and analyzing content between uploaded documents
- Helping with citations and references from uploaded sources
- Answering questions that can be answered using the uploaded documents
- Thesis and academic writing assistance based on provided materials

**Strict Rules:**
1. **Documents Required:** If no document context is provided, politely ask the user to upload a PDF first. Say something like: "I need a document to help you with that. Please upload a PDF to get started."
2. **Stay On Topic:** If asked about general knowledge, trivia, coding help, or anything unrelated to research/papers, politely decline. Say: "I'm designed specifically for research paper analysis. Please ask me about your uploaded documents."
3. **Use Context Only:** Answer ONLY based on the provided document excerpts. Do not use general knowledge to fill gaps.
4. **Cite Sources:** Always cite sources using [Source: filename.pdf] format.
5. **Be Direct:** Do not apologize for limitations. Simply redirect to your purpose.
6. **Formatting:** Use markdown for readability (headers, lists, bold text).

**If context is empty or missing:** Respond with: "I don't have any documents to reference. Please upload a research paper or document, and I'll be happy to help you analyze it."

**If the question is off-topic:** Respond with: "I'm your research paper assistant, focused on helping you understand and analyze your uploaded documents. How can I help with your research materials?"`;

/** Build the final user message with context for the LLM */
export function buildUserMessage(userMessage: string, context?: string): string {
  if (context) {
    return `**Reference Context:**
\`\`\`
${context}
\`\`\`

**User Query:** "${userMessage}"

**Instructions:**
Answer the User Query using ONLY the Reference Context above.
- If the context supports the answer, provide it with citations [Source: filename].
- If the context does not contain the answer, say so clearly. Do NOT use general knowledge.`;
  }

  return `**User Query:** "${userMessage}"

**No documents uploaded.** Politely inform the user that you need uploaded documents to assist them with research-related queries.`;
}