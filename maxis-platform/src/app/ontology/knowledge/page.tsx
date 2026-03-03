'use client';

import { TRIBAL_KNOWLEDGE, DETECTION_FUNCTIONS } from '@/lib/tribal-knowledge-data';
import { BookOpen, AlertTriangle, Search as SearchIcon, ChevronDown, ChevronRight, Lightbulb, Shield, Zap } from 'lucide-react';
import { useState } from 'react';

export default function KnowledgePage() {
  const [expandedTK, setExpandedTK] = useState<string | null>(null);
  const [expandedDet, setExpandedDet] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'critical' | 'high'>('all');

  const filteredTK = TRIBAL_KNOWLEDGE.filter(tk => filter === 'all' || tk.severity === filter);
  const filteredDet = DETECTION_FUNCTIONS.filter(d => filter === 'all' || d.severity === filter);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-slate-600" /> Ontology Knowledge Store
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Tribal knowledge and detection functions discovered through ontology investigations.
          This knowledge grows as new issues are investigated — the ontology is a living system.
        </p>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div className="flex bg-white border border-slate-200 rounded-lg overflow-hidden">
          {(['all', 'critical', 'high'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-2 text-xs font-medium capitalize ${filter === f ? 'bg-purple-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
              {f}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-400">{filteredTK.length} insights, {filteredDet.length} detections</span>
      </div>

      <div className="mb-8">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
          <Lightbulb className="w-4 h-4" /> Tribal Knowledge ({filteredTK.length})
          <span className="text-slate-400 font-normal normal-case">- Insights discovered from real investigations, confirmed by evidence</span>
        </h2>

        <div className="space-y-2">
          {filteredTK.map(tk => {
            const isExpanded = expandedTK === tk.id;
            return (
              <div key={tk.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <button onClick={() => setExpandedTK(isExpanded ? null : tk.id)}
                  className="w-full flex items-start gap-3 px-5 py-4 text-left hover:bg-slate-50 transition-colors">
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">{tk.id}</span>
                      <span className={`px-1.5 py-0.5 text-[10px] rounded font-medium ${tk.severity === 'critical' ? 'bg-red-100 text-red-700' : tk.severity === 'high' ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {tk.severity.toUpperCase()}
                      </span>
                      <span className="text-[10px] text-slate-400">{tk.domain}</span>
                      {tk.relatedEntity && <span className="text-[10px] text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">{tk.relatedEntity}</span>}
                    </div>
                    <p className="text-sm text-slate-800">{tk.fact}</p>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-100 px-5 py-4 bg-slate-50/50 space-y-3">
                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 uppercase mb-1">Evidence Query</h4>
                      <code className="block text-xs text-slate-700 bg-white p-2 rounded border border-slate-200 font-mono whitespace-pre-wrap">{tk.evidenceQuery}</code>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 uppercase mb-1">Evidence Result</h4>
                      <p className="text-xs text-slate-700 bg-green-50 p-2 rounded border border-green-200">{tk.evidenceResult}</p>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 uppercase mb-1">Implication</h4>
                      <p className="text-xs text-slate-700">{tk.implication}</p>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 uppercase mb-1">Resolution</h4>
                      <p className="text-xs text-slate-700">{tk.resolution}</p>
                    </div>
                    <div className="flex items-center gap-4 text-[10px] text-slate-400 pt-2 border-t border-slate-200">
                      <span>Confirmed by: {tk.confirmedBy.join(', ')}</span>
                      <span>Discovered: {tk.discoveredDate}</span>
                      <span>Scope: {tk.scope}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4" /> Detection Functions ({filteredDet.length})
          <span className="text-slate-400 font-normal normal-case">- Live SOQL-based checks that can run against production</span>
        </h2>

        <div className="space-y-2">
          {filteredDet.map(det => {
            const isExpanded = expandedDet === det.name;
            return (
              <div key={det.name} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <button onClick={() => setExpandedDet(isExpanded ? null : det.name)}
                  className="w-full flex items-start gap-3 px-5 py-4 text-left hover:bg-slate-50 transition-colors">
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-slate-700">{det.name}</span>
                      <span className={`px-1.5 py-0.5 text-[10px] rounded font-medium ${det.severity === 'critical' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                        {det.severity.toUpperCase()}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">{det.objectType}</span>
                      <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded">{det.source}</span>
                    </div>
                    <p className="text-sm text-slate-600">{det.description}</p>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-100 px-5 py-4 bg-slate-50/50 space-y-3">
                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 uppercase mb-1">SOQL Condition</h4>
                      <code className="block text-xs text-slate-700 bg-white p-2 rounded border border-slate-200 font-mono whitespace-pre-wrap">{det.soqlCondition}</code>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 uppercase mb-1">Resolution Action</h4>
                      <p className="text-xs text-slate-700">{det.resolutionAction}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
