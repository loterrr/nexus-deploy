'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Loader2, Trash2, FileText, Database, BookOpen } from 'lucide-react';
import { extractTextFromPDF } from '@/services/pdfParser';
import { VectorStore } from '@/services/vectorStore';
import { RetrievalPipeline } from '@/services/retrievalPipeline';
import { QueryCacheService } from '@/services/queryCache';
import { validateFile } from '@/lib/validation';
import { clsx } from 'clsx';
import { useToast } from '@/components/ui/Toast';

interface DocumentExplorerProps {
  files: File[];
  setFiles: React.Dispatch<React.SetStateAction<File[]>>;
  onFileSelect: (file: File) => void;
  onDocumentAdded: (filename: string) => void;
  graphData: {
    nodes: { id: string; group: number }[];
    links: { source: string | { id: string }; target: string | { id: string }; label?: string; value?: number }[];
  };
}

export default function DocumentExplorer({
  files,
  setFiles,
  onFileSelect,
  onDocumentAdded,
  graphData
}: DocumentExplorerProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const { showToast, confirm } = useToast();

  const getBookConnectionsCount = (filename: string): number => {
    let count = 0;
    graphData.links.forEach(link => {
      const source = typeof link.source === 'object' ? (link.source as { id: string }).id : link.source;
      const target = typeof link.target === 'object' ? (link.target as { id: string }).id : link.target;
      if ((source === filename && target !== 'The Archive Root') || 
          (target === filename && source !== 'The Archive Root')) {
        count++;
      }
    });
    return count;
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setIsProcessing(true);
    const store = VectorStore.getInstance();
    let anyAdded = false;

    for (const file of acceptedFiles) {
      try {
        const validation = validateFile(file);
        if (!validation.valid) {
          showToast(validation.error || 'Invalid file', 'error');
          continue;
        }

        // Check for duplicate documents
        const existingFilenames = store.getUniqueFilenames();
        if (existingFilenames.includes(file.name)) {
          showToast(`"${file.name}" is already indexed in the archive`, 'warning');
          continue;
        }

        console.log(`Processing ${file.name}...`);
        const text = await extractTextFromPDF(file);

        if (!text || text.trim().length === 0) {
          throw new Error("No readable text found. This PDF may be a scanned image and requires OCR before upload.");
        }

        await store.addDocument(file.name, text, file);
        setFiles(prev => [...prev, file]);
        onDocumentAdded(file.name);
        anyAdded = true;
        showToast(`"${file.name}" indexed successfully`, 'success');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error("Failed to process file:", err);
        showToast(`Error processing ${file.name}: ${message}`, 'error', 6000);
      }
    }

    if (anyAdded) {
      RetrievalPipeline.getInstance().onDocumentsChanged();
      await QueryCacheService.getInstance().clearCache();
    }
    setIsProcessing(false);
  }, [onDocumentAdded, setFiles, showToast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    noClick: false
  });

  const handleDeleteDocument = async (e: React.MouseEvent, filename: string) => {
    e.stopPropagation();
    const confirmed = await confirm({
      title: 'Remove Manuscript',
      message: `Remove "${filename}" from the local archive? Its vector embeddings and lexical indices will be cleared.`,
      confirmLabel: 'Remove',
      cancelLabel: 'Keep',
    });

    if (confirmed) {
      try {
        const store = VectorStore.getInstance();
        await store.removeDocument(filename);
        setFiles(prev => prev.filter(f => f.name !== filename));
        RetrievalPipeline.getInstance().onDocumentsChanged();
        await QueryCacheService.getInstance().clearCache();
        onDocumentAdded(`__removed__:${filename}`);
        showToast(`Removed "${filename}"`, 'info');
      } catch (err) {
        console.error('Failed to remove document:', err);
        showToast(`Failed to remove "${filename}"`, 'error');
      }
    }
  };

  const handleClearStorage = async () => {
    const confirmed = await confirm({
      title: 'Clear Entire Archive',
      message: 'Clear all indexed manuscripts and embeddings from local IndexedDB? This action cannot be undone.',
      confirmLabel: 'Clear All',
      cancelLabel: 'Keep Manuscripts',
    });

    if (confirmed) {
      const store = VectorStore.getInstance();
      await store.clearStore();
      RetrievalPipeline.getInstance().onDocumentsChanged();
      await QueryCacheService.getInstance().clearCache();
      setFiles([]);
      onDocumentAdded('__cleared__');
      showToast('All manuscripts cleared', 'info');
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 border-r border-slate-200 overflow-hidden select-none">
      {/* Header */}
      <div className="p-4 shrink-0 bg-white/95 border-b border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-serif font-bold text-slate-900 tracking-tight">
                Archival Index
              </h2>
              <p className="text-[10px] text-slate-500 font-mono">
                {files.length} manuscript{files.length !== 1 ? 's' : ''} stored
              </p>
            </div>
          </div>
          {files.length > 0 && (
            <button
              onClick={handleClearStorage}
              className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              title="Clear all manuscripts"
              aria-label="Clear all manuscripts"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        
        {/* Archival Dropzone */}
        <div
          {...getRootProps()}
          className={clsx(
            "relative flex flex-col items-center justify-center p-3.5 rounded-xl border border-dashed transition-all cursor-pointer group shadow-crisp-xs",
            isDragActive 
              ? "border-blue-600 bg-blue-50/70 text-blue-950" 
              : "border-slate-300 hover:border-blue-400 bg-slate-50/70 hover:bg-white text-slate-600 hover:text-slate-900"
          )}
        >
          <input {...getInputProps()} />
          <div className="flex items-center gap-2 text-xs font-medium">
            <Upload className="w-3.5 h-3.5 text-blue-600 group-hover:scale-105 transition-transform" />
            <span>{isDragActive ? "Drop PDF to Index" : "Index Research PDF"}</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1 font-mono">PDF documents up to 50MB</p>
        </div>
      </div>

      {/* Document List */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 relative">
        {isProcessing && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/85 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="text-center p-4 rounded-xl bg-white border border-slate-200 shadow-crisp-md">
              <Loader2 className="w-5 h-5 text-blue-600 mx-auto mb-2 animate-spin" />
              <p className="text-xs font-medium text-slate-800 font-serif">Indexing Manuscript...</p>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5">384D Dense + BM25 Lexical</p>
            </div>
          </div>
        )}

        {files.length === 0 && !isProcessing && (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 px-4 text-center">
            <div className="p-3 rounded-xl bg-white border border-slate-200 mb-3 shadow-crisp-xs">
              <BookOpen className="w-5 h-5 text-slate-400" />
            </div>
            <p className="text-xs font-serif font-semibold text-slate-700">Archival Index Empty</p>
            <p className="text-[11px] mt-1 text-slate-400 max-w-[190px] leading-relaxed">
              Index academic papers to query literature and construct citation networks.
            </p>
          </div>
        )}

        {files.map((file) => {
          const connectionsCount = getBookConnectionsCount(file.name);
          return (
            <div
              key={file.name}
              onClick={() => onFileSelect(file)}
              className="group flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all border border-slate-200/80 bg-white hover:bg-slate-50 hover:border-slate-300 shadow-crisp-xs"
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="rounded-lg bg-blue-50 border border-blue-200/60 p-1.5 text-blue-700 shrink-0 group-hover:bg-blue-100/60 transition-colors">
                  <FileText className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-800 truncate group-hover:text-blue-900 transition-colors font-sans">
                    {file.name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] text-slate-400 font-mono">
                      {(file.size / 1024 / 1024).toFixed(1)} MB
                    </span>
                    {connectionsCount > 0 && (
                      <span className="text-[10px] font-mono text-slate-500">
                        · {connectionsCount} link{connectionsCount !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => handleDeleteDocument(e, file.name)}
                className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-all shrink-0 ml-1 border border-transparent hover:border-slate-200"
                title={`Remove ${file.name}`}
                aria-label={`Remove ${file.name}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
