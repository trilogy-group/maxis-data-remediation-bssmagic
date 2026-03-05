'use client';

import { VIEWS } from '@/lib/views-data';
import { Link as LinkIcon, ArrowRight, ChevronDown, ChevronRight, GitBranch } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function SemanticMappingPage() {
  const csViews = VIEWS.filter(v => v.tmfEntity && v.group !== 'rest-fdw' && v.group !== 'remediation');
  const internalViews = VIEWS.filter(v => v.tmfEntity && v.group === 'remediation');
  const mappedViews = csViews;
  const [expandedView, setExpandedView] = useState<string | null>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    const entity = searchParams.get('entity');
    if (entity) {
      const view = mappedViews.find(v => v.tmfEntity === entity);
      if (view) setExpandedView(view.file);
    }
  }, [searchParams]);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <LinkIcon className="w-6 h-6 text-slate-600" /> Semantic Mapping
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Field-level mappings between CloudSense objects and TMF entities. Click a row to see full field lineage.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-6 py-3 text-slate-500 font-medium w-8"></th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Entity</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Source Object</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">TMF API</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Fields</th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium">Lineage</th>
            </tr>
          </thead>
          <tbody>
            {mappedViews.map(view => {
              const isExpanded = expandedView === view.file;
              return (
                <tr key={view.file} className="group">
                  <td colSpan={6} className="p-0">
                    <button
                      onClick={() => setExpandedView(isExpanded ? null : view.file)}
                      className="w-full flex items-center hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-6 py-3.5 w-8">
                        {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded bg-purple-100 flex items-center justify-center">
                            <LinkIcon className="w-3 h-3 text-purple-600" />
                          </div>
                          <span className="font-medium text-slate-900">{view.tmfEntity}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-mono text-xs text-slate-600">{view.sourceObject.split(' ')[0]}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded font-medium">{view.tmfApi}</span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-700">{view.fields.length}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span className="font-mono">{view.sourceObject.split(' ')[0]}</span>
                          <ArrowRight className="w-3 h-3" />
                          <span className="font-mono text-purple-600">{view.file}</span>
                          <ArrowRight className="w-3 h-3" />
                          <span className="font-mono text-green-600">{view.tmfEntity}</span>
                        </div>
                      </td>
                    </button>

                    {isExpanded && view.fields.length > 0 && view.fields[0].csField !== 'Pre-filtered WHERE' && (
                      <div className="mx-6 mb-4 border border-slate-200 rounded-lg overflow-hidden bg-slate-50/50">
                        <div className="grid grid-cols-2 gap-0">
                          <div className="bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-500 border-b border-r border-slate-200">CloudSense (Source)</div>
                          <div className="bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-500 border-b border-slate-200">TMF (Target)</div>
                          {view.fields.map((f, i) => {
                            const isArrayParent = f.tmfField.endsWith('[]') || (f.type.includes('[]') && !f.tmfField.includes('[].'));
                            const isArrayChild = f.tmfField.includes('[].') || f.csField.startsWith('PC.');
                            return (
                            <div key={i} className="contents">
                              <div className={`px-4 py-2 text-xs font-mono text-slate-700 border-r border-slate-200 flex items-center gap-2 ${i < view.fields.length - 1 ? 'border-b border-slate-100' : ''} ${isArrayChild ? 'pl-8 bg-slate-50/80' : ''}`}>
                                {isArrayParent ? (
                                  <span className="w-4 h-4 rounded bg-purple-100 text-purple-600 flex items-center justify-center text-[10px] font-bold shrink-0">+</span>
                                ) : (
                                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isArrayChild ? 'bg-purple-300' : 'bg-blue-400'}`} />
                                )}
                                {f.csField}
                                <span className="text-[10px] text-slate-400 ml-auto">{f.type}</span>
                              </div>
                              <div className={`px-4 py-2 text-xs font-mono text-purple-700 flex items-center gap-2 ${i < view.fields.length - 1 ? 'border-b border-slate-100' : ''} ${isArrayChild ? 'bg-slate-50/80' : ''}`}>
                                <ArrowRight className="w-3 h-3 text-slate-300 shrink-0" />
                                {isArrayParent ? <span className="font-semibold">{f.tmfField}</span> : f.tmfField}
                                {f.pushdown !== undefined && (
                                  <span className={`ml-auto px-1 py-0.5 rounded text-[9px] ${f.pushdown ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {f.pushdown ? 'pushdown' : 'client-side'}
                                  </span>
                                )}
                              </div>
                            </div>
                            );
                          })}
                        </div>
                        {view.whereFilter && (
                          <div className="px-4 py-2 text-xs bg-yellow-50 border-t border-yellow-200">
                            <span className="text-yellow-700 font-semibold">WHERE:</span> <code className="text-yellow-800 font-mono">{view.whereFilter}</code>
                          </div>
                        )}
                      </div>
                    )}

                    {isExpanded && view.whereFilter && view.fields[0]?.csField === 'Pre-filtered WHERE' && (
                      <div className="mx-6 mb-4 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 text-xs">
                        <span className="text-yellow-700 font-semibold">Pre-filtered view</span>
                        <div className="font-mono text-yellow-800 mt-1">WHERE {view.whereFilter}</div>
                        <div className="text-yellow-600 mt-1">This view inherits its base fields from the parent entity view and adds a WHERE clause for detection scope.</div>
                      </div>
                    )}
                    {isExpanded && (
                      <div className="mx-6 mb-4 flex items-center gap-3">
                        <Link href={`/data/pipelines?view=${view.file}`} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
                          <GitBranch className="w-3 h-3" /> View Pipeline
                        </Link>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Internal-only views */}
      {internalViews.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">Internal Platform Tables (no CloudSense source)</h2>
          <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100">
                  <th className="text-left px-6 py-2 text-slate-400 font-medium text-xs">Entity</th>
                  <th className="text-left px-4 py-2 text-slate-400 font-medium text-xs">Source</th>
                  <th className="text-left px-4 py-2 text-slate-400 font-medium text-xs">TMF API</th>
                  <th className="text-left px-4 py-2 text-slate-400 font-medium text-xs">Schema Fields</th>
                </tr>
              </thead>
              <tbody>
                {internalViews.map(v => (
                  <tr key={v.file} className="border-b border-slate-100 last:border-0">
                    <td className="px-6 py-3 font-medium text-slate-600">{v.tmfEntity}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">{v.sourceObject}</td>
                    <td className="px-4 py-3"><span className="px-2 py-0.5 bg-slate-200 text-slate-600 text-xs rounded">{v.tmfApi}</span></td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {v.fields.map(f => f.tmfField).join(', ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
