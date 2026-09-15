'use client';

import { useEffect, useState } from 'react';
import { X, FileText, Download, Maximize2, Share2, BookOpen, ChevronRight } from 'lucide-react';
import { VectorStore, DocumentChunk } from '@/services/vectorStore';
import { clsx } from 'clsx';

interface PDFInspectorPanelProps {
  file: File | null;
  files?: File[];
  targetPage?: number;
  isOpen: boolean;
  onClose: () => void;
  onExpandModal: () => void;
  onSwitchToGraph?: () => void;
  onSelectFile?: (file: File) => void;
}

export default function PDFInspectorPanel({
  file,
  files = [],
  targetPage,
  isOpen,
  onClose,
  onExpandModal,
  onSwitchToGraph,
  onSelectFile,
}: PDFInspectorPanelProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'pdf' | 'chunks'>('pdf');
  const [chunks, setChunks] = useState<DocumentChunk[]>([]);
  const [searchChunkQuery, setSearchChunkQuery] = useState('');

  // Determine active file: use provided file or fallback to first file in list
  const activeFile = file || (files.length > 0 ? files[0] : null);

  useEffect(() => {
    if (activeFile && isOpen) {
      const objectUrl = URL.createObjectURL(activeFile);
      const urlWithPage = targetPage ? `${objectUrl}#page=${targetPage}` : objectUrl;
      setPreviewUrl(urlWithPage);

      // Load indexed chunks from VectorStore
      try {
        const store = VectorStore.getInstance();
        const docChunks = store.getDocumentChunks(activeFile.name);
        setChunks(docChunks);
      } catch (err) {
        console.warn('Could not load document chunks:', err);
        setChunks([]);
      }

      return () => URL.revokeObjectURL(objectUrl);
    }
    setPreviewUrl(null);
    setChunks([]);
    return undefined;
  }, [activeFile, isOpen, targetPage]);

  if (!isOpen) return null;

  const filteredChunks = searchChunkQuery.trim()
    ? chunks.filter(c => c.content.toLowerCase().includes(searchChunkQuery.toLowerCase()))
    : chunks;

  return (
    <>
      {/* Overlay Backdrop for Mobile / Small Screens (< 1024px) */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 lg:hidden animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className="fixed lg:relative inset-y-0 right-0 z-50 lg:z-30 w-full sm:w-[480px] lg:w-[440px] xl:w-[480px] shrink-0 h-full border-l border-slate-200 bg-white flex flex-col shadow-2xl lg:shadow-crisp-sm animate-in slide-in-from-right duration-200"
        aria-label="Literature Inspector"
      >
        {/* Inspector Header */}
        <div className="px-4 py-3 bg-slate-50/95 border-b border-slate-200 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-1.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg shrink-0">
                <BookOpen className="w-4 h-4 text-blue-700" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
                  Literature Inspector
                </span>
                {targetPage && (
                  <span className="ml-2 text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-900 border border-amber-200">
                    p.{targetPage}
                  </span>
                )}
              </div>
            </div>

            {/* Toolbar Controls */}
            <div className="flex items-center gap-1">
              {onSwitchToGraph && (
                <button
                  onClick={onSwitchToGraph}
                  className="p-1.5 text-slate-500 hover:text-indigo-700 hover:bg-slate-100 rounded-lg transition-colors border border-transparent hover:border-slate-200"
                  title="Switch to Knowledge Graph"
                  aria-label="Switch to Knowledge Graph"
                >
                  <Share2 className="w-4 h-4" />
                </button>
              )}

              {activeFile && (
                <>
                  <a
                    href={previewUrl || '#'}
                    download={activeFile.name}
                    className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors border border-transparent hover:border-slate-200"
                    title="Download PDF"
                    aria-label="Download PDF"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                  <button
                    onClick={onExpandModal}
                    className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-slate-100 rounded-lg transition-colors border border-transparent hover:border-slate-200"
                    title="Expand to Full Screen Reader"
                    aria-label="Expand to Full Screen Reader"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                </>
              )}

              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-colors border border-transparent hover:border-slate-200 ml-0.5"
                title="Close literature inspector"
                aria-label="Close literature inspector"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Manuscript Selector Dropdown */}
          {files.length > 0 ? (
            <div className="flex items-center gap-2">
              <select
                value={activeFile?.name || ''}
                onChange={(e) => {
                  const selected = files.find(f => f.name === e.target.value);
                  if (selected && onSelectFile) {
                    onSelectFile(selected);
                  }
                }}
                className="w-full text-xs font-serif font-medium text-slate-900 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-crisp-xs focus:outline-none focus:ring-1 focus:ring-blue-500 truncate cursor-pointer"
                title="Select manuscript to inspect"
              >
                {files.map((f) => (
                  <option key={f.name} value={f.name}>
                    {f.name} ({(f.size / 1024 / 1024).toFixed(1)} MB)
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">No manuscripts uploaded</p>
          )}

          {/* Sub-tabs: PDF Reader vs Extracted Chunks */}
          {activeFile && (
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-200/80">
              <button
                onClick={() => setActiveTab('pdf')}
                className={clsx(
                  "flex-1 text-center py-1 px-2 text-[11px] font-medium rounded-md transition-all",
                  activeTab === 'pdf'
                    ? "bg-white text-blue-700 shadow-crisp-xs border border-slate-200 font-semibold"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                )}
              >
                PDF Reader
              </button>
              <button
                onClick={() => setActiveTab('chunks')}
                className={clsx(
                  "flex-1 text-center py-1 px-2 text-[11px] font-medium rounded-md transition-all flex items-center justify-center gap-1.5",
                  activeTab === 'chunks'
                    ? "bg-white text-blue-700 shadow-crisp-xs border border-slate-200 font-semibold"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                )}
              >
                <span>Indexed Chunks</span>
                {chunks.length > 0 && (
                  <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded-full text-[9px] font-mono">
                    {chunks.length}
                  </span>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Main Content Area */}
        <div className="flex-1 w-full h-full bg-slate-100 relative overflow-hidden flex flex-col">
          {!activeFile ? (
            <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-400">
              <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-crisp-xs mb-3">
                <FileText className="w-5 h-5 text-slate-400" />
              </div>
              <h4 className="text-xs font-serif font-semibold text-slate-700 mb-1">Literature Inspector</h4>
              <p className="text-[11px] text-slate-400 max-w-[240px] leading-relaxed">
                Upload or select a manuscript from the Archival Index to inspect original pages and indexed vector chunks.
              </p>
            </div>
          ) : activeTab === 'pdf' ? (
            previewUrl ? (
              <div className="w-full h-full relative flex flex-col">
                <iframe
                  src={previewUrl}
                  className="w-full h-full border-0 bg-white"
                  title={`Document Inspector: ${activeFile.name}`}
                />
                {/* Fallback bar in case browser plugin blocks iframe */}
                <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-500 flex items-center justify-between shrink-0">
                  <span>If PDF preview is blocked by browser:</span>
                  <button
                    onClick={() => setActiveTab('chunks')}
                    className="text-blue-600 hover:underline font-semibold"
                  >
                    View Indexed Text Chunks →
                  </button>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Loading manuscript preview...
              </div>
            )
          ) : (
            /* Indexed Chunks View */
            <div className="w-full h-full flex flex-col bg-slate-50">
              <div className="p-2.5 border-b border-slate-200 bg-white shrink-0">
                <input
                  type="text"
                  placeholder={`Search ${chunks.length} chunks...`}
                  value={searchChunkQuery}
                  onChange={(e) => setSearchChunkQuery(e.target.value)}
                  className="w-full px-2.5 py-1 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                {filteredChunks.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400">
                    {searchChunkQuery ? 'No chunks match search query.' : 'No chunks found for this manuscript.'}
                  </div>
                ) : (
                  filteredChunks.map((chunk, idx) => (
                    <div
                      key={chunk.id || idx}
                      className={clsx(
                        "p-3 rounded-lg border bg-white shadow-crisp-xs text-left transition-all",
                        targetPage && chunk.metadata.pageNumber === targetPage
                          ? "border-blue-300 ring-1 ring-blue-200 bg-blue-50/20"
                          : "border-slate-200"
                      )}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                          Chunk #{chunk.metadata.chunkIdx ?? idx + 1}
                        </span>
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
                          Page {chunk.metadata.pageNumber}
                        </span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-slate-700 whitespace-pre-wrap font-sans">
                        {chunk.content}
                      </p>
                      <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[9px] font-mono text-slate-400">
                        <span>{chunk.content.length} characters</span>
                        {chunk.embedding && <span>Dim: {chunk.embedding.length}</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sub-footer metadata bar */}
        {activeFile && (
          <div className="px-4 py-2 bg-white border-t border-slate-200 text-[11px] font-mono text-slate-500 flex items-center justify-between shrink-0">
            <span>{(activeFile.size / 1024 / 1024).toFixed(2)} MB</span>
            <span className="flex items-center gap-1 text-slate-400">
              {chunks.length} chunks indexed <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        )}
      </aside>
    </>
  );
}
