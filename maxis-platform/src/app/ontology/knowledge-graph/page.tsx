'use client';

import { Share2 } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface GraphNode {
  id: string; label: string; tmf: string; x: number; y: number; color: string; domain: string; records?: string; hasIssues?: boolean;
}

const NODES: GraphNode[] = [
  { id: 'opportunity', label: 'Opportunity', tmf: '(Pre-sales)', x: 250, y: 30, color: '#94a3b8', domain: 'Sales', records: '~100K' },
  { id: 'account', label: 'Account', tmf: 'TMF632 Organization', x: 80, y: 160, color: '#3b82f6', domain: 'Customer', records: '~50K' },
  { id: 'contact', label: 'Contact', tmf: 'TMF632 Individual', x: 80, y: 310, color: '#3b82f6', domain: 'Customer', records: '~80K' },
  { id: 'billing', label: 'Billing Account', tmf: 'TMF666', x: 80, y: 460, color: '#3b82f6', domain: 'Customer', records: '~120K' },
  { id: 'basket', label: 'Product Basket', tmf: 'TMF663 ShoppingCart', x: 380, y: 130, color: '#8b5cf6', domain: 'Commercial', records: '~200K' },
  { id: 'config', label: 'Product Config', tmf: 'TMF637 (618K)', x: 380, y: 290, color: '#8b5cf6', domain: 'Commercial', records: '618K' },
  { id: 'order', label: 'Order', tmf: 'TMF622 ProductOrder', x: 380, y: 440, color: '#8b5cf6', domain: 'Commercial', records: '~150K' },
  { id: 'solution', label: 'Solution', tmf: 'TMF637 Product', x: 660, y: 80, color: '#f59e0b', domain: 'Fulfillment', records: '~520K', hasIssues: true },
  { id: 'subscription', label: 'Subscription', tmf: 'TMF637 (child)', x: 660, y: 230, color: '#f59e0b', domain: 'Fulfillment', records: '142K' },
  { id: 'service', label: 'Service', tmf: 'TMF638 Service', x: 660, y: 380, color: '#f59e0b', domain: 'Fulfillment', records: '321K', hasIssues: true },
  { id: 'attribute', label: 'Attribute', tmf: '(Characteristic)', x: 380, y: 570, color: '#94a3b8', domain: 'Commercial', records: '7.5M' },
  { id: 'problem', label: 'ServiceProblem', tmf: 'TMF656', x: 920, y: 230, color: '#ef4444', domain: 'Issue Tracking', records: 'Dynamic' },
  { id: 'batchjob', label: 'BatchJob', tmf: 'Custom', x: 920, y: 380, color: '#ef4444', domain: 'Issue Tracking' },
];

const EDGES = [
  { from: 'opportunity', to: 'basket', label: 'creates' },
  { from: 'account', to: 'contact', label: 'has contacts' },
  { from: 'account', to: 'billing', label: 'has billing' },
  { from: 'account', to: 'order', label: 'places' },
  { from: 'basket', to: 'config', label: 'contains' },
  { from: 'config', to: 'attribute', label: '7.5M attrs' },
  { from: 'solution', to: 'order', label: 'creates' },
  { from: 'solution', to: 'subscription', label: 'contains' },
  { from: 'subscription', to: 'service', label: 'provisions' },
  { from: 'service', to: 'problem', label: 'has issues' },
  { from: 'solution', to: 'problem', label: 'has issues' },
  { from: 'problem', to: 'batchjob', label: 'remediated by' },
  { from: 'billing', to: 'service', label: 'bills for' },
];

const DOMAIN_COLORS: Record<string, { bg: string; label: string }> = {
  'Customer': { bg: '#3b82f6', label: 'Customer Domain' },
  'Sales': { bg: '#94a3b8', label: 'Pre-sales (Not Deployed)' },
  'Commercial': { bg: '#8b5cf6', label: 'Sales / Commercial' },
  'Fulfillment': { bg: '#f59e0b', label: 'Fulfillment / Operations' },
  'Issue Tracking': { bg: '#ef4444', label: 'BSS Magic (Issue Tracking)' },
};

const NODE_TO_VIEW: Record<string, string> = {
  account: 'organization.sql', contact: 'individual.sql', billing: 'billingAccount.sql',
  basket: 'shoppingCart.sql', order: 'productOrder.sql', solution: 'product.sql',
  subscription: '', service: 'service.sql', config: '', problem: 'serviceProblem.sql',
  batchjob: 'batchJob.sql', opportunity: '', attribute: '',
};

