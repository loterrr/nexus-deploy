'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, CheckCircle, Loader2 } from 'lucide-react';
import { extractTextFromPDF } from '@/services/pdfParser';
import { VectorStore } from '@/services/vectorStore';
import { clsx } from 'clsx';

interface SidebarProps {
  files: File[];
  setFiles: React.Dispatch<React.SetStateAction<File[]>>;
  onFileSelect: (file: File) => void;
  onDocumentAdded: (filename: string) => void;
}

export default function Sidebar({ files, setFiles, onFileSelect, onDocumentAdded }: SidebarProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setIsProcessing(true);
    const store = VectorStore.getInstance();

    for (const file of acceptedFiles) {
      try {
        console.log(`Processing ${file.name}...`);
        
        // 1. Parse PDF
        const text = await extractTextFromPDF(file);
        
        if (!text || text.trim().length === 0) {
          throw new Error("PDF extraction resulted in empty text");
        }
        
        // 2. Vectorize & Store
        await store.addDocument(file.name, text);
        
        // 3. Update State
        setFiles(prev => [...prev, file]);
        
        onDocumentAdded(file.name);
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
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-screen text-slate-100">
      <div className="p-4 border-b border-slate-800">
        <h1 className="text-xl font-bold tracking-tight text-cyan-400">NEXUS <span className="text-slate-500 text-sm font-normal">Local</span></h1>
      </div>

      {/* Drop Zone */}
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
            {isProcessing ? "Ingesting..." : "Drop PDFs here"}
          </p>
        </div>
      </div>

      {/* File List */}
      <div className="flex-1 overflow-y-auto p-4">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Knowledge Base</h3>
        <ul className="space-y-2">
          {files.map((file, i) => (
            <li 
                key={i} 
                onClick={() => onFileSelect(file)}
                className="group flex items-center gap-2 text-sm text-slate-300 bg-slate-800/50 p-2 rounded cursor-pointer hover:bg-slate-700 hover:border-cyan-500/30 border border-transparent transition-all"
            >
              <FileText className="w-4 h-4 text-cyan-500 shrink-0" />
              <span className="truncate flex-1 group-hover:text-white transition-colors">{file.name}</span>
              <CheckCircle className="w-3 h-3 text-green-500 shrink-0" />
            </li>
          ))}
          {files.length === 0 && (
            <li className="text-xs text-slate-600 italic text-center py-4">No documents indexed yet.</li>
          )}
        </ul>
      </div>
    </aside>
  );
}
