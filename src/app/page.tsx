'use client';

import { useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import ChatFloat from '@/components/layout/ChatFloat';
import KnowledgeGraph from '@/components/viz/KnowledgeGraph'; // Ensure this matches the new file above
import PDFPreviewModal from '@/components/ui/PDFPreviewModal';
import { VectorStore } from '@/services/vectorStore'; // Need this to find connections

const INITIAL_GRAPH_DATA = {
  nodes: [{ id: 'Nexus Root', group: 1 }],
  links: []
};

export default function Home() {
  const [graphData, setGraphData] = useState(INITIAL_GRAPH_DATA);
  const [files, setFiles] = useState<File[]>([]); 
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // 1. SMART LINKING LOGIC
  const handleDocumentAdded = async (filename: string) => {
    
    // A. Add the new Node immediately
    const newNode = { id: filename, group: 2 };
    // Always link to Root so it doesn't float away
    const rootLink = { source: 'Nexus Root', target: filename, label: 'Upload' };

    let newLinks = [rootLink];

    // B. Check for Semantic Connections to existing papers
    try {
        const store = VectorStore.getInstance();
        
        // We search the store using the filename as a loose "topic" query
        // (In a real app, you'd use the document summary, but this works for demo)
        const similarDocs = await store.search(filename, 5); // Get top 5 matches
        
        // Filter matches that are NOT from the file we just uploaded
        const connections = similarDocs.filter(doc => doc.source !== filename);

        // Create links for the top 2 matches
        connections.slice(0, 2).forEach(match => {
             // Create a link
             newLinks.push({
                 source: filename,          // From New File
                 target: match.source,      // To Existing File
                 label: `Match: ${(match.score * 100).toFixed(0)}%` // Label: "Match: 85%"
             });
        });

    } catch (err) {
        console.warn("Could not calculate semantic links:", err);
    }

    // C. Update Graph Data
    setGraphData(prev => ({
        nodes: [...prev.nodes, newNode],
        links: [...prev.links, ...newLinks]
    }));
  };

  const handleFileClick = (file: File) => {
    setSelectedFile(file);
    setIsPreviewOpen(true);
  };

  return (
    <main className="flex h-[100dvh] w-screen bg-black overflow-hidden relative">
      <Sidebar 
        files={files}
        setFiles={setFiles}
        onFileSelect={handleFileClick}
        onDocumentAdded={handleDocumentAdded} 
      />

      <div className="flex-1 relative flex flex-col w-full h-full">
        {/* Hidden on mobile */}
        <div className="absolute top-4 left-4 z-10 pointer-events-none hidden md:block">
            <h2 className="text-slate-400 text-sm font-mono tracking-widest opacity-70">/ VIEW: KNOWLEDGE_GRAPH</h2>
        </div>
        
        {/* Graph Area */}
        <div className="flex-1 w-full h-full">
            <KnowledgeGraph data={graphData} />
        </div>
        
        <ChatFloat />
      </div>

      <PDFPreviewModal 
        file={selectedFile} 
        isOpen={isPreviewOpen} 
        onClose={() => setIsPreviewOpen(false)} 
      />
    </main>
  );
}
