'use client';

import { useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useWindowSize } from '@react-hook/window-size';
import { Loader2 } from 'lucide-react';

// Dynamically import ForceGraph to avoid SSR issues
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full text-slate-500"><Loader2 className="animate-spin mr-2" /> Loading Graph...</div>
});

interface GraphData {
  nodes: { id: string; group: number }[];
  links: { source: string; target: string; label?: string; value?: number }[];
}

export default function KnowledgeGraph({ data }: { data: GraphData }) {
  const [width, height] = useWindowSize();
  const graphRef = useRef<any>();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) return null;

  return (
    <div className="w-full h-full bg-slate-950">
      <ForceGraph2D
        ref={graphRef}
        width={width ? width - 300 : 800} // Subtract sidebar width approximately
        height={height}
        graphData={data}
        nodeLabel="id"
        nodeColor={(node: any) => node.group === 1 ? '#06b6d4' : '#6366f1'} // Cyan for Root, Indigo for Papers
        nodeRelSize={6}
        
        // DRAW ARROWS
        linkDirectionalArrowLength={3.5}
        linkDirectionalArrowRelPos={1}
        linkColor={() => '#475569'} // Slate-600 lines
        
        // DRAW TEXT ON LINKS
        linkCanvasObjectMode={() => 'after'}
        linkCanvasObject={(link: any, ctx) => {
          const MAX_FONT_SIZE = 4;
          const LABEL_NODE_MARGIN = graphRef.current ? graphRef.current.d3Force('link').distance() * 0.85 : 10;

          const start = link.source;
          const end = link.target;

          // Ignore unbound links
          if (typeof start !== 'object' || typeof end !== 'object') return;

          // Calculate label position
          const textPos = Object.assign({}, ...['x', 'y'].map(c => ({
            [c]: start[c] + (end[c] - start[c]) / 2 // Center
          })));

          const relLink = { x: end.x - start.x, y: end.y - start.y };

          const maxTextLength = Math.sqrt(Math.pow(relLink.x, 2) + Math.pow(relLink.y, 2)) - LABEL_NODE_MARGIN * 2;

          let textAngle = Math.atan2(relLink.y, relLink.x);
          // Maintain label vertical orientation for readability 
          if (textAngle > Math.PI / 2) textAngle = -(Math.PI - textAngle);
          if (textAngle < -Math.PI / 2) textAngle = -(-Math.PI - textAngle);

          const label = link.label || '';

          // Draw Text
          ctx.font = `${MAX_FONT_SIZE}px Sans-Serif`;
          ctx.save();
          ctx.translate(textPos.x, textPos.y);
          ctx.rotate(textAngle);
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = 'rgba(148, 163, 184, 1)'; // Slate-400 text
          ctx.fillText(label, 0, 0);
          ctx.restore();
        }}
      />
    </div>
  );
}
