# The Archive — Domain Model & Glossary (CONTEXT.md)

This document establishes the ubiquitous language and domain model for **The Archive** (Nexus v1), a local-first, privacy-preserving research assistant and literature retrieval system designed for consumer edge hardware (8GB RAM budget, offline Ollama execution).

---

## 1. Domain Entities & Value Objects

### 1.1 Document
- **Definition**: A parsed, searchable academic artifact (typically PDF) uploaded to local storage.
- **Attributes**: `filename`, `size`, `type`, `pageCount`, `uploadTimestamp`.
- **Invariants**: Document data and chunks are persisted in client-side IndexedDB (`the-archive-rag-db`). Raw files reside in `files-store` and chunked segments in `vector-store`.

### 1.2 Passage / Document Chunk
- **Definition**: A bounded, coherent slice of document text extracted for embedding and retrieval.
- **Attributes**: `id`, `content`, `embedding` (384-dimensional dense vector), `metadata` (`source`, `chunkIdx`, `pageNumber`, `textSnippet`).
- **Invariants**: Chunk boundaries preserve sentence coherence with sliding window overlap (`CHUNK_SIZE = 500`, `CHUNK_OVERLAP = 100`).

### 1.3 Citation / Grounded Source
- **Definition**: An unambiguous provenance link connecting an AI statement to an exact document and page number.
- **Format**: `[Source: <filename>, Page <pageNumber>]`.
- **UI Projection**: Rendered as a Neural Citation HUD chip with active page preview targeting.

### 1.4 Grounded Context
- **Definition**: A structured value object emitted by `RetrievalPipeline` encapsulating prompt-injected text, provenance citations, and source metadata.
- **Attributes**: `formattedContext` (string ready for LLM prompt context injection), `citations` (array of `GroundedCitation` items), `candidateCount` (number of retrieved passages).

---

## 2. Retrieval & Reranking Architecture

### 2.1 Hybrid Dual-Search
- **Lexical Search (Sparse)**: Exact keyword matching via an in-memory BM25 index with inverted document frequency weighting.
- **Semantic Search (Dense)**: Vector similarity calculated via cosine distance over 384-dimensional embeddings generated locally by Sentence-BERT (`Xenova/all-MiniLM-L6-v2`).
- **Reciprocal Rank Fusion (RRF)**: Mathematical rank merger combining scale-incompatible dense and sparse scores into a unified Top-K candidate list:
  $$\text{RRF}(d) = \sum_{m \in \{\text{dense}, \text{bm25}\}} \frac{1}{k + \text{rank}_m(d)}$$

### 2.2 Cross-Encoder Reranker
- **Definition**: Stage-2 neural filter executing full token-level joint self-attention across `(query, passage)` pairs using `Xenova/ms-marco-MiniLM-L-6-v2`.
- **Role**: Discards semantic distractors and isolates the Top-N highest-relevance passages for context injection.
- **Execution**: Offloaded to a dedicated Web Worker (`neural.worker.ts`) with in-thread fallback and a 30-second watchdog timeout.

### 2.3 Pipeline Modes
- **Baseline (Single-Stage)**: BM25 + Dense $\to$ RRF $\to$ Top-K context directly forwarded to the LLM.
- **Enhanced (Multi-Stage)**: BM25 + Dense $\to$ RRF $\to$ Cross-Encoder $\to$ Top-N context forwarded to the LLM.

---

## 3. Generative & Execution Seams

### 3.1 Research Coordinator
- **Definition**: The deep central module coordinating the end-to-end research query lifecycle behind a single clean seam.
- **Responsibilities**: Orchestrates cache interception, hybrid retrieval, prompt context construction, streaming LLM adaptation, cache persistence, intent artifact generation, and unified cache invalidation.
- **Interface**: `ResearchCoordinator.ask(request)` returning `ResearchQueryOutcome`.

### 3.2 Research Query Lifecycle
The end-to-end execution flow of a user research query:
1. **Cache Interception**: Semantic query cache lookup ($\ge 0.91$ cosine similarity threshold). Short-circuits on hit.
2. **Hybrid Retrieval**: Mode-specific candidate generation (`baseline` vs. `enhanced`).
3. **Context Assembly**: Structured synthesis of citations, page numbers, and passage text (`GroundedContext`).
4. **Local LLM Inference**: Streaming generation via Ollama running quantized `Phi-3.5-mini:3.8b-instruct`.
5. **Cache Persistence**: Successful grounded responses saved to local indexed query cache.
6. **Intent Action**: Automated synthesis artifact generation (e.g. Markdown summary file creation).

### 3.2 Evaluation Suite
- **Retrieval Relevance**: Mean Reciprocal Rank (MRR), Precision@K, Recall@K, Normalized Discounted Cumulative Gain (NDCG).
- **Generation Quality (RAGAS-Framework)**: Groundedness, Factual Correctness, Source Completeness.
- **System Efficiency**: Average/P95 Retrieval Latency, Time to First Token (TTFT), Peak Heap Memory.
