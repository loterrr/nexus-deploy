'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Loader2, Trash2, BookOpen } from 'lucide-react';
import { extractTextFromPDF } from '@/services/pdfParser';
import { VectorStore } from '@/services/vectorStore';
import { validateFile } from '@/lib/validation';
import { clsx } from 'clsx';

interface BookshelfProps {
  files: File[];
  setFiles: React.Dispatch<React.SetStateAction<File[]>>;
  onFileSelect: (file: File) => void;
  onDocumentAdded: (filename: string) => void;
  graphData: {
    nodes: { id: string; group: number }[];
    links: { source: string; target: string; label?: string; value?: number }[];
  };
}

interface BookConnection {
  target: string;
  strength: number;
  label: string;
}

export default function Bookshelf({
  files,
  setFiles,
  onFileSelect,
  onDocumentAdded,
  graphData
}: BookshelfProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [hoveredBook, setHoveredBook] = useState<string | null>(null);


  const getBookConnections = (filename: string): BookConnection[] => {
    const connections: BookConnection[] = [];

    graphData.links.forEach(link => {
      const source = typeof link.source === 'object' ? (link.source as any).id : link.source;
      const target = typeof link.target === 'object' ? (link.target as any).id : link.target;

      if (source === filename && target !== 'The Archive Root') {
        const strengthMatch = link.label?.match(/(\d+)%/);
        connections.push({
          target,
          strength: strengthMatch ? parseInt(strengthMatch[1]) : 50,
          label: link.label || ''
        });
      } else if (target === filename && source !== 'The Archive Root') {
        const strengthMatch = link.label?.match(/(\d+)%/);
        connections.push({
          target: source,
          strength: strengthMatch ? parseInt(strengthMatch[1]) : 50,
          label: link.label || ''
        });
      }
    });

    return connections;
  };


  const isConnectedToHovered = (filename: string): boolean => {
    if (!hoveredBook || hoveredBook === filename) return false;
    const connections = getBookConnections(hoveredBook);
    return connections.some(c => c.target === filename);
  };


  const getConnectionStrength = (filename: string): number => {
    if (!hoveredBook) return 0;
    const connections = getBookConnections(hoveredBook);
    const connection = connections.find(c => c.target === filename);
    return connection?.strength || 0;
  };

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

        await store.addDocument(file.name, text, file);
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
    accept: { 'application/pdf': ['.pdf'] },
    noClick: files.length > 0
  });

  const handleClearStorage = async () => {
    if (confirm('Are you sure you want to clear all documents? This cannot be undone.')) {
      const store = VectorStore.getInstance();
      await store.clearStore();
      setFiles([]);
      onDocumentAdded('__cleared__');
    }
  };

  const getBookColor = (index: number) => {
    const colors = [
      'from-cyan-600 to-cyan-800',
      'from-indigo-600 to-indigo-800',
      'from-purple-600 to-purple-800',
      'from-teal-600 to-teal-800',
      'from-blue-600 to-blue-800',
      'from-violet-600 to-violet-800',
      'from-sky-600 to-sky-800',
      'from-fuchsia-600 to-fuchsia-800',
    ];
    return colors[index % colors.length];
  };

  return (
    <div className="flex-1 h-full bg-gradient-to-b from-slate-900 via-slate-950 to-black overflow-hidden flex flex-col">
      <div className="p-6 border-b border-slate-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-cyan-400" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                THE ARCHIVE <span className="text-slate-500 text-sm font-normal">Library</span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {files.length} document{files.length !== 1 ? 's' : ''} in your knowledge base
              </p>
            </div>
          </div>

          {files.length > 0 && (
            <button
              onClick={handleClearStorage}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/50 hover:bg-red-900/30 text-slate-400 hover:text-red-400 transition-all text-sm font-medium border border-slate-700/50 hover:border-red-900/50"
            >
              <Trash2 className="w-4 h-4" />
              Clear All
            </button>
          )}
        </div>
      </div>

      <div
        {...getRootProps()}
        className={clsx(
          "flex-1 relative overflow-y-auto transition-all duration-300",
          isDragActive && "bg-cyan-500/5"
        )}
      >
        <input {...getInputProps()} />

        {isDragActive && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-sm">
            <div className="text-center">
              <Upload className="w-16 h-16 text-cyan-400 mx-auto mb-4 animate-bounce" />
              <p className="text-xl font-medium text-cyan-400">Drop PDF here</p>
              <p className="text-sm text-slate-400 mt-1">Add to your knowledge library</p>
            </div>
          </div>
        )}

        {isProcessing && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-sm">
            <div className="text-center">
              <Loader2 className="w-16 h-16 text-cyan-400 mx-auto mb-4 animate-spin" />
              <p className="text-xl font-medium text-white">Processing document...</p>
              <p className="text-sm text-slate-400 mt-1">Extracting and indexing content</p>
            </div>
          </div>
        )}

        {files.length === 0 && !isDragActive && !isProcessing && (
          <div
            className="h-full flex flex-col items-center justify-center cursor-pointer"
            onClick={() => (document.querySelector('input[type="file"]') as HTMLInputElement)?.click()}
          >
            <div className="relative">
              <div className="w-64 h-2 bg-gradient-to-r from-amber-900 via-amber-800 to-amber-900 rounded-sm mb-8 shadow-lg" />
              <div className="w-48 h-2 bg-gradient-to-r from-amber-900 via-amber-800 to-amber-900 rounded-sm mx-auto mb-8 shadow-lg" />
            </div>
            <Upload className="w-12 h-12 text-slate-600 mb-4" />
            <p className="text-lg font-medium text-slate-400">Your bookshelf is empty</p>
            <p className="text-sm text-slate-600 mt-1">Drop a PDF or click to upload</p>
            <div className="mt-6 px-4 py-2 rounded-lg border border-dashed border-slate-700 text-slate-500 text-sm">
              Supports PDF files
            </div>
          </div>
        )}

        {files.length > 0 && (
          <div className="p-6">
            <div className="space-y-8">
              {Array.from({ length: Math.ceil(files.length / 6) }).map((_, shelfIndex) => (
                <div key={shelfIndex} className="relative">
                  <div className="relative">
                    <div className="flex gap-4 pb-4 flex-wrap justify-start min-h-[180px]">
                      {files.slice(shelfIndex * 6, (shelfIndex + 1) * 6).map((file, bookIndex) => {
                        const globalIndex = shelfIndex * 6 + bookIndex;
                        const connections = getBookConnections(file.name);
                        const isHovered = hoveredBook === file.name;
                        const isConnected = isConnectedToHovered(file.name);
                        const connectionStrength = getConnectionStrength(file.name);

                        return (
                          <div
                            key={file.name}
                            className="relative group"
                            onMouseEnter={() => setHoveredBook(file.name)}
                            onMouseLeave={() => setHoveredBook(null)}
                          >
                            {/* Connection glow effect */}
                            {(isHovered || isConnected) && (
                              <div
                                className={clsx(
                                  "absolute -inset-2 rounded-lg blur-md transition-opacity duration-300",
                                  isHovered ? "bg-cyan-500/40" : "bg-indigo-500/30"
                                )}
                                style={{
                                  opacity: isConnected ? connectionStrength / 100 : 1
                                }}
                              />
                            )}

                            <div
                              onClick={() => onFileSelect(file)}
                              className={clsx(
                                "relative w-24 h-36 rounded-r-md rounded-l-sm cursor-pointer transition-all duration-300",
                                "bg-gradient-to-br shadow-lg",
                                getBookColor(globalIndex),
                                "hover:scale-105 hover:-translate-y-2 hover:shadow-2xl",
                                isConnected && "scale-105 -translate-y-1"
                              )}
                            >
                              <div className="absolute left-0 top-0 bottom-0 w-3 bg-black/20 rounded-l-sm" />

                              <div className="absolute right-0 top-1 bottom-1 w-1 bg-slate-200/90 rounded-r-sm" />

                              <div className="absolute inset-3 flex items-center justify-center">
                                <span
                                  className="text-white/90 text-xs font-medium text-center leading-tight break-words line-clamp-4"
                                  style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
                                >
                                  {file.name.replace('.pdf', '')}
                                </span>
                              </div>

                              {connections.length > 0 && (
                                <div className="absolute -top-1 -right-1 flex flex-wrap gap-0.5 max-w-8">
                                  {connections.slice(0, 3).map((conn, i) => (
                                    <div
                                      key={i}
                                      className={clsx(
                                        "w-2 h-2 rounded-full",
                                        conn.strength >= 70 ? "bg-green-400" :
                                          conn.strength >= 40 ? "bg-yellow-400" : "bg-orange-400"
                                      )}
                                      title={`${conn.target}: ${conn.strength}%`}
                                    />
                                  ))}
                                  {connections.length > 3 && (
                                    <div className="w-2 h-2 rounded-full bg-slate-400 text-[6px] flex items-center justify-center text-slate-900 font-bold">
                                      +
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            <div
                              className={clsx(
                                "absolute -bottom-16 left-1/2 -translate-x-1/2 z-50 bg-slate-800 rounded-lg px-3 py-2 shadow-xl border border-slate-700 whitespace-nowrap transition-all duration-200",
                                "opacity-0 pointer-events-none group-hover:opacity-100"
                              )}
                            >
                              <p className="text-white text-xs font-medium truncate max-w-48">{file.name}</p>
                              {connections.length > 0 && (
                                <p className="text-cyan-400 text-[10px] mt-0.5">
                                  {connections.length} connection{connections.length !== 1 ? 's' : ''}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="h-3 bg-gradient-to-b from-amber-800 via-amber-900 to-amber-950 rounded-sm shadow-[0_4px_8px_rgba(0,0,0,0.5)]" />
                    <div className="absolute -bottom-2 left-8 w-4 h-4 bg-amber-950 rounded-sm transform rotate-45" />
                    <div className="absolute -bottom-2 right-8 w-4 h-4 bg-amber-950 rounded-sm transform rotate-45" />
                  </div>
                </div>
              ))}

              <div
                className="flex items-center justify-center py-8 cursor-pointer group"
                onClick={() => (document.querySelector('input[type="file"]') as HTMLInputElement)?.click()}
              >
                <div className="flex items-center gap-2 text-slate-600 group-hover:text-cyan-500 transition-colors">
                  <Upload className="w-5 h-5" />
                  <span className="text-sm font-medium">Add more documents</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {files.length > 1 && (
        <div className="p-4 border-t border-slate-800/50 bg-slate-900/50">
          <div className="flex items-center justify-center gap-6 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              Strong match (70%+)
            </span>
            <span className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-yellow-400" />
              Moderate (40-70%)
            </span>
            <span className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-orange-400" />
              Weak (&lt;40%)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
