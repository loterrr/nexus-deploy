'use client';

import { useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import ChatFloat from '@/components/layout/ChatFloat';
import KnowledgeGraph from '@/components/viz/KnowledgeGraph';
import PDFPreviewModal from '@/components/ui/PDFPreviewModal';

// Mock data for the graph initially
const INITIAL_GRAPH_DATA = {
  nodes: [{ id: 'Nexus Root', group: 1 }],
  links: []
};

export default function Home() {
  const [graphData, setGraphData] = useState(INITIAL_GRAPH_DATA);
  
  // 2. NEW STATE FOR FILES & PREVIEW
  // We need to track files here so we can pass them to the Modal
  const [files, setFiles] = useState<File[]>([]); 
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Existing Graph Logic
  const handleDocumentAdded = (filename: string) => {
    setGraphData(prev => ({
        nodes: [...prev.nodes, { id: filename, group: 2 }],
        links: [...prev.links, { source: 'Nexus Root', target: filename }]
    }));
  };

  // 3. NEW HANDLER FOR CLICKING A FILE
  const handleFileClick = (file: File) => {
    setSelectedFile(file);
    setIsPreviewOpen(true);
  };

  return (
    <main className="flex h-screen w-screen bg-black overflow-hidden">
      {/* 1. Sidebar */}
      <Sidebar 
        // Pass the new props so Sidebar can update the list and handle clicks
        files={files}
        setFiles={setFiles}
        onFileSelect={handleFileClick}
        // Keep your existing graph updater
        onDocumentAdded={handleDocumentAdded} 
      />

      {/* 2. Main Visualization Area */}
      <div className="flex-1 relative">
        <div className="absolute top-4 left-4 z-10 pointer-events-none">
            <h2 className="text-slate-400 text-sm font-mono">/ VIEW: KNOWLEDGE_GRAPH</h2>
        </div>
        
        {/* Graph Component */}
        <KnowledgeGraph data={graphData} />
        
        {/* 3. Floating Chat */}
        <ChatFloat />
      </div>

      {/* 4. RENDER THE PREVIEW MODAL */}
      <PDFPreviewModal 
        file={selectedFile} 
        isOpen={isPreviewOpen} 
        onClose={() => setIsPreviewOpen(false)} 
      />
    </main>
  );
}