# Nexus: The Archive — Local Multi-Stage RAG Research Assistant

![License](https://img.shields.io/badge/license-MIT-blue.svg) ![TypeScript](https://img.shields.io/badge/typescript-5.9%2B-blue) ![Next.js](https://img.shields.io/badge/Next.js-14-black) ![Ollama](https://img.shields.io/badge/Ollama-phi3.5%20%7C%20llama3.2-orange) ![Status](https://img.shields.io/badge/status-active-green)

> **A 100% Local, Privacy-First Multi-Stage RAG Engine and Research Assistant running strictly within an 8GB RAM consumer edge hardware boundary.**

---

## 📖 Overview

**Nexus: The Archive** is a high-performance, edge-first Retrieval-Augmented Generation (RAG) assistant designed for academic research, thesis analysis, and document synthesis. Unlike traditional cloud chatbots that transmit sensitive papers and unpublished research to third-party servers, Nexus processes and stores everything 100% locally on your device.

Nexus implements a state-of-the-art **two-stage retrieval pipeline**:
1. **Stage 1 (Hybrid Fusion):** Dual-search using sparse lexical matching (Okapi BM25) and dense semantic vectors (`all-MiniLM-L6-v2`), unified through **Reciprocal Rank Fusion (RRF, $k=60$)**.
2. **Stage 2 (Neural Reranking):** Deep query-passage interaction scoring via a **Cross-Encoder (`ms-marco-MiniLM-L-6-v2`)**, completely offloaded to a dedicated Web Worker to ensure zero UI freeze.
3. **Local LLM Synthesis:** Grounded generation powered by **Ollama** running Microsoft **Phi-3.5-mini (3.8B)** or **Llama 3.2 (3B)**.

---

## ✨ Key Features

### ⚡ Two-Stage Hybrid Retrieval
* **Okapi BM25 Index:** Exact term matching with tokenization, stopword removal, and stemming for scientific acronyms and domain terminology.
* **Dense Semantic Embeddings:** 384-dimensional cosine similarity via Transformers.js ONNX runtime.
* **Reciprocal Rank Fusion (RRF):** Merges discordant rank distributions into an optimal Top-K candidate pool.
* **Cross-Encoder Reranker:** Token-level cross-attention filtering out semantic distractors before context injection.
* **Toggle Modes:** Switch live between **Baseline (Single-Stage)** and **Enhanced (Multi-Stage)** in the UI.

### 📊 Comprehensive Evaluation Suite (`/evaluate`)
* **Retrieval Relevance:** Mean Reciprocal Rank (MRR), Precision@K, Recall@K, and Normalized Discounted Cumulative Gain (NDCG).
* **Generation Quality:** Groundedness (faithfulness), Correctness, and Completeness (citation coverage).
* **Efficiency Profiling:** Average and P95 latency distributions, Time to First Token (TTFT), and JS heap memory tracking.
* **Fine-Tuning Export:** One-click download of evaluated query-passage pairs as supervised `.jsonl` training data for offline PyTorch fine-tuning.

### 🧠 Semantic Query Cache
* In-memory + IndexedDB semantic query cache with a $\ge 0.91$ cosine similarity threshold.
* Instant sub-millisecond responses for semantically equivalent questions.
* Automatic cache invalidation upon document additions or removals.

### 🕸️ Interactive Knowledge Graph
* Physics-based 2D force-directed graph (via `react-force-graph-2d`) mapping document relationships.
* Visualizes semantic similarity links and inter-document connections.
* Click any node to open the document directly.

### 🔦 Interactive Smart Citations & PDF Viewer
* In-text citations (e.g., `[Source: paper.pdf, Page 4]`) are interactive buttons.
* Clicking a citation opens the built-in PDF viewer directly to the cited page for source verification.

### 🔒 100% Offline Data Sovereignty
* Document text, chunk embeddings, and raw PDF files persist across browser reloads inside **IndexedDB**.
* Zero telemetry, zero external network requests. Everything operates offline within a strict 8GB RAM footprint.

---

## 🛠 Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Framework** | Next.js 14 (App Router), React 18, TypeScript 5.9 |
| **Desktop Shell** | Electron 40, `electron-builder`, `electron-serve` |
| **Local LLM** | [Ollama](https://ollama.com/) (`phi3.5:3.8b-mini-instruct`, fallback: `llama3.2:3b`) |
| **Embeddings** | `@xenova/transformers` (`Xenova/all-MiniLM-L6-v2` ONNX quantized) |
| **Cross-Encoder** | `@xenova/transformers` (`Xenova/ms-marco-MiniLM-L-6-v2` ONNX quantized) |
| **Concurrency** | Dedicated Neural Web Worker (`neural.worker.ts`) |
| **Sparse Index** | Custom Inverted Okapi BM25 Index |
| **Local Storage** | IndexedDB (`idb` v8) with PDF binary caching |
| **Visualization** | `react-force-graph-2d` |
| **Styling** | TailwindCSS, Tailwind Typography |
| **Testing** | Jest 30, `ts-jest`, `@testing-library/react` |

---

## 🚀 Getting Started

### Prerequisites
1. **Node.js 18+** installed.
2. **Ollama** installed from [ollama.com](https://ollama.com/).
3. Pull the primary local language model:
   ```bash
   ollama pull phi3.5
   ```
   *(Optional fallback: `ollama pull llama3.2`)*

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/loterrr/nexus-deploy.git
   cd nexus-deploy
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Download ONNX embedding & reranker models for 100% offline usage:**
   ```bash
   npm run setup:models
   npm run setup:worker
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

5. **Desktop App (Electron):**
   ```bash
   npm run electron-dev
   ```

---

## 🧪 Testing & Verification

Run the full automated test suite (14 test suites, 98 tests):
```bash
npm test
```

Run ESLint verification:
```bash
npm run lint
```

Typecheck with TypeScript compiler:
```bash
npx tsc --noEmit
```

---

## 📄 License

Distributed under the MIT License.