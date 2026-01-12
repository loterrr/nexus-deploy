'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { pipeline, env } from '@xenova/transformers';

// Configuration: Force browser usage
env.allowLocalModels = false;
env.useBrowserCache = true;

// MODEL CONFIGURATION
// We use Qwen1.5-0.5B-Chat because it is:
// 1. "Generative" (Smart like ChatGPT, not just a translator like T5)
// 2. Small enough (500MB) to run on CPU without crashing
// 3. Trained to follow specific formatting instructions
const MODEL_ID = 'Xenova/Qwen1.5-0.5B-Chat';
const TASK = 'text-generation';

export type Message = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export function useCpuLLM() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [progress, setProgress] = useState<string>('Initiating Engine...');
  const [error, setError] = useState<string | null>(null);
  
  const generatorRef = useRef<any>(null);
  const initializingRef = useRef(false);

  // 1. INITIALIZATION
  useEffect(() => {
    const init = async () => {
      // Prevent double-loading in React Strict Mode
      if (initializingRef.current) return;
      initializingRef.current = true;

      try {
        console.log(`Loading ${MODEL_ID} on CPU...`);
        
        const generator = await pipeline(TASK, MODEL_ID, {
          quantized: true, // Crucial: Keeps memory usage low (~600MB RAM)
          progress_callback: (data: any) => {
            if (data.status === 'progress') {
              const percent = Math.round((data.progress || 0) * 100);
              setProgress(`Downloading Brain: ${percent}%`);
            } else if (data.status === 'done') {
              setProgress("Model Ready.");
            } else {
              setProgress(data.status || "Loading...");
            }
          }
        });

        generatorRef.current = generator;
        setIsModelLoading(false);
        setProgress("Ready (Qwen Smart Mode)");
        setError(null);
        
      } catch (err: any) {
        console.error("CPU Model Failed:", err);
        setError("Failed to load AI model. Please refresh.");
        setIsModelLoading(false);
      }
    };
    init();
  }, []);

  // 2. CHAT HANDLER
  const onChat = useCallback(async (userMessage: string, context?: string) => {
    if (!generatorRef.current) return;
    if (isLoading) return;

    setIsLoading(true);
    setError(null);
    
    // Add User Message to UI immediately
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);

    try {
      // 3. PROMPT ENGINEERING (ChatML Format)
      // Qwen strictly requires this format to separate System/User/Assistant
      let prompt = "";
      
      if (context && context.trim().length > 0) {
        // RAG Prompt: Includes the PDF content
        prompt = `<|im_start|>system
You are a helpful technical assistant.
1. Answer the user's question using ONLY the context provided below.
2. Format your response using Markdown:
   - Use **bold** for key terms.
   - Use - bullet points for lists.
   - Use ### Headers for distinct sections.
3. If the answer is not in the context, politely say you don't know.
Context:
${context}<|im_end|>
<|im_start|>user
${userMessage}<|im_end|>
<|im_start|>assistant
`;
      } else {
        // General Chat Prompt (No Context)
        prompt = `<|im_start|>system
You are a helpful AI assistant. Format your answers clearly with Markdown (Bold, Bullets).<|im_end|>
<|im_start|>user
${userMessage}<|im_end|>
<|im_start|>assistant
`;
      }

      console.log("Sending Prompt to Engine...");

      // 4. GENERATION
      const result = await generatorRef.current(prompt, {
        max_new_tokens: 1024, // High limit to prevent cut-off sentences
        temperature: 0.3,     // Low temp = More factual, less creative
        do_sample: true,
        top_k: 20,            // Limits random bad words
        repetition_penalty: 1.1, // Prevents "and and and" loops
        return_full_text: false, // Don't repeat the prompt in the output
      });

      // 5. CLEANUP
      let answer = result[0].generated_text;
      // Remove any lingering model tags
      answer = answer.replace('<|im_end|>', '').trim();

      if (!answer) throw new Error("Empty response");

      setMessages(prev => [...prev, { role: 'assistant', content: answer }]);
      
    } catch (err: any) {
      console.error("Generation Error:", err);
      setError("Failed to generate response.");
      setMessages(prev => [
        ...prev, 
        { role: 'assistant', content: "I encountered an error while processing that." }
      ]);
    } finally {
      setIsLoading(false);
    }

  }, [isLoading]);

  return {
    messages,
    isLoading,
    isModelLoading,
    progress,
    error,
    onChat
  };
}