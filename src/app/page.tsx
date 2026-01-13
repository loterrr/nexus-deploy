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
  
  // State for files & preview
  const [files, setFiles] = useState<File[]>([]); 
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Graph Logic
  const handleDocumentAdded = (filename: string) => {
    setGraphData(prev => ({
        nodes: [...prev.nodes, { id: filename, group: 2 }],
        links: [...prev.links, { source: 'Nexus Root', target: filename }]
    }));
  };

  // Preview Logic
  const handleFileClick = (file: File) => {
    setSelectedFile(file);
    setIsPreviewOpen(true);
  };

  return (
    // FIX 1: Use h-[100dvh] for mobile browsers to handle address bar properly
    <main className="flex h-[100dvh] w-screen bg-black overflow-hidden relative">
      
      {/* 1. Sidebar (Handles its own mobile toggle) */}
      <Sidebar 
        files={files}
        setFiles={setFiles}
        onFileSelect={handleFileClick}
        onDocumentAdded={handleDocumentAdded} 
      />

      {/* 2. Main Visualization Area */}
      <div className="flex-1 relative flex flex-col w-full h-full">
        
        {/* Graph View Label - Hidden on mobile to save space */}
        <div className="absolute top-4 left-4 z-10 pointer-events-none hidden md:block">
            <h2 className="text-slate-400 text-sm font-mono tracking-widest opacity-70">/ VIEW: KNOWLEDGE_GRAPH</h2>
        </div>
        
        {/* Graph Component */}
        <div className="flex-1 w-full h-full">
            <KnowledgeGraph data={graphData} />
        </div>
        
        {/* 3. Floating Chat */}
        <ChatFloat />
      </div>

      {/* 4. Preview Modal */}
      <PDFPreviewModal 
        file={selectedFile} 
        isOpen={isPreviewOpen} 
        onClose={() => setIsPreviewOpen(false)} 
      />
      
    </main>
  );
}