export default function KnowledgeGraphPage() {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const router = useRouter();

  const connectedNodes = new Set<string>();
  const connectedEdgeIndices = new Set<number>();
  if (hoveredNode) {
    EDGES.forEach((edge, i) => {
      if (edge.from === hoveredNode || edge.to === hoveredNode) {
        connectedNodes.add(edge.from);
        connectedNodes.add(edge.to);
        connectedEdgeIndices.add(i);
      }
    });
  }

  const isHighlighted = (nodeId: string) => !hoveredNode || hoveredNode === nodeId || connectedNodes.has(nodeId);
  const isEdgeHighlighted = (i: number) => !hoveredNode || connectedEdgeIndices.has(i);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Share2 className="w-6 h-6 text-slate-600" /> Knowledge Graph
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Entity relationships in the Maxis CloudSense ontology. Hover over a node to highlight connections.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <svg viewBox="0 0 1080 620" className="w-full h-auto" style={{ minHeight: 500 }}>
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
            </marker>
            <marker id="arrowhead-bright" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="#8b5cf6" />
            </marker>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>

          {EDGES.map((edge, i) => {
            const from = NODES.find(n => n.id === edge.from)!;
            const to = NODES.find(n => n.id === edge.to)!;
            const midX = (from.x + 70 + to.x) / 2;
            const midY = (from.y + 25 + to.y + 25) / 2;
            const highlighted = isEdgeHighlighted(i);
            return (
              <g key={i} style={{ opacity: highlighted ? 1 : 0.15, transition: 'opacity 0.2s' }}>
                <line x1={from.x + 70} y1={from.y + 25} x2={to.x} y2={to.y + 25}
                  stroke={highlighted && hoveredNode ? '#8b5cf6' : '#cbd5e1'} strokeWidth={highlighted && hoveredNode ? 2 : 1.5}
                  markerEnd={highlighted && hoveredNode ? 'url(#arrowhead-bright)' : 'url(#arrowhead)'} />
                <text x={midX} y={midY - 4} fontSize="8" fill={highlighted && hoveredNode ? '#7c3aed' : '#94a3b8'} textAnchor="middle" fontWeight={highlighted && hoveredNode ? '600' : '400'}>{edge.label}</text>
              </g>
            );
          })}

          {NODES.map(node => {
            const highlighted = isHighlighted(node.id);
            const isNotDeployed = node.color === '#94a3b8';
            return (
              <g key={node.id}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                onClick={() => { const v = NODE_TO_VIEW[node.id]; if (v) router.push(`/platform/data/pipelines?view=${v}`); }}
                style={{ cursor: 'pointer', opacity: highlighted ? 1 : 0.2, transition: 'opacity 0.2s' }}
                filter={node.hasIssues ? 'url(#glow)' : undefined}
              >
                <rect x={node.x} y={node.y} width="140" height="50" rx="8"
                  fill={isNotDeployed ? '#f8fafc' : `${node.color}10`}
                  stroke={hoveredNode === node.id ? node.color : isNotDeployed ? '#cbd5e1' : node.color}
                  strokeWidth={hoveredNode === node.id ? 2.5 : 1.5}
                  strokeDasharray={isNotDeployed ? '4 2' : undefined}
                />
                {node.hasIssues && (
                  <circle cx={node.x + 130} cy={node.y + 8} r="5" fill="#ef4444">
                    <animate attributeName="opacity" values="1;0.4;1" dur="2s" repeatCount="indefinite" />
                  </circle>
                )}
                <text x={node.x + 70} y={node.y + 19} fontSize="11" fontWeight="600" fill="#1e293b" textAnchor="middle">
                  {node.label}
                </text>
                <text x={node.x + 70} y={node.y + 32} fontSize="8" fill="#64748b" textAnchor="middle">
                  {node.tmf}
                </text>
                {node.records && (
                  <text x={node.x + 70} y={node.y + 44} fontSize="7" fill="#94a3b8" textAnchor="middle" fontFamily="monospace">
                    {node.records}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        <div className="flex items-center gap-6 mt-4 pt-4 border-t border-slate-100">
          <h4 className="text-xs font-semibold text-slate-400 uppercase">Legend</h4>
          {Object.entries(DOMAIN_COLORS).map(([, v]) => (
            <div key={v.label} className="flex items-center gap-1.5 text-xs text-slate-600">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: v.bg, opacity: 0.3 }} />
              {v.label}
            </div>
          ))}
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
            Active Issues
          </div>
        </div>
      </div>
    </div>
  );
}
