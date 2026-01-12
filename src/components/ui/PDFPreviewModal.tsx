'use client';

import { useEffect, useState } from 'react';
import { X, FileText, Download } from 'lucide-react';

interface PDFPreviewModalProps {
  file: File | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function PDFPreviewModal({ file, isOpen, onClose }: PDFPreviewModalProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (file && isOpen) {
      // 1. Create a temporary local URL for the file in memory
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);

      // 2. Cleanup: Free up memory when we close the modal
      return () => URL.revokeObjectURL(objectUrl);
    } else {
      setPreviewUrl(null);
    }
  }, [file, isOpen]);

  if (!isOpen || !file) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      
      {/* Modal Content */}
      <div className="bg-slate-900 w-full max-w-6xl h-[90vh] rounded-2xl border border-slate-700 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-indigo-500/20 rounded-lg">
                <FileText className="w-5 h-5 text-indigo-400" />
             </div>
             <div>
                 <h3 className="font-semibold text-slate-100 truncate max-w-md">{file.name}</h3>
                 <p className="text-xs text-slate-400">
                    {(file.size / 1024 / 1024).toFixed(2)} MB • PDF Document
                 </p>
             </div>
          </div>
          
          <div className="flex items-center gap-2">
             <a 
                href={previewUrl || '#'} 
                download={file.name}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                title="Download"
             >
                <Download className="w-5 h-5" />
             </a>
             <button 
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
             >
                <X className="w-6 h-6" />
             </button>
          </div>
        </div>

        {/* PDF Viewer (Iframe) */}
        <div className="flex-1 bg-slate-950 relative">
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