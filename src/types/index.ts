// Document & Vector Store Types
export interface DocumentChunk {
  id: string;
  content: string;
  metadata: {
    source: string;
    chunkIdx: number;
  };
}
export interface SearchResultItem {
  content: string;
  score: number;
  source: string;
}
// Graph Types
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
// LLM Types
export type MessageRole = 'user' | 'assistant' | 'system';
export interface Message {
  role: MessageRole;
  content: string;
  timestamp?: number;
}