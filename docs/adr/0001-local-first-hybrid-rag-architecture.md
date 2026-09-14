# ADR-0001: Local-First Hybrid RAG Architecture & Hardware Budget

## Status
Accepted

## Context
The Archive (Nexus v1) is designed as an offline, sovereign research assistant for processing academic literature and thesis PDFs. Unlike cloud-based systems (e.g. OpenAI Assistants, Pinecone), this system must run entirely on consumer-grade hardware with an 8GB total RAM envelope and zero external data transmission.

## Decision
1. **Local-First Vector & Lexical Storage**:
   - Chunks, embeddings, and raw files are stored in browser IndexedDB (`idb`).
   - Sparse lexical search runs in-memory via BM25 (`BM25Index`).
   - Dense semantic embeddings use Sentence-BERT (`Xenova/all-MiniLM-L6-v2`, 384 dimensions) via WebAssembly.
2. **Two-Stage Retrieval Pipeline**:
   - Stage 1: Dual-search (Dense cosine similarity + Sparse BM25) fused via Reciprocal Rank Fusion (RRF).
   - Stage 2: Token-level joint attention reranking via Cross-Encoder (`Xenova/ms-marco-MiniLM-L-6-v2`) offloaded to a Web Worker.
3. **Local Small Language Model**:
   - Local LLM inference runs via Ollama on `localhost:11434` utilizing quantized `Phi-3.5-mini:3.8b-instruct`.
4. **Offline Fine-Tuning Data Generation**:
   - Query-passage relevance pairs are formatted and exported locally as JSONL for offline supervised cross-encoder training.

## Consequences
- **Positive**: Strict data sovereignty, zero API costs, resilient offline execution, and sub-second hybrid candidate fusion.
- **Negative**: Constrained model capacity (quantized 3.8B parameters), browser memory limits require explicit cache invalidation and worker watchdog timeouts.
