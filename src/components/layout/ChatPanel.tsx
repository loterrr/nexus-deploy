'use client';

import { useState, useRef, useEffect } from 'react';
import { useWebLLM } from '@/hooks/useWebLLM';
import { Send, Loader2, RefreshCw, FileText, Download, FileDown, Trash2, ExternalLink } from 'lucide-react';
import { clsx } from 'clsx';
import type { PipelineMode } from '@/lib/constants';
import { DEFAULT_PIPELINE_MODE, INITIAL_GREETING } from '@/lib/constants';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { ResearchCoordinator } from '@/services/researchCoordinator';

interface ChatFloatProps {
  onOpenFile?: (filename: string, page?: number) => void;
  headerActions?: React.ReactNode;
}

interface CitationItem {
  filename: string;
  page?: number;
}

function extractCitations(content: string): CitationItem[] {
  const regex = /\[Source: ([^,\]]+)(?:,\s*Page\s*(\d+))?\]/g;
  const matches: CitationItem[] = [];
  const seen = new Set<string>();
  let match;
  while ((match = regex.exec(content)) !== null) {
    const filename = match[1].trim();
    const page = match[2] ? parseInt(match[2], 10) : undefined;
    const key = `${filename}:${page || 0}`;
    if (!seen.has(key)) {
      seen.add(key);
      matches.push({ filename, page });
    }
  }
  return matches;
}

