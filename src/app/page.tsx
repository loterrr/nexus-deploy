'use client';

import { useState, useMemo, useEffect } from 'react';
import Bookshelf from '@/components/layout/Bookshelf';
import ChatFloat from '@/components/layout/ChatFloat';
import PDFPreviewModal from '@/components/ui/PDFPreviewModal';
import { VectorStore } from '@/services/vectorStore';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const INITIAL_GRAPH_DATA = {
  nodes: [{ id: 'The Archive Root', group: 1 }],
  links: [] as { source: string; target: string; label?: string }[]
};

export default function Home() {
  const [graphData, setGraphData] = useState(INITIAL_GRAPH_DATA);
  const [files, setFiles] = useState<File[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [targetPage, setTargetPage] = useState<number | undefined>(undefined);

  useEffect(() => {
    const hydrate = async () => {
      try {
        const store = VectorStore.getInstance();
        await store.init();

        const filenames = store.getUniqueFilenames();
        if (filenames.length === 0) return;

        console.log("Hydrating from persistence:", filenames);

        const restoredFiles = filenames.map(name => new File([""], name, { type: "application/pdf" }));
        setFiles(restoredFiles);

        const newNodes = filenames.map(name => ({ id: name, group: 2 }));
        const newLinks: { source: string; target: string; label?: string }[] = [];

        filenames.forEach(name => {
          newLinks.push({ source: 'The Archive Root', target: name, label: 'Restored' });
        });

        setGraphData(prev => ({
          nodes: [...prev.nodes, ...newNodes],
          links: [...prev.links, ...newLinks]
        }));

      } catch (err) {
        console.error("Failed to hydrate from persistence:", err);
      }
    };

    hydrate();
  }, []);

  const handleDocumentAdded = async (filename: string) => {
    if (filename === '__cleared__') {
      setGraphData(INITIAL_GRAPH_DATA);
      setFiles([]);
      return;
    }

    const newNode = { id: filename, group: 2 };
    const rootLink = { source: 'The Archive Root', target: filename, label: 'Upload' };

    let newLinks = [rootLink];

    try {
      const store = VectorStore.getInstance();

      const similarDocs = await store.search(filename, 5);

      const connections = similarDocs.filter(doc => doc.doc.metadata.source !== filename);

      connections.slice(0, 2).forEach(match => {
        newLinks.push({
          source: filename,
          target: match.doc.metadata.source,
          label: `Match: ${(match.score * 100).toFixed(0)}%`
        });
      });

    } catch (err) {
      console.warn("Could not calculate semantic links:", err);
    }

    setGraphData(prev => ({
      nodes: [...prev.nodes, newNode],
      links: [...prev.links, ...newLinks]
    }));
  };

  const handleFileClick = (file: File, page?: number) => {
    setSelectedFile(file);
    setTargetPage(page);
    setIsPreviewOpen(true);
  };

  const memoizedGraphData = useMemo(() => graphData, [graphData]);

  return (
    <main className="flex h-[100dvh] w-screen bg-black overflow-hidden relative">
      <ErrorBoundary>
        <Bookshelf
          files={files}
          setFiles={setFiles}
          onFileSelect={handleFileClick}
          onDocumentAdded={handleDocumentAdded}
          graphData={memoizedGraphData}
        />
      </ErrorBoundary>

      <ChatFloat onOpenFile={(filename, page) => {
        const file = files.find(f => f.name === filename);
        if (file) {
          handleFileClick(file, page);
        } else {
          alert(`Could not find document: ${filename}. It might have been deleted or not loaded.`);
        }
      }} />

      <PDFPreviewModal
        file={selectedFile}
        isOpen={isPreviewOpen}
        targetPage={targetPage}
        onClose={() => {
          setIsPreviewOpen(false);
          setTargetPage(undefined);
        }}
      />
    </main>
  );
}
