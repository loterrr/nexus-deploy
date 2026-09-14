// ─── Re-export canonical types from services ─────────────────
// DocumentChunk and SearchResultItem are defined in vectorStore.ts
// Import from there to avoid type duplication.
export type { DocumentChunk, SearchResultItem } from '@/services/vectorStore';

// ─── Graph Types ──────────────────────────────────────────────
export interface GraphNode {
  id: string;
  group: number;
}
export interface GraphLink {
  source: string;
  target: string;
  label?: string;
  value?: number;
}
export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

// ─── LLM Types ────────────────────────────────────────────────
export type MessageRole = 'user' | 'assistant' | 'system';
export interface Message {
  role: MessageRole;
  content: string;
  timestamp?: number;
}