export default function ChatFloat({ onOpenFile, headerActions }: ChatFloatProps) {
  const { messages, isLoading, isModelLoading, progress, progressRatio, error, onChat, addCachedMessage, clearMessages, retryConnection, modelName } = useWebLLM();
  const [input, setInput] = useState('');
  const [activeContextCount, setActiveContextCount] = useState(0);
  const [pipelineMode, setPipelineMode] = useState<PipelineMode>(DEFAULT_PIPELINE_MODE);
  const [pipelineTiming, setPipelineTiming] = useState<string>('');
  const [fileCreationStatus, setFileCreationStatus] = useState<string>('');
  const [isCachedHit, setIsCachedHit] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);

  useEffect(() => {
    if (scrollRef.current && !isUserScrolling) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;

      if (isNearBottom) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }
  }, [messages, isLoading, fileCreationStatus, isUserScrolling]);

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


  const exportChat = () => {
    const content = messages
      .map(m => `**${m.role}**: ${m.content}`)
      .join('\n\n');

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `the-archive-synthesis-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClearChatAndCache = async () => {
    clearMessages();
    await ResearchCoordinator.getInstance().clearSession();
    setIsCachedHit(false);
    setActiveContextCount(0);
  };

  const transformMessage = (content: string) => {
    return content.replace(/\[Source: ([^,\]]+)(?:,\s*Page\s*(\d+))?\]/g, (_, filename, page) => {
      const pageParam = page ? `&page=${page}` : '';
      return `[[Source: ${filename}${page ? `, p.${page}` : ''}]](#open-pdf-${encodeURIComponent(filename)}${pageParam})`;
    });
  };

  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || isModelLoading) return;

    const userQuery = input;
    setInput('');
    setActiveContextCount(0);
    setFileCreationStatus('');

    try {
      setIsCachedHit(false);
      const coordinator = ResearchCoordinator.getInstance();

      const currentMessages = messagesRef.current;
      const lastMessage = currentMessages[currentMessages.length - 1];
      const latestAssistant = lastMessage?.role === 'assistant' ? lastMessage.content : undefined;

      const outcome = await coordinator.ask({
        query: userQuery,
        pipelineMode,
        latestAssistantContent: latestAssistant,
        streamChatFn: async (q, ctx) => {
          return await onChat(q, ctx);
        },
      });

      if (outcome.isCachedHit) {
        setIsCachedHit(true);
        addCachedMessage(userQuery, outcome.answer);
      } else if (outcome.groundedContext.candidateCount > 0) {
        setActiveContextCount(outcome.groundedContext.candidateCount);
        setPipelineTiming(`${outcome.timing.retrievalMs.toFixed(0)}ms`);
      }

      if (outcome.fileCreationResult) {
        if (outcome.fileCreationResult.success && outcome.fileCreationResult.filename) {
          setFileCreationStatus(`✅ File created: ${outcome.fileCreationResult.filename}`);
          setTimeout(() => setFileCreationStatus(''), 3000);
        } else if (outcome.fileCreationResult.error) {
          setFileCreationStatus(`❌ ${outcome.fileCreationResult.error}`);
          setTimeout(() => setFileCreationStatus(''), 5000);
        }
      }
    } catch (err) {
      console.error("Chat Error:", err);
      setFileCreationStatus('');
    }
  };

  const isFreshSession = messages.length === 0 || (messages.length === 1 && messages[0].content === INITIAL_GREETING);
  const displayMessages = messages.filter(m => m.content !== INITIAL_GREETING);

  return (
    <div className="flex-1 h-full bg-white flex flex-col overflow-hidden relative">

      {/* Header Bar */}
      <header className="bg-white/95 backdrop-blur-xs px-5 py-3.5 flex justify-between items-center border-b border-slate-200 shadow-crisp-xs shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2.5">
            <h2 className="font-serif font-bold text-slate-900 text-sm tracking-tight">The Archive</h2>
            <div className="h-3 w-px bg-slate-200" />
            <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${error ? 'bg-rose-500' : isModelLoading ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
                {error ? 'WebGPU Error' : isModelLoading ? 'Loading Engine...' : modelName}
              </span>
              <span className="text-slate-300">·</span>
              <button
                onClick={() => setPipelineMode(m => m === 'baseline' ? 'enhanced' : 'baseline')}
                className={clsx(
                  'px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors border',
                  pipelineMode === 'enhanced'
                    ? 'bg-blue-50 text-blue-800 border-blue-200 font-semibold'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                )}
                title={pipelineMode === 'enhanced' ? 'Enhanced: BM25 + Dense + RRF + Cross-Encoder' : 'Baseline: BM25 + Dense + RRF'}
              >
                {pipelineMode}
              </button>
              {activeContextCount > 0 && !isCachedHit && (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="text-slate-600">
                    {activeContextCount} pass. in {pipelineTiming}
                  </span>
                </>
              )}
              {isCachedHit && (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="text-emerald-700 font-medium">cached</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2">
          {headerActions}
          {displayMessages.length > 0 && (
            <div className="flex items-center gap-1 pl-1 border-l border-slate-200">
              <button
                onClick={handleClearChatAndCache}
                className="text-slate-400 hover:text-rose-600 hover:bg-slate-50 transition-colors p-1.5 rounded-lg border border-transparent hover:border-slate-200"
                title="Clear journal and query cache"
                aria-label="Clear journal and query cache"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={exportChat}
                className="text-slate-400 hover:text-slate-800 hover:bg-slate-50 transition-colors p-1.5 rounded-lg border border-transparent hover:border-slate-200"
                title="Export journal as Markdown"
                aria-label="Export journal as Markdown"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-white scroll-smooth" ref={scrollRef}>

        {isModelLoading && (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-4 animate-in fade-in duration-500 max-w-md mx-auto px-4">
            <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
            <div className="text-center space-y-2 w-full">
              <p className="font-serif font-semibold text-slate-900 text-sm">Initializing In-Browser Neural Engine</p>
              <p className="text-xs text-slate-600 font-mono bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 shadow-crisp-xs break-all leading-relaxed">
                {progress}
              </p>
              {progressRatio > 0 && progressRatio < 1 && (
                <div className="w-full h-1.5 rounded-full bg-slate-100 border border-slate-200 overflow-hidden mt-2">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all duration-300"
                    style={{ width: `${Math.round(progressRatio * 100)}%` }}
                  />
                </div>
              )}
              <p className="text-[10px] text-slate-400 font-mono">
                WebGPU accelerated · Cached permanently in local browser storage
              </p>
            </div>
          </div>
        )}

        {!isModelLoading && isFreshSession && (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 max-w-lg mx-auto py-16 px-6 animate-in fade-in duration-300">
            <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center mb-4 text-slate-800 font-serif font-bold text-xl shadow-crisp-xs">
              A
            </div>
            <h3 className="font-serif font-bold text-slate-900 text-lg text-center mb-2 tracking-tight">
              Scholarly Literature Synthesis
            </h3>
            <p className="text-xs text-slate-500 text-center leading-relaxed mb-6 max-w-md">
              Perform local neural retrieval across indexed manuscripts, extract empirical claims, and inspect source literature with grounded citations.
            </p>

            <div className="w-full space-y-2">
              <p className="text-[10px] font-mono text-slate-400 text-center uppercase tracking-wider mb-2">
                Inquiry Patterns
              </p>
              <div className="flex flex-col gap-1.5 w-full">
                {[
                  "Summarize core methodology and empirical contributions",
                  "Compare architectural trade-offs across indexed manuscripts",
                  "Verify statistical claims and reported evaluation metrics",
                  "Extract primary mathematical definitions and formulations",
                ].map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => setInput(suggestion)}
                    className="text-left px-3.5 py-2.5 rounded-lg border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 text-xs transition-colors shadow-crisp-xs flex items-center justify-between group"
                  >
                    <span className="font-sans font-medium">{suggestion}</span>
                    <span className="font-mono text-[10px] text-slate-400 group-hover:text-blue-600 transition-colors shrink-0 ml-2">↵</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {displayMessages.map((msg, i) => {
          const citations = msg.role === 'assistant' ? extractCitations(msg.content) : [];

          return (
            <div
              key={i}
              className={clsx(
                "flex gap-3 animate-in slide-in-from-bottom-2 duration-300",
                msg.role === 'user' ? "flex-row-reverse" : "flex-row"
              )}
            >
              {/* Scholar / System Monogram */}
              {msg.role === 'user' ? (
                <div
                  className="w-7 h-7 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 text-[10px] font-mono font-semibold text-slate-600 select-none shadow-crisp-xs"
                  title="Scholar Query"
                >
                  Q
                </div>
              ) : (
                <div
                  className="w-7 h-7 rounded-md bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0 text-[11px] font-serif font-bold text-blue-800 select-none shadow-crisp-xs"
                  title="The Archive"
                >
                  A
                </div>
              )}

              {/* Message Content */}
              {msg.role === 'user' ? (
                <div className="p-3.5 sm:p-4 rounded-xl text-sm shadow-crisp-xs max-w-[85%] bg-slate-50 text-slate-900 rounded-tr-sm border border-slate-200">
                  <p className="leading-relaxed whitespace-pre-wrap font-sans font-medium">{msg.content}</p>
                </div>
              ) : (
                <div className="p-4 sm:p-5 rounded-xl text-sm shadow-crisp-xs max-w-[88%] bg-white text-slate-900 rounded-tl-sm border border-slate-200 flex flex-col">
                  {/* Markdown Prose */}
                  <div className="prose prose-sm max-w-none leading-relaxed text-slate-800 prose-headings:font-serif prose-headings:font-semibold prose-headings:text-slate-900 prose-headings:my-2 prose-p:my-1.5 prose-p:text-slate-700 prose-ul:my-1.5 prose-li:my-0.5 prose-strong:text-slate-900 prose-strong:font-semibold prose-code:font-mono prose-code:text-blue-900 prose-code:bg-slate-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:border prose-code:border-slate-200">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        a: ({ href, children, ...props }) => {
                          if (href?.startsWith('#open-pdf-')) {
                            const urlPart = href.replace('#open-pdf-', '');
                            const [encodedFilename, params] = urlPart.split('&page=');
                            const filename = decodeURIComponent(encodedFilename);
                            const page = params ? parseInt(params, 10) : undefined;
                            return (
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  onOpenFile?.(filename, page);
                                }}
                                className="group inline-flex items-center gap-1.5 px-2 py-0.5 my-1 mx-0.5 text-xs font-medium rounded-md bg-blue-50/80 hover:bg-blue-100 border border-blue-200 hover:border-blue-300 text-blue-900 transition-all duration-200 shadow-crisp-xs no-underline align-baseline"
                                title={`Inspect ${filename}${page ? ` at page ${page}` : ''} in literature inspector`}
                              >
                                <FileText className="w-3.5 h-3.5 text-blue-700 shrink-0 group-hover:scale-105 transition-transform" />
                                <span className="font-medium text-slate-800 group-hover:text-blue-950 truncate max-w-[180px]">{filename}</span>
                                {page !== undefined && (
                                  <span className="font-mono text-[10px] px-1 py-0.2 bg-white border border-blue-300 text-blue-800 rounded font-bold">
                                    p.{page}
                                  </span>
                                )}
                                <ExternalLink className="w-2.5 h-2.5 text-blue-600 group-hover:text-blue-700 shrink-0 ml-0.5" />
                              </button>
                            );
                          }
                          return <a href={href} {...props} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:text-blue-800 underline font-medium">{children}</a>;
                        }
                      }}
                    >
                      {transformMessage(msg.content)}
                    </ReactMarkdown>
                  </div>

                  {/* Grounded Citations Shelf */}
                  {citations.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
                          Sources Cited ({citations.length})
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {citations.map((cite, idx) => (
                          <button
                            key={idx}
                            onClick={() => onOpenFile?.(cite.filename, cite.page)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 hover:bg-slate-100/90 border border-slate-200 hover:border-slate-300 text-slate-800 hover:text-slate-950 transition-colors text-xs font-mono group shadow-crisp-xs"
                            title={`Inspect ${cite.filename}${cite.page ? ` (Page ${cite.page})` : ''} in literature inspector`}
                          >
                            <span className="text-[10px] text-blue-700 font-semibold">[{idx + 1}]</span>
                            <span className="truncate max-w-[190px] text-slate-800 group-hover:text-slate-950 font-sans font-medium">
                              {cite.filename}
                            </span>
                            {cite.page && (
                              <span className="text-[10px] text-slate-500 font-semibold">
                                p.{cite.page}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {isLoading && (
          <div className="flex flex-col gap-2 ml-10">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-600 font-mono flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-md border border-slate-200 shadow-crisp-xs">
                <RefreshCw className="w-3 h-3 animate-spin text-blue-600" />
                {activeContextCount > 0 ? `Synthesizing ${activeContextCount} verified citations...` : 'Synthesizing response...'}
              </span>
            </div>
          </div>
        )}

        {fileCreationStatus && (
          <div className="flex flex-col gap-2 ml-10 animate-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center gap-2 bg-emerald-50 px-3 py-2 rounded-md border border-emerald-200 shadow-crisp-xs">
              <span className="text-xs text-emerald-800 font-mono flex items-center gap-1.5">
                <FileDown className="w-3.5 h-3.5 text-emerald-600" />
                {fileCreationStatus}
              </span>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mx-4 mb-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-center justify-between gap-2 shadow-crisp-xs">
          <span>Error: {error}</span>
          <button
            type="button"
            onClick={() => retryConnection()}
            className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[11px] font-semibold transition-colors shrink-0 flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            Retry
          </button>
        </div>
      )}

      {/* Chat Input */}
      <form onSubmit={handleSubmit} className="p-4 bg-white/95 border-t border-slate-200 flex gap-3 shadow-crisp-sm shrink-0 backdrop-blur-xs">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isModelLoading ? "Initializing neural engine..." : "Query the literature, verify claims, or extract findings..."}
          disabled={isModelLoading || isLoading}
          className="flex-1 bg-slate-50/70 hover:bg-slate-50 border border-slate-200 focus:bg-white rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder-slate-400 disabled:opacity-50 shadow-crisp-xs"
        />
        <button
          type="submit"
          disabled={isModelLoading || isLoading || !input.trim()}
          className={clsx(
            "p-3 rounded-xl shadow-crisp-xs transition-all shrink-0",
            isModelLoading || isLoading || !input.trim()
              ? "bg-slate-100 text-slate-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700 text-white active:scale-95 shadow-crisp-sm"
          )}
          aria-label="Send query"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}