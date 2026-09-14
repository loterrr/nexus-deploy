'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { ZoomIn, ZoomOut, Maximize2, Layers, Search, FileText } from 'lucide-react';

// Dynamically import ForceGraphClient to prevent SSR window issues and forward ref safely
const ForceGraphClient = dynamic(() => import('./ForceGraphClient'), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
      <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      <span className="text-xs font-mono">Initializing Neural Graph...</span>
    </div>
  ),
});

export interface GraphNode {
  id: string;
  group: number;
  val?: number;
  color?: string;
  snippet?: string;
  x?: number;
  y?: number;
}

export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  label?: string;
  value?: number;
}

export interface KnowledgeGraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

interface KnowledgeGraphProps {
  data: KnowledgeGraphData;
  onNodeClick?: (node: GraphNode) => void;
}

export default function KnowledgeGraph({ data, onNodeClick }: KnowledgeGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [hoveredLink, setHoveredLink] = useState<GraphLink | null>(null);
  const [searchFilter, setSearchFilter] = useState('');

  // Track container dimensions with ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return;

    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Filtered graph data if user searches
  const filteredData = {
    nodes: data.nodes.map(n => ({
      ...n,
      isHighlighted: searchFilter ? n.id.toLowerCase().includes(searchFilter.toLowerCase()) : false,
    })),
    links: data.links,
  };

  const handleZoomIn = () => {
    if (fgRef.current) {
      fgRef.current.zoom(fgRef.current.zoom() * 1.3, 400);
    }
  };

  const handleZoomOut = () => {
    if (fgRef.current) {
      fgRef.current.zoom(fgRef.current.zoom() / 1.3, 400);
    }
  };

  const handleZoomReset = () => {
    if (fgRef.current) {
      fgRef.current.zoomToFit(500, 40);
    }
  };

  const getNodeColor = (node: GraphNode) => {
    if (node.id === 'The Archive Root') return '#0e7490'; // Cyan-700 root
    if (node.group === 1) return '#0284c7'; // Sky-600
    if (node.group === 2) return '#0891b2'; // Cyan-600 documents
    return '#059669'; // Emerald-600 clusters
  };

  const paintNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const isRoot = node.id === 'The Archive Root';
    const isHovered = hoveredNode?.id === node.id;
    const isMatched = node.isHighlighted;

    const baseRadius = isRoot ? 10 : 7;
    const radius = Math.max(3, baseRadius);

    // Outer subtle glow for hovered or search match
    if (isHovered || isMatched) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius + 4, 0, 2 * Math.PI, false);
      ctx.fillStyle = isRoot ? 'rgba(14, 116, 144, 0.2)' : 'rgba(8, 145, 178, 0.2)';
      ctx.fill();
    }

    // Core circle
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
    ctx.fillStyle = isMatched ? '#d97706' : getNodeColor(node);
    ctx.fill();
    ctx.strokeStyle = isHovered ? '#0e7490' : 'rgba(100, 116, 139, 0.4)';
    ctx.lineWidth = 1.5 / globalScale;
    ctx.stroke();

    // Node label
    const label = node.id;
    const fontSize = Math.max(10 / globalScale, 3);
    ctx.font = `${isHovered ? 'bold ' : ''}${fontSize}px Inter, -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Label background pill
    const textWidth = ctx.measureText(label).width;
    const bckgDimensions = [textWidth + 8 / globalScale, fontSize + 4 / globalScale];
    const pillX = node.x - bckgDimensions[0] / 2;
    const pillY = node.y + radius + 3 / globalScale;
    const pillW = bckgDimensions[0];
    const pillH = bckgDimensions[1];

    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.strokeStyle = isHovered ? '#0891b2' : '#cbd5e1';
    ctx.lineWidth = 1 / globalScale;

    if (typeof ctx.roundRect === 'function') {
      ctx.beginPath();
      ctx.roundRect(pillX, pillY, pillW, pillH, 3 / globalScale);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillRect(pillX, pillY, pillW, pillH);
      ctx.strokeRect(pillX, pillY, pillW, pillH);
    }

    ctx.fillStyle = isHovered ? '#0e7490' : '#0f172a';
    ctx.fillText(label, node.x, pillY + (pillH / 2));
  }, [hoveredNode]);

  return (
    <div ref={containerRef} className="relative w-full h-full bg-white overflow-hidden select-none">
      {/* Top Toolbar */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/95 border border-slate-200 backdrop-blur-xs shadow-crisp-xs text-xs text-slate-700">
          <Layers className="w-3.5 h-3.5 text-cyan-600" />
          <span className="font-semibold text-slate-900">Semantic Knowledge Graph</span>
          <span className="text-[10px] text-slate-500 font-mono">
            ({data.nodes.length} nodes, {data.links.length} links)
          </span>
        </div>

        {/* Search / Filter input */}
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Search nodes..."
            className="pl-8 pr-3 py-1 text-xs rounded-lg bg-white/95 border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 backdrop-blur-xs w-36 transition-all focus:w-48 shadow-crisp-xs"
          />
        </div>
      </div>

      {/* Floating Zoom & Fit Controls */}
      <div className="absolute bottom-5 right-5 z-20 flex flex-col gap-1.5 bg-white/95 border border-slate-200 p-1 rounded-xl backdrop-blur-xs shadow-crisp-sm">
        <button
          onClick={handleZoomIn}
          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={handleZoomReset}
          className="p-1.5 text-slate-600 hover:text-cyan-700 hover:bg-slate-100 rounded-lg transition-colors"
          title="Fit to Screen"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Interactive Node/Link Inspector Overlay */}
      {hoveredNode && hoveredNode.id !== 'The Archive Root' && (
        <div className="absolute top-16 left-4 z-20 max-w-xs p-3.5 rounded-xl bg-white/95 border border-slate-200 backdrop-blur-xs shadow-crisp-md animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center gap-2 mb-1.5">
            <FileText className="w-4 h-4 text-cyan-700 shrink-0" />
            <h4 className="text-xs font-semibold text-slate-900 truncate">{hoveredNode.id}</h4>
          </div>
          <p className="text-[11px] text-slate-500 mb-2.5 leading-relaxed">
            Click node to open full PDF preview and view text pages.
          </p>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-600 font-mono bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200 w-fit">
            <span>Indexed Manuscript</span>
          </div>
        </div>
      )}

      {hoveredLink && hoveredLink.label && (
        <div className="absolute bottom-5 left-5 z-20 px-3 py-1.5 rounded-lg bg-white/95 border border-slate-200 text-[11px] text-slate-700 backdrop-blur-xs shadow-crisp-xs font-mono">
          Semantic Connection: <span className="text-cyan-700 font-semibold">{hoveredLink.label}</span>
        </div>
      )}

      {/* Canvas */}
      {dimensions.width > 0 && dimensions.height > 0 && (
        <ForceGraphClient
          forwardedRef={fgRef}
          width={dimensions.width}
          height={dimensions.height}
          graphData={filteredData}
          nodeCanvasObject={paintNode}
          nodePointerAreaPaint={(node: any, color, ctx) => {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(node.x, node.y, 12, 0, 2 * Math.PI, false);
            ctx.fill();
          }}
          onNodeHover={(node: any) => setHoveredNode(node || null)}
          onLinkHover={(link: any) => setHoveredLink(link || null)}
          onNodeClick={(node: any) => {
            if (node && node.id !== 'The Archive Root' && onNodeClick) {
              onNodeClick(node);
            }
          }}
          linkColor={() => 'rgba(148, 163, 184, 0.45)'}
          linkWidth={1.5}
          linkCurvature={0.12}
          linkDirectionalParticles={2}
          linkDirectionalParticleWidth={2}
          linkDirectionalParticleSpeed={0.006}
          linkDirectionalParticleColor={() => '#0891b2'}
          cooldownTicks={120}
          d3AlphaDecay={0.03}
          d3VelocityDecay={0.3}
          backgroundColor="#ffffff"
        />
      )}
    </div>
  );
}
