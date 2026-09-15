'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { MLCEngineInterface, InitProgressReport } from '@mlc-ai/web-llm';
import {
  WEBLLM_MODEL,
  WEBLLM_MODEL_LABEL,
  WEBLLM_TEMPERATURE,
  WEBLLM_MAX_TOKENS,
  SYSTEM_PROMPT,
  CONVERSATION_HISTORY_WINDOW,
  INITIAL_GREETING,
  buildUserMessage,
} from '@/lib/constants';

export type Message = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

// Module-level singleton engine reference to avoid re-instantiation during route navigations
let globalEngineInstance: MLCEngineInterface | null = null;
let globalEnginePromise: Promise<MLCEngineInterface> | null = null;

export function useWebLLM() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: INITIAL_GREETING },
  ]);
  const [isHydrated, setIsHydrated] = useState(false);

  // Restore saved chat history safely after mount to prevent SSR hydration mismatch
  useEffect(() => {
    try {
      const saved = localStorage.getItem('the_archive_chat_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        }
      }
    } catch {
      // ignore corrupted local storage
    } finally {
      setIsHydrated(true);
    }
  }, []);

  // Persist messages to localStorage whenever they update after initial client hydration
  useEffect(() => {
    if (isHydrated && messages.length > 0) {
      try {
        localStorage.setItem('the_archive_chat_history', JSON.stringify(messages));
      } catch {
        // ignore quota errors
      }
    }
  }, [messages, isHydrated]);

  const [isLoading, setIsLoading] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [progress, setProgress] = useState<string>('Initializing WebGPU Engine...');
  const [progressRatio, setProgressRatio] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const engineRef = useRef<MLCEngineInterface | null>(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const initEngine = useCallback(async () => {
    // 1. Check for WebGPU browser capability
    if (typeof window === 'undefined') return;

    if (!('gpu' in navigator) || !navigator.gpu) {
      setError(
        'WebGPU is not supported or enabled in this browser. Please use Google Chrome 113+, Microsoft Edge 113+, or Safari 18+ with hardware acceleration enabled.'
      );
      setIsModelLoading(false);
      setProgress('WebGPU Unavailable');
      return;
    }

    if (globalEngineInstance) {
      engineRef.current = globalEngineInstance;
      setIsModelLoading(false);
      setProgress('Ready.');
      setError(null);
      return;
    }

    if (globalEnginePromise) {
      try {
        setIsModelLoading(true);
        const engine = await globalEnginePromise;
        engineRef.current = engine;
        setIsModelLoading(false);
        setProgress('Ready.');
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setIsModelLoading(false);
      }
      return;
    }

    setIsModelLoading(true);
    setError(null);
    setProgress('Preparing WebGPU worker...');
    setProgressRatio(0.05);

    try {
      const { CreateWebWorkerMLCEngine } = await import('@mlc-ai/web-llm');

      const worker = new Worker(new URL('../workers/webllm.worker.ts', import.meta.url), {
        type: 'module',
      });

      globalEnginePromise = CreateWebWorkerMLCEngine(worker, WEBLLM_MODEL, {
        initProgressCallback: (report: InitProgressReport) => {
          setProgress(report.text);
          if (typeof report.progress === 'number') {
            setProgressRatio(report.progress);
          }
        },
      });

      const engine = await globalEnginePromise;
      globalEngineInstance = engine;
      engineRef.current = engine;

      setIsModelLoading(false);
      setProgress('Ready.');
      setProgressRatio(1);
      setError(null);
    } catch (err: unknown) {
      console.error('[WebLLM] Failed to initialize engine:', err);
      const message = err instanceof Error ? err.message : String(err);
      setError(`WebGPU Initialization Error: ${message}`);
      setIsModelLoading(false);
      setProgress('Initialization Failed');
      globalEnginePromise = null;
    }
  }, []);

  useEffect(() => {
    initEngine();
  }, [initEngine]);

  const addCachedMessage = useCallback((userMessage: string, aiMessage: string) => {
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: userMessage },
      { role: 'assistant', content: aiMessage },
    ]);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([{ role: 'assistant', content: INITIAL_GREETING }]);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('the_archive_chat_history');
    }
  }, []);

  const onChat = useCallback(
    async (userMessage: string, context?: string): Promise<string | undefined> => {
      if (!engineRef.current) {
        throw new Error('WebLLM engine is still initializing. Please wait until weights are loaded.');
      }

      setIsLoading(true);
      setError(null);

      // Append user message to UI
      setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);

      try {
        const finalUserMessage = buildUserMessage(userMessage, context);

        // Build conversational context window
        const currentMessages = messagesRef.current;
        const recentHistory = currentMessages
          .filter((m) => m.content !== INITIAL_GREETING)
          .slice(-CONVERSATION_HISTORY_WINDOW)
          .map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          }));

        const chatMessages = [
          { role: 'system' as const, content: SYSTEM_PROMPT },
          ...recentHistory,
          { role: 'user' as const, content: finalUserMessage },
        ];

        // Placeholder for streaming assistant response
        setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

        let fullResponse = '';

        const completion = await engineRef.current.chat.completions.create({
          messages: chatMessages,
          stream: true,
          temperature: WEBLLM_TEMPERATURE,
          max_tokens: WEBLLM_MAX_TOKENS,
        });

        for await (const chunk of completion) {
          const delta = chunk.choices[0]?.delta?.content || '';
          if (delta) {
            fullResponse += delta;
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                ...updated[updated.length - 1],
                content: fullResponse,
              };
              return updated;
            });
          }
        }

        return fullResponse;
      } catch (err: unknown) {
        console.error('[WebLLM] Chat Error:', err);
        const errorMsg = err instanceof Error ? err.message : String(err);
        setError(errorMsg);
        return undefined;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return {
    messages,
    isLoading,
    isModelLoading,
    progress,
    progressRatio,
    error,
    onChat,
    addCachedMessage,
    clearMessages,
    retryConnection: initEngine,
    modelName: WEBLLM_MODEL_LABEL,
  };
}
