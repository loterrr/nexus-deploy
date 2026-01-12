'use client';

import dynamic from 'next/dynamic';

// ForceGraph2D depends on window/canvas, so strictly no SSR
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { 
    ssr: false,
    loading: () => <div className="h-full w-full bg-slate-900 animate-pulse" />
});

export default function KnowledgeGraph({ data }: { data: any }) {
    return (
        <div className="flex-1 h-full w-full overflow-hidden bg-slate-950">
             <ForceGraph2D 
                graphData={data} 
                nodeAutoColorBy="group"
                // Custom coloring and interactions to match 'Nexus' theme
             />
        </div>
    );
}