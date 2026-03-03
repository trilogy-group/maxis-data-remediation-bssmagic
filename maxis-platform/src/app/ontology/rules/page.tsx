'use client';

import { DETECTION_RULES } from '@/lib/rules-data';
import { DETECTION_FUNCTIONS } from '@/lib/tribal-knowledge-data';
import { Shield, AlertTriangle, Tag, Zap, Search } from 'lucide-react';
import Link from 'next/link';

export default function RulesPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Shield className="w-6 h-6 text-slate-600" /> Rules
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Business rules and data layer constraints governing the Maxis ontology
        </p>
      </div>

      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Business Rules (Detection)</h2>

      <div className="space-y-4">
        {DETECTION_RULES.map(rule => (
          <div key={rule.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100">
              <div className="flex items-center gap-3">
                <AlertTriangle className={`w-5 h-5 ${rule.severity === 'critical' ? 'text-red-500' : rule.severity === 'high' ? 'text-orange-500' : 'text-yellow-500'}`} />
                <h3 className="font-semibold text-slate-900">{rule.name}</h3>
                <span className={`${rule.tagColor} text-white text-xs px-2 py-0.5 rounded-full font-medium`}>{rule.tag}</span>
              </div>
              <span className={`px-2 py-1 text-xs rounded font-medium ${
                rule.severity === 'critical' ? 'bg-red-100 text-red-700' :
                rule.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                'bg-yellow-100 text-yellow-700'
              }`}>
                {rule.severity.toUpperCase()}
              </span>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Rule Content</h4>
                <p className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3 font-mono">{rule.condition}</p>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Description</h4>
                <p className="text-sm text-slate-600">{rule.description}</p>
              </div>

              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Affected Entities</h4>
                  <div className="flex flex-wrap gap-1">
                    {rule.affectedEntities.map(e => (
                      <span key={e} className="px-2 py-0.5 bg-purple-50 text-purple-700 text-xs rounded">{e}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Detection View</h4>
                  <span className="font-mono text-xs text-slate-600">{rule.sqlView}</span>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Detection Field</h4>
                  <span className="font-mono text-xs text-slate-600 break-all">{rule.detectionField}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Data Layer Constraints (Technical)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-10">
          {[
            { id: 1, title: 'Solution mapped as Product (not Agreement)', detail: 'TMF637 Product has richer pricing/characteristic structures needed for dashboard and remediation, even though TMF651 Agreement is a closer conceptual fit.' },
            { id: 2, title: 'Zero-JOIN Service view', detail: 'Service view (321K records) uses zero JOINs for maximum FDW performance. All enrichment is via direct fields or client-side resolution.' },
            { id: 3, title: 'Custom x_* detection fields', detail: 'Detection flags exposed as filterable custom fields (x_has1867Issue, x_migratedData) enabling efficient SOQL-pushdown queries.' },
            { id: 4, title: 'Attribute table excluded (7.5M records)', detail: 'cscfga__Attribute__c deliberately not JOINed — FDW would perform a full table scan. Characteristics sourced from parent object fields instead.' },
            { id: 5, title: 'Status2__c over Status__c for Orders', detail: 'Maxis uses csord__Status2__c as authoritative order status. Legacy Status__c never transitions — would show all orders as stuck.' },
            { id: 6, title: 'Actions modeled as TMF entities', detail: 'REST FDW write operations exposed as TMF-like entities with standard CRUD semantics — making the system an operational ontology, not a read-only data lake.' },
            { id: 7, title: 'Rule-based, not AI-orchestrated (current phase)', detail: 'All detection/remediation is deterministic. State machines, MACD safety rules encoded as explicit code. Ontology supports future AI orchestration.' },
          ].map(d => (
            <div key={d.id} className="bg-white rounded-lg border border-slate-200 p-4">
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[10px] font-bold shrink-0">{d.id}</div>
                <div>
                  <h3 className="font-medium text-slate-900 text-sm">{d.title}</h3>
                  <p className="text-xs text-slate-500 mt-1">{d.detail}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Search className="w-5 h-5 text-green-600" /> Discovered Detection Functions
            </h2>
            <p className="text-sm text-slate-500">Rules that emerged from ontology discovery investigations — not hand-coded but found through data analysis</p>
          </div>
          <Link href="/ontology/knowledge" className="text-xs text-purple-600 hover:text-purple-700 font-medium">View all knowledge →</Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {DETECTION_FUNCTIONS.map(det => (
            <div key={det.name} className="bg-white rounded-xl border border-dashed border-green-300 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-green-600" />
                <span className="font-mono text-xs text-slate-700">{det.name}</span>
                <span className={`px-1.5 py-0.5 text-[10px] rounded font-medium ${det.severity === 'critical' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>{det.severity}</span>
                <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded ml-auto">discovered</span>
              </div>
              <p className="text-xs text-slate-600 mb-2">{det.description}</p>
              <code className="text-[10px] text-slate-500 font-mono block truncate">{det.soqlCondition}</code>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
