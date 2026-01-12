import { prebuiltAppConfig } from "@mlc-ai/web-llm";

// FIX: Switch to TinyLlama (only ~600MB VRAM)
// This is 8x smaller than Llama-3, so it won't crash your GPU.
export const SELECTED_MODEL = "TinyLlama-1.1B-Chat-v1.0-q4f32_1-MLC";

export const MODEL_CONFIG = {
  ...prebuiltAppConfig,
  use_web_worker: true,
  logLevel: "INFO" 
};