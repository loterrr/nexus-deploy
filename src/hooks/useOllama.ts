'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
    OLLAMA_MODEL,
    OLLAMA_MODEL_FALLBACK,
    SYSTEM_PROMPT,
    CONVERSATION_HISTORY_WINDOW,
    INITIAL_GREETING,
    buildUserMessage,
} from '@/lib/constants';

export type Message = {
    role: 'user' | 'assistant' | 'system';
    content: string;
};

export function useOllama() {
    const [messages, setMessages] = useState<Message[]>([
        { role: 'assistant', content: INITIAL_GREETING }
    ]);
    const [isLoading, setIsLoading] = useState(false);
    const [isModelLoading, setIsModelLoading] = useState(true);
    const [progress, setProgress] = useState<string>('Connecting to Ollama...');
    const [error, setError] = useState<string | null>(null);

    const isConnected = useRef(false);
    const initializingRef = useRef(false);
    const activeModel = useRef(OLLAMA_MODEL);
    // Use a ref to always have the latest messages without re-creating the callback
    const messagesRef = useRef(messages);
    messagesRef.current = messages;

    const checkOllama = useCallback(async () => {
        if (initializingRef.current) return;
        initializingRef.current = true;
        setIsModelLoading(true);
        setError(null);

        try {
            setProgress('Connecting to Ollama...');

            const res = await fetch('/api/ollama', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'check', model: OLLAMA_MODEL }),
            });

            if (!res.ok) {
                throw new Error('Ollama is not running. Please install and start Ollama.');
            }

            const data = await res.json();

            if (!data.connected) {
                throw new Error('Ollama is not running. Install from ollama.com and run: ollama pull ' + OLLAMA_MODEL);
            }

            if (!data.modelAvailable) {
                // Try fallback model
                const fallbackRes = await fetch('/api/ollama', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'check', model: OLLAMA_MODEL_FALLBACK }),
                });
                const fallbackData = await fallbackRes.json();
                if (fallbackData.modelAvailable) {
                    console.log(`Primary model "${OLLAMA_MODEL}" not found, using fallback "${OLLAMA_MODEL_FALLBACK}"`);
                    activeModel.current = fallbackData.matchedModel || OLLAMA_MODEL_FALLBACK;
                } else if (data.availableModels && data.availableModels.length > 0) {
                    const installed = data.availableModels[0];
                    console.log(`Preferred models not found, using installed model "${installed}"`);
                    activeModel.current = installed;
                } else {
                    setProgress(`No model found. Run: ollama pull ${OLLAMA_MODEL}`);
                    throw new Error(`Model not found. Run: ollama pull ${OLLAMA_MODEL} or ollama pull ${OLLAMA_MODEL_FALLBACK}`);
                }
            } else {
                activeModel.current = data.matchedModel || OLLAMA_MODEL;
            }

            isConnected.current = true;
            setIsModelLoading(false);
            setProgress('Ready.');
            setError(null);
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            console.error('Ollama connection error:', error.message);
            setError(error.message);
            setIsModelLoading(false);
            setProgress('Disconnected');
            isConnected.current = false;
        } finally {
            initializingRef.current = false;
        }
    }, []);

    useEffect(() => {
        checkOllama();
    }, [checkOllama]);

    const addCachedMessage = useCallback((userMessage: string, aiMessage: string) => {
        setMessages(prev => [
            ...prev,
            { role: 'user', content: userMessage },
            { role: 'assistant', content: aiMessage }
        ]);
    }, []);

    const clearMessages = useCallback(() => {
        setMessages([{ role: 'assistant', content: INITIAL_GREETING }]);
        if (typeof window !== 'undefined') {
            localStorage.removeItem('the_archive_chat_history');
        }
    }, []);

    const onChat = useCallback(async (userMessage: string, context?: string): Promise<string | undefined> => {
        setIsLoading(true);
        setError(null);

        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);

        try {
            const finalUserMessage = buildUserMessage(userMessage, context);

            // Read from ref to get previous conversation history up to window limit
            const currentMessages = messagesRef.current;
            const chatMessages = [
                { role: 'system', content: SYSTEM_PROMPT },
                ...currentMessages.slice(-CONVERSATION_HISTORY_WINDOW),
                { role: 'user', content: finalUserMessage }
            ];

            const res = await fetch('/api/ollama', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'chat',
                    model: activeModel.current,
                    messages: chatMessages,
                    stream: true,
                }),
            });

            if (!res.ok) {
                throw new Error('Failed to get response from Ollama. Is it still running?');
            }

            const reader = res.body?.getReader();
            if (!reader) throw new Error('No response stream');

            const decoder = new TextDecoder();
            let fullResponse = '';

            setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const text = decoder.decode(value);
                const lines = text.split('\n').filter(line => line.trim());

                for (const line of lines) {
                    try {
                        const json = JSON.parse(line);
                        if (json.message?.content) {
                            fullResponse += json.message.content;
                            setMessages(prev => {
                                const updated = [...prev];
                                updated[updated.length - 1] = {
                                    ...updated[updated.length - 1],
                                    content: fullResponse,
                                };
                                return updated;
                            });
                        }
                    } catch {
                        // skip malformed JSON lines
                    }
                }
            }
            return fullResponse;
        } catch (err: unknown) {
            console.error('Chat Error:', err);
            setError(err instanceof Error ? err.message : String(err));
            return undefined;
        } finally {
            setIsLoading(false);
        }
    }, []); // No dependency on messages — uses ref instead

    return {
        messages,
        isLoading,
        isModelLoading,
        progress,
        error,
        onChat,
        addCachedMessage,
        clearMessages,
        retryConnection: checkOllama,
        modelName: activeModel.current,
    };
}
