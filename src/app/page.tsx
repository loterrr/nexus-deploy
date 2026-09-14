'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { BarChart3, Menu, X, MessageSquare, Share2, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { clsx } from 'clsx';
import DocumentExplorer from '@/components/layout/DocumentExplorer';
import ChatPanel from '@/components/layout/ChatPanel';
import PDFPreviewModal from '@/components/ui/PDFPreviewModal';
import PDFInspectorPanel from '@/components/ui/PDFInspectorPanel';
import KnowledgeGraph from '@/components/viz/KnowledgeGraph';
import { VectorStore } from '@/services/vectorStore';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useToast } from '@/components/ui/Toast';

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
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  
  // Workspace views
  const [mainView, setMainView] = useState<'chat' | 'graph'>('chat');
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);

  const { showToast } = useToast();

  useEffect(() => {
    const hydrate = async () => {
      try {
        const store = VectorStore.getInstance();
        await store.init();

        const filenames = store.getUniqueFilenames();
        if (filenames.length === 0) return;

        console.log("Hydrating from persistence:", filenames);

        const restoredFiles: File[] = [];
        for (const name of filenames) {
          const file = await store.getFile(name);
          if (file) {
            restoredFiles.push(file);
          } else {
            restoredFiles.push(new File([""], name, { type: "application/pdf" }));
          }
        }
        
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
      setSelectedFile(null);
      setIsInspectorOpen(false);
      return;
    }

    if (filename.startsWith('__removed__:')) {
      const removedName = filename.replace('__removed__:', '');
      setGraphData(prev => ({
        nodes: prev.nodes.filter(n => n.id !== removedName),
        links: prev.links.filter(l => l.source !== removedName && l.target !== removedName)
      }));
      if (selectedFile?.name === removedName) {
        setSelectedFile(null);
        setIsInspectorOpen(false);
      }
      return;
    }

    const newNode = { id: filename, group: 2 };
    const rootLink = { source: 'The Archive Root', target: filename, label: 'Upload' };
    const newLinks = [rootLink];

    try {
      const store = VectorStore.getInstance();
      const similarDocs = await store.searchDense(filename, 5);
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

  // Open file in side inspector (or modal on small screens)
  const handleFileClick = (file: File, page?: number) => {
    setSelectedFile(file);
    setTargetPage(page);
    setIsInspectorOpen(true);
    setIsMobileSidebarOpen(false);

    // On narrow screens under 768px, automatically expand full modal
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsPreviewOpen(true);
    }
  };

  const memoizedGraphData = useMemo(() => graphData, [graphData]);

  const renderActionControls = (
    <div className="flex items-center gap-2">
      {/* Main View Tabs (Journal vs Graph) */}
      <div className="flex items-center p-1 rounded-xl bg-slate-100/90 border border-slate-200/90 backdrop-blur-xs shadow-crisp-xs">
        <button
          onClick={() => setMainView('chat')}
          className={clsx(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
            mainView === 'chat'
              ? "bg-white text-slate-900 border border-slate-200 shadow-crisp-xs font-semibold"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
          )}
        >
          <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
          <span className="hidden sm:inline">Journal</span>
        </button>
        <button
          onClick={() => setMainView('graph')}
          className={clsx(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
            mainView === 'graph'
              ? "bg-white text-slate-900 border border-slate-200 shadow-crisp-xs font-semibold"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
          )}
        >
          <Share2 className="w-3.5 h-3.5 text-indigo-600" />
          <span className="hidden sm:inline">Graph</span>
        </button>
      </div>

      {/* Toggle Right Inspector Button */}
      {mainView === 'chat' && (
        <button
          onClick={() => setIsInspectorOpen(!isInspectorOpen)}
          className={clsx(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all shadow-crisp-xs",
            isInspectorOpen
              ? "bg-blue-50 text-blue-800 border-blue-200 font-semibold"
              : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200"
          )}
          title={isInspectorOpen ? "Collapse literature inspector" : "Open literature inspector"}
        >
          {isInspectorOpen ? (
            <>
              <PanelRightClose className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden sm:inline">Inspector</span>
            </>
          ) : (
            <>
              <PanelRightOpen className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Inspector</span>
            </>
          )}
        </button>
      )}

      {/* Evaluate Pipeline Link */}
      <Link
        href="/evaluate"
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 hover:text-blue-700 transition-all text-xs font-medium border border-slate-200 hover:border-blue-300 shadow-crisp-xs group"
      >
        <BarChart3 className="w-3.5 h-3.5 text-blue-600 group-hover:scale-110 transition-transform" />
        <span className="hidden md:inline">Benchmark</span>
      </Link>
    </div>
  );

  return (
    <main className="flex h-screen w-screen bg-white overflow-hidden text-slate-900 font-sans">
      {/* Mobile sidebar toggle */}
      <button
        onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
        className="md:hidden fixed top-3 left-3 z-[60] p-2 bg-white/95 text-slate-700 hover:text-slate-900 rounded-lg shadow-crisp-sm border border-slate-200 hover:bg-slate-50 transition-colors backdrop-blur-xs"
        aria-label="Toggle sidebar"
      >
        {isMobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Mobile overlay */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs z-40 md:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Left Column: Archival Index (Document Explorer) */}
      <div
        className={`
          w-72 shrink-0 h-full
          fixed md:relative inset-y-0 left-0 z-50
          transition-transform duration-300 ease-in-out
          md:translate-x-0 md:block
          ${isMobileSidebarOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full'}
        `}
      >
        <ErrorBoundary>
          <DocumentExplorer
            files={files}
            setFiles={setFiles}
            onFileSelect={handleFileClick}
            onDocumentAdded={handleDocumentAdded}
            graphData={memoizedGraphData}
          />
        </ErrorBoundary>
      </div>

      {/* Center Column: Synthesis Journal / Research Workspace */}
      <div className="flex-1 h-full relative bg-white overflow-hidden flex min-w-0">
        {/* Chat / Journal View */}
        <div className={clsx("h-full w-full flex-1", mainView !== 'chat' && "hidden")}>
          <ErrorBoundary>
            <ChatPanel
              headerActions={renderActionControls}
              onOpenFile={(filename, page) => {
                const file = files.find(f => f.name === filename);
                if (file) {
                  handleFileClick(file, page);
                } else {
                  showToast(`Document "${filename}" was cited, but is not currently loaded in local index.`, 'warning');
                }
              }}
            />
          </ErrorBoundary>
        </div>

        {/* Full-width Knowledge Graph View (when mainView is 'graph') */}
        <div className={clsx("h-full w-full flex-1 relative", mainView !== 'graph' && "hidden")}>
          <div className="absolute top-3.5 right-4 z-50">
            {renderActionControls}
          </div>
          <ErrorBoundary>
            <KnowledgeGraph
              data={memoizedGraphData}
              onNodeClick={(node) => {
                const file = files.find(f => f.name === node.id);
                if (file) {
                  handleFileClick(file);
                } else {
                  showToast(`Selected entity: "${node.id}"`, 'info');
                }
              }}
            />
          </ErrorBoundary>
        </div>

        {/* Right Column: Docked Literature & Provenance Inspector */}
        {mainView === 'chat' && (
          <PDFInspectorPanel
            file={selectedFile}
            targetPage={targetPage}
            isOpen={isInspectorOpen}
            onClose={() => setIsInspectorOpen(false)}
            onExpandModal={() => setIsPreviewOpen(true)}
            onSwitchToGraph={() => setMainView('graph')}
          />
        )}
      </div>

      {/* Full-Screen PDF Modal (When user clicks expand or on mobile) */}
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
