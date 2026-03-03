'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchMetadata, type TMFResource } from '@/lib/api';
import { VIEWS } from '@/lib/views-data';
import { MAXIS_OBJECTS } from '@/lib/maxis-data';
import { TRIBAL_KNOWLEDGE } from '@/lib/tribal-knowledge-data';
import { Box, Search, X, ArrowRight, Database, Link as LinkIcon, Lightbulb } from 'lucide-react';
import { useState } from 'react';

const ROADMAP_OBJECTS = [
  { name: 'Quote', apiName: 'Quote', fields: 74, tmf: 'TMF648 Quote', fit: '90%', blocker: 'Not prioritized for current remediation scope' },
  { name: 'Product Configuration', apiName: 'cscfga__Product_Configuration__c', fields: 317, tmf: 'TMF637 Product (instance)', fit: '90%', blocker: '618K records — FDW full-table-scan on JOIN' },
  { name: 'Product Definition', apiName: 'cscfga__Product_Definition__c', fields: 47, tmf: 'TMF620 ProductSpec', fit: '95%', blocker: 'Not prioritized; catalog data (static)' },
  { name: 'Subscription', apiName: 'csord__Subscription__c', fields: 80, tmf: 'TMF637 Product (sub)', fit: '80%', blocker: 'Accessed indirectly via Service.csord__Subscription__c' },
  { name: 'Attribute', apiName: 'cscfga__Attribute__c', fields: 30, tmf: 'Characteristic', fit: '75%', blocker: '7.5M records — cannot JOIN via FDW' },
  { name: 'Orchestration Process', apiName: 'CSPOFA__Orchestration_Process__c', fields: 40, tmf: 'TMF653 TaskFlow', fit: '80%', blocker: '526K processes; schema registration needed' },
  { name: 'Orchestration Step', apiName: 'CSPOFA__Orchestration_Step__c', fields: 30, tmf: 'TMF653 Task', fit: '80%', blocker: '5.7M steps; linked to Process' },
  { name: 'Opportunity', apiName: 'Opportunity', fields: 0, tmf: 'No direct TMF mapping', fit: '—', blocker: 'Pre-sales; outside fulfillment scope' },
];

