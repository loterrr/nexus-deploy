'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useWebLLM } from '@/hooks/useWebLLM';
import { Send, Bot, User, Loader2, Minimize2, RefreshCw, FileText, Download, BrainCircuit, FileDown, GripVertical } from 'lucide-react';
import { clsx } from 'clsx';
import { VectorStore } from '@/services/vectorStore';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { DeepResearchService } from '@/services/DeepResearch';
import { FileCreationService } from '@/services/fileCreationService';

interface ChatFloatProps {
  onOpenFile?: (filename: string, page?: number) => void;
}

export default function ChatFloat({ onOpenFile }: ChatFloatProps) {
  const { messages, isLoading, isModelLoading, progress, error, onChat, engine } = useWebLLM();
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeContextCount, setActiveContextCount] = useState(0);
  const [isDeepMode, setIsDeepMode] = useState(false);
  const [deepStatus, setDeepStatus] = useState<string>('');
  const [fileCreationStatus, setFileCreationStatus] = useState<string>('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const [size, setSize] = useState({ width: 500, height: 600 });
  const isResizing = useRef(false);
  const resizeStart = useRef({ x: 0, y: 0, width: 500, height: 600 });

  useEffect(() => {
    if (scrollRef.current && !isUserScrolling) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;

      if (isNearBottom) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }
  }, [messages, isLoading, deepStatus, fileCreationStatus, isUserScrolling]);

  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollElement;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
      setIsUserScrolling(!isAtBottom);
    };

    scrollElement.addEventListener('scroll', handleScroll);
    return () => scrollElement.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('the_archive_chat_history');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
        }
      } catch (err) {
        console.error('Failed to load chat history:', err);
      }
    }
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('the_archive_chat_history', JSON.stringify(messages));
    }
  }, [messages]);


  useEffect(() => {
    const savedSize = localStorage.getItem('the_archive_chat_size');
    if (savedSize) {
      try {
        setSize(JSON.parse(savedSize));
      } catch (e) {
        console.error('Failed to load chat size:', e);
      }
    }
  }, []);


  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    resizeStart.current = {
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;

      const deltaX = resizeStart.current.x - e.clientX;
      const deltaY = resizeStart.current.y - e.clientY;

      const newWidth = Math.max(350, Math.min(800, resizeStart.current.width + deltaX));
      const newHeight = Math.max(400, Math.min(900, resizeStart.current.height + deltaY));

      setSize({ width: newWidth, height: newHeight });
    };

    const handleMouseUp = () => {
      isResizing.current = false;
      localStorage.setItem('the_archive_chat_size', JSON.stringify(size));
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [size]);

  const exportChat = () => {
    const content = messages
      .map(m => `**${m.role}**: ${m.content}`)
      .join('\n\n');

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `the-archive-chat-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const transformMessage = (content: string) => {
    const transformed = content.replace(/\[Source: ([^,\]]+)(?:,\s*Page\s*(\d+))?\]/g, (_, filename, page) => {
      console.log('📎 Found citation:', filename, page ? `Page ${page}` : '');
      const pageParam = page ? `&page=${page}` : '';
      return `[[Source: ${filename}${page ? `, p.${page}` : ''}]](#open-pdf-${encodeURIComponent(filename)}${pageParam})`;
    });

    if (transformed !== content) {
      console.log('✨ Citations transformed in message');
    }

    return transformed;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || isModelLoading) return;

    const userQuery = input;
    setInput('');
    setActiveContextCount(0);
    setDeepStatus('');
    setFileCreationStatus('');

    const isFileCreation = FileCreationService.detectFileCreationIntent(userQuery);

    try {
      if (isDeepMode && engine) {
        const service = new DeepResearchService(engine);

        const researchResult = await service.runDeepResearch(userQuery, (step) => {
          setDeepStatus(step);
        });

        setDeepStatus('');

        await onChat(userQuery, `RESEARCH REPORT:\n${researchResult}\n\nINSTRUCTION: The above is the answer. Please output it exactly as is, or slightly polished.`);

      } else {
        console.log(`🔎 Searching Knowledge Base for: "${userQuery}"`);
        let context = '';
        try {
          const vectorStore = VectorStore.getInstance();
          const results = await vectorStore.search(userQuery, 12);
          if (results.length > 0) {
            console.log(`Found ${results.length} relevant snippets.`);
            setActiveContextCount(results.length);
            context = results.map(r => {
              const page = r.doc.metadata.pageNumber || 1;
              return `[Source: ${r.doc.metadata.source}, Page ${page}]\n${r.doc.content}`;
            }).join('\n\n---\n\n');
          }
        } catch (err) {
          console.error("Vector Search Failed:", err);
        }
        await onChat(userQuery, context || undefined);
      }

      if (isFileCreation) {
        setFileCreationStatus('Creating file...');

        setTimeout(async () => {
          const lastMessage = messages[messages.length - 1];
          const aiResponse = lastMessage?.role === 'assistant' ? lastMessage.content : undefined;

          const result = await FileCreationService.handleFileCreation(userQuery, aiResponse);

          if (result.success && result.filename) {
            setFileCreationStatus(`✅ File created: ${result.filename}`);

            setTimeout(() => setFileCreationStatus(''), 3000);
          } else if (result.error) {
            setFileCreationStatus(`❌ ${result.error}`);
            setTimeout(() => setFileCreationStatus(''), 5000);
          }
        }, 1500);
      }

    } catch (err) {
      console.error("Chat Error:", err);
      setDeepStatus('');
      setFileCreationStatus('');
    }
  };

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
    <div
      className={clsx(
        "fixed bg-slate-900 border border-slate-700 rounded-xl shadow-2xl flex flex-col overflow-hidden z-50",
        "bottom-2 left-2 right-2 h-[80vh]",
        "md:bottom-6 md:right-6 md:left-auto"
      )}
      style={{
        width: typeof window !== 'undefined' && window.innerWidth >= 768 ? size.width : undefined,
        height: typeof window !== 'undefined' && window.innerWidth >= 768 ? size.height : undefined
      }}
    >

      <div
        onMouseDown={handleResizeStart}
        className="hidden md:flex absolute -top-1 -left-1 w-6 h-6 cursor-nw-resize items-center justify-center z-10 bg-slate-800 rounded-tl-xl border-r border-b border-slate-700 hover:bg-slate-700 transition-colors"
        title="Drag to resize"
      >
        <GripVertical className="w-3 h-3 text-slate-500 rotate-45" />
      </div>

      <div className="bg-slate-800 p-4 flex justify-between items-center border-b border-slate-700 shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full ${isModelLoading ? 'bg-yellow-500 animate-pulse' : 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]'}`} />
          <div className="flex flex-col">
            <span className="font-bold text-slate-100 text-sm tracking-wide">THE ARCHIVE RESEARCH AI</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider">
                {isModelLoading ? 'Loading Model...' : 'Ready'}
              </span>
              {!isModelLoading && (
                <button
                  onClick={() => setIsDeepMode(!isDeepMode)}
                  className={clsx(
                    "text-[10px] px-1.5 py-0.5 rounded border transition-colors flex items-center gap-1",
                    isDeepMode
                      ? "bg-indigo-500/20 border-indigo-500/50 text-indigo-300"
                      : "border-slate-700 text-slate-500 hover:text-slate-300"
                  )}
                  title="Deep Research Mode: Decomposes queries for better accuracy (slower)"
                >
                  <BrainCircuit className="w-3 h-3" />
                  {isDeepMode ? 'DEEP' : 'FAST'}
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {messages.length > 0 && (
            <button
              onClick={exportChat}
              className="text-slate-400 hover:text-white transition-colors p-1 rounded-md hover:bg-slate-700"
              title="Export chat (Ctrl+E)"
            >
              <Download className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setIsOpen(false)}
            className="text-slate-400 hover:text-white transition-colors p-1 rounded-md hover:bg-slate-700"
            title="Minimize (Esc)"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-950/50 scroll-smooth" ref={scrollRef}>


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


        {!isModelLoading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-4 opacity-60">
            <div className="bg-slate-800/50 p-4 rounded-full">
              <FileText className="w-8 h-8 text-cyan-500/50" />
            </div>
            <div className="text-center max-w-[250px]">
              <p className="text-sm font-medium text-slate-300">Upload your PDF</p>
              <p className="text-xs mt-1">Ask questions about your thesis, referencing, or grammar.</p>
            </div>
          </div>
        )}


        {messages.map((msg, i) => (
          <div key={i} className={clsx("flex gap-4 animate-in slide-in-from-bottom-2 duration-300", msg.role === 'user' ? "flex-row-reverse" : "")}>


            <div className={clsx(
              "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-md",
              msg.role === 'user' ? "bg-indigo-600" : "bg-cyan-700"
            )}>
              {msg.role === 'user' ? <User className="w-5 h-5 text-white" /> : <Bot className="w-5 h-5 text-white" />}
            </div>


            <div className={clsx(
              "p-4 rounded-2xl text-sm shadow-sm max-w-[85%]",
              msg.role === 'user'
                ? "bg-indigo-600 text-white rounded-tr-sm"
                : "bg-slate-800 text-slate-200 rounded-tl-sm border border-slate-700/50"
            )}>

              {msg.role === 'assistant' ? (
                <div className="prose prose-sm prose-invert max-w-none leading-relaxed prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-li:my-0 prose-strong:text-cyan-400">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      a: ({ node, href, children, ...props }) => {
                        if (href?.startsWith('#open-pdf-')) {
                          const urlPart = href.replace('#open-pdf-', '');
                          const [encodedFilename, params] = urlPart.split('&page=');
                          const filename = decodeURIComponent(encodedFilename);
                          const page = params ? parseInt(params) : undefined;
                          return (
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                onOpenFile?.(filename, page);
                              }}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 mt-1 text-xs font-medium text-cyan-200 bg-cyan-900/40 rounded hover:bg-cyan-800/60 transition-colors border border-cyan-800/50 no-underline"
                              title={`Open ${filename}${page ? ` at page ${page}` : ''}`}
                            >
                              <FileText className="w-3 h-3" />
                              {children}
                            </button>
                          );
                        }
                        return <a href={href} {...props} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300 underline">{children}</a>
                      }
                    }}
                  >
                    {transformMessage(msg.content)}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="leading-relaxed">{msg.content}</p>
              )}
            </div>
          </div>
        ))}


        {(isLoading || deepStatus) && (
          <div className="flex flex-col gap-2 animate-pulse ml-12">
            <div className="flex items-center gap-2">
              <span className="text-xs text-cyan-500 font-mono flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin" />
                {deepStatus ? deepStatus : (activeContextCount > 0 ? `Analyzing ${activeContextCount} citations...` : 'Thinking...')}
              </span>
            </div>
          </div>
        )}


        {fileCreationStatus && (
          <div className="flex flex-col gap-2 ml-12 animate-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center gap-2 bg-slate-800/50 px-3 py-2 rounded-lg border border-slate-700">
              <span className="text-xs text-green-400 font-mono flex items-center gap-1">
                <FileDown className="w-3 h-3" />
                {fileCreationStatus}
              </span>
            </div>
          </div>
        )}
      </div>


      <form onSubmit={handleSubmit} className="p-4 bg-slate-800 border-t border-slate-700 flex gap-3 shadow-[0_-4px_12px_rgba(0,0,0,0.2)] shrink-0">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isModelLoading ? "Initializing..." : "Ask about your paper..."}
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