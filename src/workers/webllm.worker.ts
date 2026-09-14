import { WebWorkerMLCEngineHandler } from '@mlc-ai/web-llm';

/**
 * Dedicated Web Worker for In-Browser WebLLM execution.
 * Offloads all model weights streaming, token generation, and WebGPU compute
 * from the Next.js main UI thread.
 */
const handler = new WebWorkerMLCEngineHandler();

self.onmessage = (msg: MessageEvent) => {
  handler.onmessage(msg);
};
