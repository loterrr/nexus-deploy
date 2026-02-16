import { AppConfig, prebuiltAppConfig } from "@mlc-ai/web-llm";

export const SELECTED_MODEL = "Llama-3.2-3B-Instruct-q4f16_1-MLC";

export const MODEL_CONFIG: AppConfig = {
  ...prebuiltAppConfig,
  use_web_worker: true,
  logLevel: "INFO",

  context_window_size: 4096,
  sliding_window_size: 2048,
  temperature: 0.2,
};