'use client';

import { useEffect, useState } from 'react';
import { X, FileText, Download } from 'lucide-react';

interface PDFPreviewModalProps {
  file: File | null;
  isOpen: boolean;
  targetPage?: number;
  onClose: () => void;
}

export default function PDFPreviewModal({ file, isOpen, targetPage, onClose }: PDFPreviewModalProps) {
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

  if (!isOpen || !file) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">

      {/* Modal Content */}
      <div className="bg-white w-full max-w-6xl h-[90vh] rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50/95 backdrop-blur-xs">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl shadow-crisp-xs text-blue-700">
              <FileText className="w-4 h-4 text-blue-700" />
            </div>
            <div>
              <h3 className="font-serif font-semibold text-slate-900 text-sm truncate max-w-md">{file.name}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-slate-500 font-mono">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-xs text-slate-500">Academic PDF</span>
                {targetPage && (
                  <>
                    <span className="text-slate-300">•</span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-900">
                      Page {targetPage}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <a
              href={previewUrl || '#'}
              download={file.name}
              className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors border border-transparent hover:border-slate-200"
              title="Download PDF"
              aria-label="Download PDF"
            >
              <Download className="w-4 h-4" />
            </a>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-colors border border-transparent hover:border-slate-200"
              title="Close viewer"
              aria-label="Close viewer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* PDF Viewer (Iframe) */}
        <div className="flex-1 bg-slate-100 relative">
          {previewUrl ? (
            <iframe
              src={previewUrl}
              className="w-full h-full border-none"
              title="PDF Preview"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-slate-500">
              Loading preview...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}