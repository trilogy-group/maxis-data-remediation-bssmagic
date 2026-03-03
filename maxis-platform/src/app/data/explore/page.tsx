'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchMetadata } from '@/lib/api';
import { Search, Play, X, Table, Code, Copy, Check, Database, ChevronRight, ArrowRight, Link as LinkIcon } from 'lucide-react';
import { useState } from 'react';

interface SFObject {
  name: string;
  label: string;
  keyPrefix: string | null;
}

interface SFField {
  name: string;
  label: string;
  type: string;
  length?: number;
  referenceTo?: string[];
}

export default function ExplorePage() {
  const { data: metadata } = useQuery({ queryKey: ['metadata'], queryFn: fetchMetadata });
  const [mode, setMode] = useState<'tmf' | 'soql' | 'objects'>('tmf');

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Search className="w-6 h-6 text-slate-600" /> Explore
        </h1>
        <p className="text-slate-500 text-sm mt-1">Query live data from the Maxis runtime and Salesforce</p>
      </div>

      <div className="flex gap-2 mb-6">
        {[
          { id: 'tmf' as const, label: 'TMF API Explorer', icon: Database },
          { id: 'soql' as const, label: 'SOQL Console', icon: Code },
          { id: 'objects' as const, label: 'Object Browser', icon: Search },
        ].map(tab => (
          <button key={tab.id} onClick={() => setMode(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${mode === tab.id ? 'bg-purple-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'}`}>
            <tab.icon className="w-4 h-4" />{tab.label}
          </button>
        ))}
      </div>

      {mode === 'tmf' && <TMFExplorer metadata={metadata} />}
      {mode === 'soql' && <SOQLConsole />}
      {mode === 'objects' && <ObjectBrowser />}
    </div>
  );
}

function TMFExplorer({ metadata }: { metadata?: { resources: { name: string; mapped: boolean; basePath: string | null }[] } }) {
  const [selectedEntity, setSelectedEntity] = useState('');
  const [limit, setLimit] = useState('10');
  const [filterField, setFilterField] = useState('');
  const [filterValue, setFilterValue] = useState('');
  const [results, setResults] = useState<unknown[] | null>(null);
  const [queryMs, setQueryMs] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'json'>('table');
  const [copied, setCopied] = useState(false);

  const mappedResources = metadata?.resources.filter(r => r.mapped && r.basePath) ?? [];

  const executeQuery = async () => {
    const resource = mappedResources.find(r => r.name === selectedEntity);
    if (!resource?.basePath) return;
    setLoading(true);
    setError('');
    const start = Date.now();
    try {
      const url = new URL(`/platform/api/tmf${resource.basePath}`, window.location.origin);
      url.searchParams.set('limit', limit);
      if (filterField && filterValue) url.searchParams.set(filterField, filterValue);
      const res = await fetch(url.toString(), { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setResults(Array.isArray(data) ? data : [data]);
      setQueryMs(Date.now() - start);
    } catch (e) {
      setError((e as Error).message);
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

  const columns = results?.[0] ? Object.keys(results[0] as Record<string, unknown>).filter(k => !k.startsWith('@')) : [];

  return (
    <>
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Entity</label>
            <select value={selectedEntity} onChange={e => setSelectedEntity(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
              <option value="">Select...</option>
              {mappedResources.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Filter field</label>
            <input value={filterField} onChange={e => setFilterField(e.target.value)} placeholder="e.g. status" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Filter value</label>
            <input value={filterValue} onChange={e => setFilterValue(e.target.value)} placeholder="e.g. pending" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Limit</label>
            <select value={limit} onChange={e => setLimit(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
              {['5', '10', '25', '50', '100'].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={executeQuery} disabled={!selectedEntity || loading} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm font-medium">
            <Play className="w-4 h-4" />{loading ? 'Running...' : 'Run Query'}
          </button>
          {results && <button onClick={() => { setResults(null); setError(''); }} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"><X className="w-3 h-3" /> Clear</button>}
          {results && <span className="text-xs text-slate-400">{results.length} rows in {queryMs}ms</span>}
          {results && results.length > 0 && (
            <div className="flex items-center gap-1 ml-auto bg-white border border-slate-200 rounded-lg overflow-hidden">
              <button onClick={() => setViewMode('table')} className={`px-2.5 py-1.5 text-xs flex items-center gap-1 ${viewMode === 'table' ? 'bg-purple-600 text-white' : 'text-slate-500'}`}><Table className="w-3 h-3" /> Table</button>
              <button onClick={() => setViewMode('json')} className={`px-2.5 py-1.5 text-xs flex items-center gap-1 ${viewMode === 'json' ? 'bg-purple-600 text-white' : 'text-slate-500'}`}><Code className="w-3 h-3" /> JSON</button>
            </div>
          )}
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-sm text-red-700">{error}</div>}

      {results && results.length > 0 && viewMode === 'table' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="border-b border-slate-100 bg-slate-50">{columns.slice(0, 8).map(c => <th key={c} className="text-left px-4 py-2.5 text-slate-500 font-medium whitespace-nowrap">{c}</th>)}</tr></thead>
            <tbody>{results.map((row, i) => { const r = row as Record<string, unknown>; return <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">{columns.slice(0, 8).map(c => <td key={c} className="px-4 py-2 text-slate-700 max-w-xs truncate">{typeof r[c] === 'object' ? JSON.stringify(r[c]).slice(0, 80) : String(r[c] ?? '')}</td>)}</tr>; })}</tbody>
          </table>
        </div>
      )}

      {results && results.length > 0 && viewMode === 'json' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-100">
            <span className="text-xs text-slate-500">Raw JSON</span>
            <button onClick={() => { navigator.clipboard.writeText(JSON.stringify(results, null, 2)); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="flex items-center gap-1 px-2 py-1 text-xs text-slate-600 hover:bg-slate-200 rounded">
              {copied ? <><Check className="w-3 h-3 text-green-600" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
            </button>
          </div>
          <pre className="p-4 text-xs font-mono text-slate-700 overflow-auto max-h-[600px] whitespace-pre-wrap">{JSON.stringify(results, null, 2)}</pre>
        </div>
      )}
    </>
  );
}

function SOQLConsole() {
  const [query, setQuery] = useState('SELECT Id, Name, csord__Status__c FROM csord__Solution__c LIMIT 5');
  const [result, setResult] = useState<{ totalSize?: number; records?: Record<string, unknown>[]; error?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [ms, setMs] = useState(0);

  const run = async () => {
    if (!query.trim()) return;
    setLoading(true);
    const start = Date.now();
    try {
      const res = await fetch('/platform/api/soql', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) });
      setResult(await res.json());
      setMs(Date.now() - start);
    } catch (e) {
      setResult({ error: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };

  const records = result?.records || [];
  const columns = records[0] ? Object.keys(records[0]) : [];

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-900 mb-3">SOQL Query</h3>
        <textarea value={query} onChange={e => setQuery(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono h-24 resize-none bg-slate-50" placeholder="SELECT Id, Name FROM Account LIMIT 10" />
        <div className="flex items-center gap-3 mt-3">
          <button onClick={run} disabled={loading || !query.trim()} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
            <Play className="w-4 h-4" />{loading ? 'Running...' : 'Execute'}
          </button>
          {result && !result.error && <span className="text-xs text-slate-400">{result.totalSize} rows, {ms}ms</span>}
        </div>
      </div>

      {result?.error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 font-mono">{result.error}</div>}

      {records.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="border-b border-slate-100 bg-slate-50">{columns.map(c => <th key={c} className="text-left px-4 py-2.5 text-slate-500 font-medium whitespace-nowrap">{c}</th>)}</tr></thead>
            <tbody>{records.slice(0, 100).map((row, i) => <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">{columns.map(c => <td key={c} className="px-4 py-2 text-slate-700 max-w-xs truncate font-mono">{typeof row[c] === 'object' ? JSON.stringify(row[c]) : String(row[c] ?? '')}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ObjectBrowser() {
  const [search, setSearch] = useState('');
  const [objects, setObjects] = useState<SFObject[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedObject, setSelectedObject] = useState<string | null>(null);
  const [describe, setDescribe] = useState<{ name: string; label: string; fields: SFField[]; fieldCount: number } | null>(null);
  const [descLoading, setDescLoading] = useState(false);
  const [fieldFilter, setFieldFilter] = useState('');
  const [fieldTypeFilter, setFieldTypeFilter] = useState('all');

  const searchObjects = async () => {
    setLoading(true);
    try {
      const res = await fetch('/platform/api/soql', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'list_objects', search }) });
      const data = await res.json();
      setObjects(data.objects || []);
    } catch { setObjects([]); }
    finally { setLoading(false); }
  };

  const describeObj = async (name: string) => {
    setSelectedObject(name);
    setDescLoading(true);
    setDescribe(null);
    try {
      const res = await fetch('/platform/api/soql', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'describe', object_name: name }) });
      setDescribe(await res.json());
    } catch { /* ignore */ }
    finally { setDescLoading(false); }
  };

  const filteredFields = describe?.fields?.filter((f: SFField) => {
    const matchName = !fieldFilter || f.name.toLowerCase().includes(fieldFilter.toLowerCase()) || f.label.toLowerCase().includes(fieldFilter.toLowerCase());
    const matchType = fieldTypeFilter === 'all' || f.type === fieldTypeFilter || (fieldTypeFilter === 'reference' && f.referenceTo?.length);
    return matchName && matchType;
  }) || [];

  const relationships = describe?.fields?.filter((f: SFField) => f.referenceTo && f.referenceTo.length > 0) || [];
  const fieldTypes = describe?.fields ? [...new Set(describe.fields.map((f: SFField) => f.type))].sort() : [];

  return (
    <div className="grid grid-cols-3 gap-6">
      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="font-semibold text-slate-900 mb-3 text-sm">Search Salesforce Objects</h3>
          <div className="flex gap-2">
            <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchObjects()} placeholder="e.g. Solution, Service, Basket..." className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            <button onClick={searchObjects} disabled={loading} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {loading ? '...' : 'Search'}
            </button>
          </div>
        </div>

        {objects.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden max-h-[500px] overflow-y-auto">
            <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 text-xs text-slate-500">{objects.length} objects found</div>
            {objects.map(obj => (
              <button key={obj.name} onClick={() => describeObj(obj.name)}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-left text-sm border-b border-slate-50 hover:bg-slate-50 transition-colors ${selectedObject === obj.name ? 'bg-purple-50 border-l-2 border-l-purple-500' : ''}`}>
                <div>
                  <div className="font-medium text-slate-900">{obj.label}</div>
                  <div className="text-[10px] text-slate-500 font-mono">{obj.name}</div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="col-span-2">
        {descLoading && (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
            <div className="animate-spin w-8 h-8 border-2 border-slate-200 border-t-purple-600 rounded-full mx-auto mb-3" />
            Loading schema for {selectedObject}...
          </div>
        )}

        {describe && !descLoading && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-slate-900 text-lg">{describe.label || describe.name}</h3>
                  <div className="text-xs text-slate-500 font-mono">{describe.name}</div>
                </div>
                <div className="flex gap-3 text-sm">
                  <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded font-medium">{describe.fieldCount} fields</span>
                  <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded font-medium">{relationships.length} relationships</span>
                </div>
              </div>

              {relationships.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2 flex items-center gap-1"><LinkIcon className="w-3 h-3" /> Relationships</h4>
                  <div className="flex flex-wrap gap-2">
                    {relationships.map((f: SFField) => (
                      <button key={f.name} onClick={() => f.referenceTo?.[0] && describeObj(f.referenceTo[0])}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-xs hover:bg-purple-100 transition-colors">
                        <span className="font-mono">{f.name}</span>
                        <ArrowRight className="w-3 h-3" />
                        <span className="font-medium">{f.referenceTo?.join(', ')}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 mb-3">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input value={fieldFilter} onChange={e => setFieldFilter(e.target.value)} placeholder="Filter fields..." className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded text-xs" />
                </div>
                <select value={fieldTypeFilter} onChange={e => setFieldTypeFilter(e.target.value)} className="px-2 py-1.5 border border-slate-200 rounded text-xs bg-white">
                  <option value="all">All types</option>
                  <option value="reference">References only</option>
                  {fieldTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <span className="text-xs text-slate-400">{filteredFields.length} shown</span>
              </div>

              <div className="max-h-[400px] overflow-y-auto border border-slate-200 rounded-lg">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-slate-50">
                    <tr className="border-b border-slate-200">
                      <th className="text-left px-3 py-2 text-slate-500 font-medium">Field</th>
                      <th className="text-left px-3 py-2 text-slate-500 font-medium">Label</th>
                      <th className="text-left px-3 py-2 text-slate-500 font-medium">Type</th>
                      <th className="text-left px-3 py-2 text-slate-500 font-medium">Reference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFields.map((f: SFField) => (
                      <tr key={f.name} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="px-3 py-1.5 font-mono text-slate-800">{f.name}</td>
                        <td className="px-3 py-1.5 text-slate-600">{f.label}</td>
                        <td className="px-3 py-1.5">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${f.type === 'reference' ? 'bg-purple-100 text-purple-700' : f.type === 'boolean' ? 'bg-green-100 text-green-700' : f.type === 'picklist' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                            {f.type}
                          </span>
                        </td>
                        <td className="px-3 py-1.5">
                          {f.referenceTo?.map(ref => (
                            <button key={ref} onClick={() => describeObj(ref)} className="text-purple-600 hover:text-purple-800 font-mono underline">{ref}</button>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {!describe && !descLoading && (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
            <Database className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">Search for an object and click to explore its schema</p>
            <p className="text-xs mt-1">See fields, types, and relationships. Click references to navigate between objects.</p>
          </div>
        )}
      </div>
    </div>
  );
}