export default function EntitiesPage() {
  const { data: metadata, isLoading } = useQuery({ queryKey: ['metadata'], queryFn: fetchMetadata });
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'mapped' | 'unmapped'>('mapped');
  const [selectedEntity, setSelectedEntity] = useState<TMFResource | null>(null);

  const resources = metadata?.resources ?? [];
  const filtered = resources
    .filter(r => filter === 'all' || (filter === 'mapped' ? r.mapped : !r.mapped))
    .filter(r => r.name.toLowerCase().includes(search.toLowerCase()));

  const domainGroups: Record<string, typeof filtered> = {};
  for (const r of filtered) {
    const domain = r.basePath?.split('/')[2] || 'custom';
    if (!domainGroups[domain]) domainGroups[domain] = [];
    domainGroups[domain].push(r);
  }

  const selectedView = selectedEntity ? VIEWS.find(v => v.tmfEntity === selectedEntity.name) : null;
  const selectedObj = selectedEntity ? MAXIS_OBJECTS.find(o => o.tmf.includes(selectedEntity.name) || o.tmf.includes(selectedView?.tmfApi || '___')) : null;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Box className="w-6 h-6 text-slate-600" /> Entities
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          {isLoading ? 'Loading...' : `${resources.length} TMF entities (${resources.filter(r => r.mapped).length} with active views)`}
        </p>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search entities..." className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm" />
        </div>
        <div className="flex bg-white border border-slate-200 rounded-lg overflow-hidden">
          {(['all', 'mapped', 'unmapped'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-2 text-xs font-medium capitalize ${filter === f ? 'bg-purple-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>{f}</button>
          ))}
        </div>
      </div>

      <div className="flex gap-6">
        <div className={`flex-1 ${selectedEntity ? 'max-w-[55%]' : ''} transition-all`}>
          {Object.entries(domainGroups).sort().map(([domain, entities]) => (
            <div key={domain} className="mb-6">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{domain}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {entities.map(entity => {
                  const view = VIEWS.find(v => v.tmfEntity === entity.name);
                  const isSelected = selectedEntity?.name === entity.name;
                  const relatedTK = TRIBAL_KNOWLEDGE.filter(tk => tk.relatedEntity === entity.name);
                  return (
                    <button key={entity.name} onClick={() => setSelectedEntity(isSelected ? null : entity)} className={`text-left bg-white rounded-lg border p-4 transition-all hover:shadow-md ${isSelected ? 'border-purple-500 ring-2 ring-purple-100' : entity.mapped ? 'border-green-200' : 'border-slate-200'}`}>
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-medium text-slate-900">{entity.name}</h3>
                        <div className="flex gap-1">
                          {relatedTK.length > 0 && <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] rounded font-medium flex items-center gap-0.5"><Lightbulb className="w-2.5 h-2.5" />{relatedTK.length} TK</span>}
                          {entity.mapped && <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] rounded font-medium">ACTIVE</span>}
                        </div>
                      </div>
                      {entity.basePath && <div className="text-xs text-slate-500 font-mono mb-2 truncate">{entity.basePath}</div>}
                      {view && (
                        <div className="flex flex-wrap gap-1">
                          <span className="px-1.5 py-0.5 bg-purple-50 text-purple-700 text-[10px] rounded">{view.tmfApi}</span>
                          <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] rounded">{view.fields.length} fields</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {filter === 'mapped' && (
            <div className="mt-8 mb-6">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-2">
                Roadmap <span className="text-slate-300 font-normal normal-case">- Objects identified but not yet deployed</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {ROADMAP_OBJECTS.map(obj => (
                  <div key={obj.apiName} className="bg-slate-50 rounded-lg border border-dashed border-slate-300 p-4 opacity-70">
                    <div className="flex items-start justify-between mb-1">
                      <h3 className="font-medium text-slate-700 text-sm">{obj.name}</h3>
                      {obj.fit !== '—' && <span className="px-1.5 py-0.5 bg-slate-200 text-slate-600 text-[10px] rounded">Fit: {obj.fit}</span>}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 mb-1">{obj.apiName}</div>
                    <div className="text-[10px] text-purple-500 mb-1">{obj.tmf}</div>
                    {obj.fields > 0 && <div className="text-[10px] text-slate-400">{obj.fields} fields</div>}
                    <div className="mt-1.5 text-[10px] text-red-500">{obj.blocker}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {selectedEntity && (
          <div className="w-[45%] bg-white rounded-xl border border-slate-200 h-fit sticky top-4 overflow-hidden">
            <div className="bg-slate-900 px-5 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-white text-lg">{selectedEntity.name}</h3>
                {selectedEntity.basePath && <div className="text-xs text-slate-400 font-mono mt-0.5">{selectedEntity.basePath}</div>}
              </div>
              <button onClick={() => setSelectedEntity(null)} className="p-1 hover:bg-slate-700 rounded text-slate-400"><X className="w-4 h-4" /></button>
            </div>

            <div className="p-5">
              {selectedView ? (
                <div className="space-y-5">
                  <div>
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1"><Database className="w-3 h-3" /> Source</h4>
                    <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1">
                      <div><span className="text-slate-400">CS Object:</span> <span className="font-mono text-slate-700">{selectedView.sourceObject}</span></div>
                      <div><span className="text-slate-400">TMF API:</span> <span className="text-purple-700 font-medium">{selectedView.tmfApi}</span></div>
                      <div><span className="text-slate-400">JOINs:</span> <span>{selectedView.joins}</span></div>
                      {selectedView.csFieldCount && <div><span className="text-slate-400">Coverage:</span> <span>{selectedView.mappedFieldCount}/{selectedView.csFieldCount} fields ({((selectedView.mappedFieldCount || 0) / selectedView.csFieldCount * 100).toFixed(0)}%)</span></div>}
                      {selectedObj && <div><span className="text-slate-400">Records:</span> <span className="font-mono">{selectedObj.records}</span></div>}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1"><Box className="w-3 h-3" /> Properties ({selectedView.fields.length})</h4>
                    <div className="space-y-1 max-h-64 overflow-y-auto">
                      {selectedView.fields.map((f, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs bg-slate-50 rounded px-2.5 py-1.5">
                          <span className="text-slate-500 font-mono flex-1 truncate">{f.csField}</span>
                          <ArrowRight className="w-3 h-3 text-slate-300 shrink-0" />
                          <span className="text-purple-700 font-mono flex-1 truncate text-right">{f.tmfField}</span>
                          <span className="text-[10px] text-slate-400 shrink-0 w-16 text-right">{f.type}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1"><LinkIcon className="w-3 h-3" /> Related Entities</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {VIEWS.filter(v => v.fields.some(f => f.tmfField.toLowerCase().includes(selectedEntity.name.toLowerCase()) || f.csField.toLowerCase().includes(selectedView.sourceObject.split(' ')[0].toLowerCase()))).filter(v => v.tmfEntity !== selectedEntity.name).map(v => (
                        <span key={v.tmfEntity} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded cursor-pointer hover:bg-blue-100" onClick={() => { const r = resources.find(x => x.name === v.tmfEntity); if (r) setSelectedEntity(r); }}>
                          {v.tmfEntity}
                        </span>
                      ))}
                      {VIEWS.filter(v => v.fields.some(f => f.tmfField.toLowerCase().includes(selectedEntity.name.toLowerCase()))).filter(v => v.tmfEntity !== selectedEntity.name).length === 0 && (
                        <span className="text-xs text-slate-400">No direct references found</span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-slate-400 py-8">
                  <Box className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No SQL view deployed for this entity</p>
                  <p className="text-xs mt-1">This TMF entity exists in the schema but has no active mapping</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
