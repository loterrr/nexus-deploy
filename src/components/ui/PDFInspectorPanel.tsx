'use client';

import { useEffect, useState } from 'react';
import { X, FileText, Download, Maximize2, Share2, BookOpen, ChevronRight } from 'lucide-react';

interface PDFInspectorPanelProps {
  file: File | null;
  targetPage?: number;
  isOpen: boolean;
  onClose: () => void;
  onExpandModal: () => void;
  onSwitchToGraph?: () => void;
}

export default function PDFInspectorPanel({
  file,
  targetPage,
  isOpen,
  onClose,
  onExpandModal,
  onSwitchToGraph,
}: PDFInspectorPanelProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (file && isOpen) {
      const objectUrl = URL.createObjectURL(file);
      const urlWithPage = targetPage ? `${objectUrl}#page=${targetPage}` : objectUrl;
      setPreviewUrl(urlWithPage);
      return () => URL.revokeObjectURL(objectUrl);
    }
    setPreviewUrl(null);
    return undefined;
  }, [file, isOpen, targetPage]);

  if (!isOpen) return null;

  return (
    <aside
      className="w-[440px] xl:w-[480px] shrink-0 h-full border-l border-slate-200 bg-white flex flex-col z-30 shadow-crisp-sm animate-in slide-in-from-right-4 duration-200"
      aria-label="Literature Inspector"
    >
      {/* Inspector Header */}
      <div className="px-4 py-3 bg-slate-50/95 border-b border-slate-200 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg shrink-0">
            <BookOpen className="w-4 h-4 text-blue-700" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-serif font-bold text-slate-900 truncate max-w-[220px]" title={file?.name || 'Literature Inspector'}>
                {file ? file.name : 'Literature Inspector'}
              </h3>
              {targetPage && (
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-900 border border-amber-200">
                  p.{targetPage}
                </span>
              )}
            </div>
            {file && (
              <p className="text-[10px] text-slate-400 font-mono">
                {(file.size / 1024 / 1024).toFixed(1)} MB · Local PDF
              </p>
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

          {file && (
            <>
              <a
                href={previewUrl || '#'}
                download={file.name}
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

      {/* Main Content: PDF View or Empty State */}
      <div className="flex-1 w-full h-full bg-slate-100 relative overflow-hidden">
        {file && previewUrl ? (
          <iframe
            src={previewUrl}
            className="w-full h-full border-0 bg-white"
            title={`Document Inspector: ${file.name}`}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-400">
            <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-crisp-xs mb-3">
              <FileText className="w-5 h-5 text-slate-400" />
            </div>
            <h4 className="text-xs font-serif font-semibold text-slate-700 mb-1">Literature Inspector</h4>
            <p className="text-[11px] text-slate-400 max-w-[220px] leading-relaxed">
              Select a manuscript from the index or click any citation to view original source pages here.
            </p>
          </div>
        )}
      </div>

      {/* Sub-footer metadata bar */}
      {file && (
        <div className="px-4 py-2 bg-white border-t border-slate-200 text-[11px] font-mono text-slate-500 flex items-center justify-between shrink-0">
          <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
          <span className="flex items-center gap-1 text-slate-400">
            Local IndexedDB <ChevronRight className="w-3 h-3" />
          </span>
        </div>
      )}
    </aside>
  );
}
