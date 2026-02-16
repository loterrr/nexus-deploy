'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, CheckCircle, Loader2, Menu, X, Trash2 } from 'lucide-react';
import { extractTextFromPDF } from '@/services/pdfParser';
import { VectorStore } from '@/services/vectorStore';
import { validateFile } from '@/lib/validation';
import { clsx } from 'clsx';

interface SidebarProps {
  files: File[];
  setFiles: React.Dispatch<React.SetStateAction<File[]>>;
  onFileSelect: (file: File) => void;
  onDocumentAdded: (filename: string) => void;
}

export default function Sidebar({ files, setFiles, onFileSelect, onDocumentAdded }: SidebarProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setIsProcessing(true);
    const store = VectorStore.getInstance();

    for (const file of acceptedFiles) {
      try {
        const validation = validateFile(file);
        if (!validation.valid) {
          alert(`Error: ${validation.error}`);
          continue;
        }

        console.log(`Processing ${file.name}...`);
        const text = await extractTextFromPDF(file);

        if (!text || text.trim().length === 0) {
          throw new Error("PDF extraction resulted in empty text");
        }

        await store.addDocument(file.name, text);
        setFiles(prev => [...prev, file]);
        onDocumentAdded(file.name);

        setIsMobileOpen(false);
      } catch (err: any) {
        console.error("Failed to process file:", err);
        alert(`Error processing ${file.name}: ${err.message}`);
      }
    }
    setIsProcessing(false);
  }, [onDocumentAdded, setFiles]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] }
  });

  return (
    <>

      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="md:hidden fixed top-4 right-4 z-[60] p-2 bg-slate-800 text-cyan-400 rounded-lg shadow-lg border border-slate-700 hover:bg-slate-700 transition-colors"
      >
        {isMobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>


      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}


      <aside className={clsx(
        "bg-slate-900 border-r border-slate-800 flex flex-col h-screen text-slate-100 transition-transform duration-300 ease-in-out z-50",
        // Mobile: Fixed, slide-in logic
        "fixed md:relative inset-y-0 left-0 w-[85%] md:w-64 shadow-2xl md:shadow-none",
        isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="p-4 border-b border-slate-800 flex justify-between items-center">
          <h1 className="text-xl font-bold tracking-tight text-cyan-400">NEXUS <span className="text-slate-500 text-sm font-normal">Local</span></h1>
        </div>


        <div className="p-4">
          <div
            {...getRootProps()}
            className={clsx(
              "border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center transition-colors cursor-pointer",
              isDragActive ? "border-cyan-400 bg-cyan-400/10" : "border-slate-700 hover:border-slate-600"
            )}
          >
            <input {...getInputProps()} />
            {isProcessing ? (
              <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mb-2" />
            ) : (
              <Upload className="w-8 h-8 text-slate-400 mb-2" />
            )}
            <p className="text-xs text-slate-400">
              {isProcessing && (
                <div className="mt-2">
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div
                      className="bg-cyan-500 h-2 rounded-full transition-all"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{uploadProgress}%</p>
                </div>
              )}
            </p>
          </div>
        </div>


        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Knowledge Base</h3>
          <ul className="space-y-2">
            {files.map((file, i) => (
              <li
                key={i}
                onClick={() => {
                  onFileSelect(file);
                  setIsMobileOpen(false);
                }}
                className="group flex items-center gap-2 text-sm text-slate-300 bg-slate-800/50 p-2 rounded cursor-pointer hover:bg-slate-700 hover:border-cyan-500/30 border border-transparent transition-all"
              >
                <FileText className="w-4 h-4 text-cyan-500 shrink-0" />
                <span className="truncate flex-1 group-hover:text-white transition-colors">{file.name}</span>
                <CheckCircle className="w-3 h-3 text-green-500 shrink-0" />
              </li>
            ))}
            {files.length === 0 && (
              <li className="text-xs text-slate-600 italic text-center py-4">No documents yet.</li>
            )}
          </ul>
        </div>

        <div className="p-4 border-t border-slate-800">
          <button
            onClick={async () => {
              if (confirm('Are you sure you want to clear all documents? This cannot be undone.')) {
                const store = VectorStore.getInstance();
                await store.clearStore();
                setFiles([]);
                onDocumentAdded('__cleared__');
              }
            }}
            className="w-full flex items-center justify-center gap-2 p-2 rounded bg-slate-800 hover:bg-red-900/30 text-slate-400 hover:text-red-400 transition-colors text-sm font-medium border border-slate-700 hover:border-red-900/50"
          >
            <Trash2 className="w-4 h-4" />
            Clear Storage
          </button>
        </div>
      </aside>
    </>
  );
}
