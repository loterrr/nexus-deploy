'use client';

import React from 'react';
import ForceGraph2D from 'react-force-graph-2d';

export interface ForceGraphClientProps {
  forwardedRef?: React.MutableRefObject<any>;
  width: number;
  height: number;
  graphData: any;
  nodeCanvasObject: (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => void;
  nodePointerAreaPaint: (node: any, color: string, ctx: CanvasRenderingContext2D) => void;
  onNodeHover: (node: any) => void;
  onLinkHover: (link: any) => void;
  onNodeClick: (node: any) => void;
  linkColor: (link: any) => string;
  linkWidth: number;
  linkCurvature: number;
  linkDirectionalParticles: number;
  linkDirectionalParticleWidth: number;
  linkDirectionalParticleSpeed: number;
  linkDirectionalParticleColor: (link: any) => string;
  cooldownTicks: number;
  d3AlphaDecay: number;
  d3VelocityDecay: number;
  backgroundColor: string;
}

export default function ForceGraphClient({
  forwardedRef,
  ...props
}: ForceGraphClientProps) {
  return <ForceGraph2D ref={forwardedRef as any} {...props} />;
}
