'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { CreateMLCEngine, MLCEngineInterface, InitProgressReport } from "@mlc-ai/web-llm";
import { SELECTED_MODEL, MODEL_CONFIG } from '@/lib/constants';

export type Message = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export function useWebLLM() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hello! I\'m The Archive, your research paper assistant. Upload a PDF document and I\'ll help you analyze, summarize, and understand its contents. I focus exclusively on your uploaded research materials.' }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [progress, setProgress] = useState<string>('Initializing System...');
  const [error, setError] = useState<string | null>(null);

  const engineRef = useRef<MLCEngineInterface | null>(null);
  const initializingRef = useRef(false);

  useEffect(() => {
    const init = async () => {
      if (initializingRef.current || engineRef.current) return;
      initializingRef.current = true;

      try {
        const engine = await CreateMLCEngine(SELECTED_MODEL, {
          initProgressCallback: (report: InitProgressReport) => {
            setProgress(report.text);
          },
          appConfig: MODEL_CONFIG,
        });

        engineRef.current = engine;
        setIsModelLoading(false);
        setProgress("Ready.");
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error('Error:', error.message);
      }
    };

    init();
  }, []);

  const onChat = useCallback(async (userMessage: string, context?: string) => {
    if (!engineRef.current) return;
    setIsLoading(true);

    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);

    try {
      const systemPrompt = `You are The Archive, a specialized research paper assistant. You ONLY help with academic research, thesis work, and document analysis based on uploaded PDFs.

**Your Scope (ONLY answer questions about):**
- Summarizing uploaded research papers and documents
- Explaining concepts FROM the provided document context
- Comparing and analyzing content between uploaded documents
- Helping with citations and references from uploaded sources
- Answering questions that can be answered using the uploaded documents
- Thesis and academic writing assistance based on provided materials

**Strict Rules:**
1. **Documents Required:** If no document context is provided, politely ask the user to upload a PDF first. Say something like: "I need a document to help you with that. Please upload a PDF to get started."
2. **Stay On Topic:** If asked about general knowledge, trivia, coding help, or anything unrelated to research/papers, politely decline. Say: "I'm designed specifically for research paper analysis. Please ask me about your uploaded documents."
3. **Use Context Only:** Answer ONLY based on the provided document excerpts. Do not use general knowledge to fill gaps.
4. **Cite Sources:** Always cite sources using [Source: filename.pdf] format.
5. **Be Direct:** Do not apologize for limitations. Simply redirect to your purpose.
6. **Formatting:** Use markdown for readability (headers, lists, bold text).

**If context is empty or missing:** Respond with: "I don't have any documents to reference. Please upload a research paper or document, and I'll be happy to help you analyze it."

**If the question is off-topic:** Respond with: "I'm your research paper assistant, focused on helping you understand and analyze your uploaded documents. How can I help with your research materials?"`;

      const finalUserMessage = context
        ? `**Reference Context:**
\`\`\`
${context}
\`\`\`

**User Query:** "${userMessage}"

**Instructions:**
Answer the User Query using ONLY the Reference Context above.
- If the context supports the answer, provide it with citations [Source: filename].
- If the context does not contain the answer, say so clearly. Do NOT use general knowledge.`
        : `**User Query:** "${userMessage}"

**No documents uploaded.** Politely inform the user that you need uploaded documents to assist them with research-related queries.`;

      const chunks = await engineRef.current.chat.completions.create({
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.slice(-4),
          { role: "user", content: finalUserMessage }
        ],
        temperature: 0.3,
        max_tokens: 2048,
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

  return { messages, isLoading, isModelLoading, progress, error, onChat, engine: engineRef.current };
}