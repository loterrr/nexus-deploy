'use client';

import { useState, useRef, useEffect } from 'react';
import { useWebLLM } from '@/hooks/useWebLLM';
import { Send, Bot, User, Loader2, Minimize2, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';
import { VectorStore } from '@/services/vectorStore';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function ChatFloat() {
  const { messages, isLoading, isModelLoading, progress, error, onChat } = useWebLLM();
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logic
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || isModelLoading) return;

    const userQuery = input;
    setInput('');

    try {
      // 1. Search Vector Store
      console.log(`🔎 Searching: "${userQuery}"`);
      let context = '';
      try {
        const vectorStore = VectorStore.getInstance();
        const results = await vectorStore.search(userQuery, 4); 
        if (results.length > 0) {
            context = results.map(r => r.content).join('\n\n');
        }
      } catch (err) {
        console.error("Vector Search Failed:", err);
      }

      // 2. Send to AI
      await onChat(userQuery, context);
    } catch (err) {
      console.error("Chat Error:", err);
    }
  };

  // Minimized State (Button Only)
  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 md:bottom-8 md:right-8 bg-cyan-600 hover:bg-cyan-500 text-white p-4 rounded-full shadow-lg transition-all z-50 animate-bounce-subtle"
      >
        <Bot className="w-6 h-6" />
      </button>
    );
  }

  return (
    // RESPONSIVE CONTAINER:
    // Mobile: bottom-2, left-2, right-2, height 80vh (Full width floating card)
    // Desktop (md): bottom-6, right-6, width 450px, height 700px (Fixed corner widget)
    <div className={clsx(
        "fixed bg-slate-900 border border-slate-700 rounded-xl shadow-2xl flex flex-col overflow-hidden z-50 transition-all duration-300",
        "bottom-2 left-2 right-2 h-[80vh]", 
        "md:bottom-6 md:right-6 md:left-auto md:w-[450px] md:h-[700px]"
    )}>
      
      {/* Header */}
      <div className="bg-slate-800 p-4 flex justify-between items-center border-b border-slate-700 shadow-sm shrink-0">
        <div className="flex items-center gap-3">
            <div className={`w-2.5 h-2.5 rounded-full ${isModelLoading ? 'bg-yellow-500 animate-pulse' : 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]'}`} />
            <div className="flex flex-col">
                <span className="font-bold text-slate-100 text-sm tracking-wide">NEXUS AI</span>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider">Local Private RAG</span>
            </div>
        </div>
        <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white transition-colors p-1 rounded-md hover:bg-slate-700">
            <Minimize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-950/50 scroll-smooth" ref={scrollRef}>
        
        {/* Loading State */}
        {isModelLoading && (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-6 animate-in fade-in duration-500">
                <div className="relative">
                    <div className="absolute inset-0 bg-cyan-500 blur-xl opacity-20 rounded-full"></div>
                    <Loader2 className="w-10 h-10 animate-spin text-cyan-500 relative z-10" />
                </div>
                <div className="text-center space-y-2">
                    <p className="font-medium text-slate-200">Initializing Neural Engine</p>
                    <p className="text-xs text-slate-500 font-mono bg-slate-900/50 px-3 py-1 rounded-full border border-slate-800">{progress}</p>
                </div>
            </div>
        )}

        {/* Empty State */}
        {!isModelLoading && messages.length === 0 && (
             <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-4 opacity-60">
                <Bot className="w-12 h-12 text-slate-700" />
                <p className="text-sm">Ready to analyze your documents.</p>
             </div>
        )}

        {/* Message List */}
        {messages.map((msg, i) => (
          <div key={i} className={clsx("flex gap-4 animate-in slide-in-from-bottom-2 duration-300", msg.role === 'user' ? "flex-row-reverse" : "")}>
            
            {/* Avatar */}
            <div className={clsx(
                "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-md",
                msg.role === 'user' ? "bg-indigo-600" : "bg-cyan-700"
            )}>
                {msg.role === 'user' ? <User className="w-5 h-5 text-white" /> : <Bot className="w-5 h-5 text-white" />}
            </div>

            {/* Bubble */}
            <div className={clsx(
                "p-4 rounded-2xl text-sm shadow-sm max-w-[85%]",
                msg.role === 'user' 
                    ? "bg-indigo-600 text-white rounded-tr-sm" 
                    : "bg-slate-800 text-slate-200 rounded-tl-sm border border-slate-700/50"
            )}>
                {/* MARKDOWN RENDERER */}
                {msg.role === 'assistant' ? (
                    <div className="prose prose-sm prose-invert max-w-none leading-relaxed prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-li:my-0">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {msg.content}
                        </ReactMarkdown>
                    </div>
                ) : (
                    <p className="leading-relaxed">{msg.content}</p>
                )}
            </div>
          </div>
        ))}

        {/* Thinking Indicator */}
        {isLoading && (
             <div className="flex gap-3 animate-pulse">
                 <div className="w-8 h-8 rounded-lg bg-cyan-900/30 flex items-center justify-center">
                    <RefreshCw className="w-4 h-4 animate-spin text-cyan-500" />
                 </div>
                 <span className="text-xs text-slate-500 self-center font-medium">Nexus is thinking...</span>
             </div>
        )}
      </div>

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="p-4 bg-slate-800 border-t border-slate-700 flex gap-3 shadow-[0_-4px_12px_rgba(0,0,0,0.2)] shrink-0">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isModelLoading ? "Initializing..." : "Ask a question..."}
          disabled={isModelLoading || isLoading}
          className="flex-1 bg-slate-900/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all placeholder-slate-500"
        />
        <button 
            type="submit" 
            disabled={isModelLoading || isLoading}
            className="bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:text-slate-500 text-white p-3 rounded-xl shadow-lg hover:shadow-cyan-500/20 transition-all active:scale-95"
        >
            <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}
