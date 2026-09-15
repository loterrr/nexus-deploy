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
export const SYSTEM_PROMPT = `You are The Archive, an expert scholarly research assistant. You synthesize literature, analyze methodology, compare scientific approaches, and answer academic queries based on uploaded manuscripts.

**Synthesis Guidelines:**
1. Ground your answers thoroughly in the provided document context. Answer ONLY using the factual evidence from the document excerpts.
2. For each claim, finding, or method, provide an accurate inline citation in the format: [Source: filename.pdf] (or [Source: filename.pdf, p. X]).
3. When multiple documents address the query, synthesize and contrast their findings across papers.
4. If the retrieved context only partially answers the query, explain what is supported by the literature and what is not mentioned.
5. Structure your output clearly using academic markdown (concise paragraphs, bullet points, bold conceptual terms).
6. If no document context is provided, state: "No documents uploaded. Please upload research manuscripts to begin analysis."`;

/** Build the final user message with context for the LLM */
export function buildUserMessage(userMessage: string, context?: string): string {
  if (context && context.trim().length > 0) {
    return `=== Reference Context ===
${context}
=== End Reference Context ===

User Query: "${userMessage}"

Instructions:
Answer the User Query using ONLY the factual evidence from the Reference Context above.
- Cite specific papers for each point with [Source: filename.pdf].
- Synthesize across multiple papers if they are relevant to the query.
- If the Reference Context does not contain the answer, state that clearly without using outside knowledge.`;
  }

  return `User Query: "${userMessage}"

No documents uploaded. Please upload a research paper to the archive so I can help analyze it.`;
}