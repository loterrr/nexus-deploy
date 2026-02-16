# The Archive: Local RAG Research Assistant

![License](https://img.shields.io/badge/license-MIT-blue.svg) ![TypeScript](https://img.shields.io/badge/typescript-5.0%2B-blue) ![Status](https://img.shields.io/badge/status-beta-green)

> **A 100% Local, Privacy-First AI Research Assistant running directly in your browser.**

## 📖 About The Archive

The Archive is a next-generation **Local RAG (Retrieval Augmented Generation)** engine. Unlike traditional chatbots that send your data to the cloud, The Archive runs a **powerful Llama 3.2 AI model directly inside your web browser**.

### Why The Archive?
1.  **🔒 Total Privacy:** Your documents (PDFs) are processed and stored locally in your browser's IndexedDB. No data ever leaves your device.
2.  **⚡ Local Intelligence:** Powered by WebLLM and WebGPU, giving you ChatGPT-like performance without valid internet connectivity (after initial partial load).
3.  **🧠 Deep Research Agent:** Goes beyond simple chat. The Archive functions as an agent that can break down complex queries, plan research steps, and synthesize comprehensive reports.

---

## ✨ Key Features

### 🔍 Deep Research Mode
*   **Agentic Reasoning:** Decomposes complex questions (e.g., "Compare X and Y") into multiple sub-queries.
*   **Parallel Retrieval:** Searches for multiple distinct aspects of your query simultaneously.
*   **Comprehensive Reports:** Synthesizes findings into a well-structured research document logic.

### 🔦 Smart Citations
*   **Interactive Sources:** Citations in the chat `[Source: document.pdf]` are clickable.
*   **Instant Verification:** Clicking a citation opens the PDF preview overlay instantly, allowing you to verify facts against the source text.

### 🕸️ Interactive Knowledge Graph
*   **Visual Discovery:** Explore connections between your documents in a physics-based 3D/2D graph.
*   **Semantic Links:** Automatically links documents that share similar topics or content.

### 💾 Persistent Memory
*   **Offline Storage:** Your uploaded documents, embeddings, and chat history are saved in IndexedDB.
*   **Resumable Sessions:** Reload the page, and your knowledge base is still there, ready for work.

---

## 🛠 Tech Stack

*   **Framework:** Next.js 14, React 18
*   **AI Inference:** [WebLLM](https://webllm.mlc.ai/) (Llama-3.2-3B-Instruct)
*   **Embeddings:** Transformers.js (Xenova/all-MiniLM-L6-v2)
*   **Vector Store:** In-Memory + IDB Persistence
*   **Visualization:** React Force Graph 2D
*   **Styling:** TailwindCSS

---

## 🚀 Getting Started

### Prerequisites
*   **Node.js 18+** installed.
*   A modern browser with **WebGPU support** (Chrome 113+, Edge 113+, Firefox Nightly).

### Installation Steps

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/loterrr/nexus-deploy.git
    cd nexus-deploy
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    # or
    yarn install
    ```

3.  **Start Dev Server**
    ```bash
    npm run dev
    ```

4.  **Launch**
    *   Open `http://localhost:3000` in your browser.
    *   *Note: First load will download the AI model (~2GB) and embedding models. This happens once.*

---

## 📘 User Manual

### 1. Ingesting Documents
*   Click the **"Upload"** area in the sidebar.
*   Select one or multiple **PDF files**.
*   Watch as The Archive chunks and embeds them locally (check the sidebar for progress).

### 2. Chatting (Fast Mode)
*   Type a question in the chat input.
*   The Archive will search your documents and generate an answer based *only* on the provided context.
*   Best for: Specific fact lookup, summaries.

### 3. Using Deep Research Mode 🧠
*   Toggle the button in the chat header from **FAST** to **DEEP**.
*   Ask a complex question (e.g., *"Analyze the evolution of this technology across these 3 papers"*).
*   The Archive will:
    1.  **Plan:** Break down the question.
    2.  **Search:** Perform multiple targeted searches.
    3.  **Report:** Write a detailed answer with citations.

### 4. Verifying Sources
*   In the AI's response, look for blue citation buttons (e.g., `[Source: paper.pdf]`).
*   **Click the button** to open the PDF Viewer overlay.
*   Read the original text to confirm accuracy.

### 5. Managing Storage
*   All data is saved automatically.
*   To wipe everything and start fresh, click the **"Clear Storage"** (Trash Icon) button in the sidebar.

---

## 🗺 Roadmap

*   [x] Local Vector Store (IndexedDB)
*   [x] Deep Research Agent
*   [x] Smart Citation Highlights
*   [ ] Multi-Modal Support (Image Analysis)
*   [ ] Voice Interface (Web Speech API)
*   [ ] Export Research Reports to PDF/Markdown

---

## 🤝 Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## 📄 License

Distributed under the MIT License.