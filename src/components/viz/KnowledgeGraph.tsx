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

  // SMART WIDTH CALCULATION:
  // On Mobile (< 768px): Use the full screen width.
  // On Desktop (>= 768px): Subtract 260px to make room for the Sidebar.
  const graphWidth = width > 768 ? (width - 260) : width;

  return (
    <div className="w-full h-full bg-slate-950 flex justify-center items-center overflow-hidden">
      <ForceGraph2D
        ref={graphRef}
        width={graphWidth} 
        height={height ? height : 600} // Fallback height if undefined
        graphData={data}
        nodeLabel="id"
        nodeColor={(node: any) => node.group === 1 ? '#06b6d4' : '#6366f1'} // Cyan for Root, Indigo for Papers
        nodeRelSize={6}
        
        // DRAW ARROWS
        linkDirectionalArrowLength={3.5}
        linkDirectionalArrowRelPos={1}
        linkColor={() => '#475569'} 
        
        // DRAW TEXT ON LINKS
        linkCanvasObjectMode={() => 'after'}
        linkCanvasObject={(link: any, ctx) => {
          const MAX_FONT_SIZE = 4;
          const LABEL_NODE_MARGIN = graphRef.current ? graphRef.current.d3Force('link').distance() * 0.85 : 10;

          const start = link.source;
          const end = link.target;

          if (typeof start !== 'object' || typeof end !== 'object') return;

          // Calculate label position
          const textPos = Object.assign({}, ...['x', 'y'].map(c => ({
            [c]: start[c] + (end[c] - start[c]) / 2 
          })));

          const relLink = { x: end.x - start.x, y: end.y - start.y };

          let textAngle = Math.atan2(relLink.y, relLink.x);
          // Maintain label vertical orientation
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
          ctx.fillStyle = 'rgba(148, 163, 184, 1)'; 
          ctx.fillText(label, 0, 0);
          ctx.restore();
        }}
      />
    </div>
  );
}
