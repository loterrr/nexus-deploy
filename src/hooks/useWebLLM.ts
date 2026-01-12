'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { CreateMLCEngine, MLCEngineInterface, InitProgressReport } from "@mlc-ai/web-llm";
import { SELECTED_MODEL, MODEL_CONFIG } from '@/lib/constants';

export type Message = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export function useWebLLM() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [progress, setProgress] = useState<string>('Initializing GPU...');
  const [error, setError] = useState<string | null>(null);

  const engineRef = useRef<MLCEngineInterface | null>(null);
  const initializingRef = useRef(false);

  useEffect(() => {
    const init = async () => {
      if (initializingRef.current || engineRef.current) return;
      initializingRef.current = true;

      try {
        console.log("Loading GPU Model:", SELECTED_MODEL);
        const engine = await CreateMLCEngine(SELECTED_MODEL, {
          initProgressCallback: (report: InitProgressReport) => {
            setProgress(report.text);
          },
          appConfig: MODEL_CONFIG,
        });

        engineRef.current = engine;
        setIsModelLoading(false);
        setProgress("GPU Ready.");
      } catch (err: any) {
        console.error("GPU Load Failed:", err);
        setError("GPU Error: " + err.message);
        setIsModelLoading(false);
      }
    };

    init();
  }, []);

  const onChat = useCallback(async (userMessage: string, context?: string) => {
    if (!engineRef.current) return;
    setIsLoading(true);
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);

    try {
      const systemPrompt = context 
        ? `You are an expert research assistant.
INSTRUCTIONS:
1. Answer the user's question using ONLY the provided context below. Do not use outside knowledge.
2. If the answer is not in the context, politely state that the information is missing.
3. Format your response using clear Markdown:
   - Use **bold** for key concepts.
   - Use bullet points for lists.
   - Use ### Headers to organize long answers.
4. Keep your tone professional, accurate, and concise.

CONTEXT:
${context}`
        : `You are an expert AI assistant. 
INSTRUCTIONS:
1. Provide smart, accurate, and well-reasoned answers.
2. Format your response using clear Markdown (**bold**, lists, headers).
3. Be concise and professional.`;

      const chunks = await engineRef.current.chat.completions.create({
        messages: [
            { role: "system", content: systemPrompt },
            ...messages, 
            { role: "user", content: userMessage }
        ],
        temperature: 0.5,
        stream: true, 
      });

      let fullResponse = "";
      setMessages(prev => [...prev, { role: 'assistant', content: "" }]);

      for await (const chunk of chunks) {
        const delta = chunk.choices[0]?.delta.content || "";
        fullResponse += delta;
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1].content = fullResponse;
          return updated;
        });
      }
    } catch (err: any) {
      console.error("Chat Error:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [messages]);

  return { messages, isLoading, isModelLoading, progress, error, onChat };
}