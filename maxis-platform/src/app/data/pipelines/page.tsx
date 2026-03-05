'use client';

import { VIEWS, VIEW_GROUPS } from '@/lib/views-data';
import { GitBranch, ChevronDown, ChevronRight, FileCode, ArrowRight, Code, Link as LinkIcon, Zap, AlertTriangle, Database, Plus, X, Play, Upload, RefreshCw, Pencil, Trash2, CheckCircle, Loader2, Circle, Wifi } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { fetchMetadata } from '@/lib/api';
import Link from 'next/link';

const VIEW_TEMPLATE = `-- New TMF Entity View
-- Source: salesforce_server."<YourObject__c>"
-- Endpoint: /tmf-api/<domain>/v5/<entityName>

DROP VIEW IF EXISTS salesforce_server."<entityName>";
CREATE VIEW salesforce_server."<entityName>" AS
SELECT
    t0."Id"::text AS id,
    ('http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/<domain>/v5/<entityName>/' || t0."Id")::text AS href,
    t0."Name"::text AS "name",
    -- Add field mappings here:
    -- t0."YourField__c"::text AS "tmfFieldName",
    '<EntityType>'::text AS "@type",
    'Entity'::text AS "@baseType"
FROM salesforce_server."<YourObject__c>" t0;`;

interface DeployResult {
  success: boolean;
  output?: string;
  error?: string;
  manualCommand?: string;
  fallback?: string;
}

export default function PipelinesPage() {
  const [expandedView, setExpandedView] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editorSql, setEditorSql] = useState(VIEW_TEMPLATE);
  const [editorTitle, setEditorTitle] = useState('New View');
  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<DeployResult | null>(null);
  const [redeployingAll, setRedeployingAll] = useState(false);
  const [redeployProgress, setRedeployProgress] = useState<string[]>([]);
  const searchParams = useSearchParams();

  const { data: metadata, isLoading: metaLoading, refetch: refetchMeta } = useQuery({
    queryKey: ['metadata'],
    queryFn: fetchMetadata,
    staleTime: 30000,
  });

  const mappedEntities = new Set(
    metadata?.resources.filter(r => r.mapped).map(r => r.name) ?? []
  );
  const allKnownEntities = new Set(
    metadata?.resources.map(r => r.name) ?? []
  );

  const openEditor = (title: string, sql: string) => {
    setEditorTitle(title);
    setEditorSql(sql);
    setDeployResult(null);
    setShowEditor(true);
  };

  const deployToRuntime = async () => {
    setDeploying(true);
    setDeployResult(null);
    try {
      const res = await fetch('/platform/api/runtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'execute-sql', sql: editorSql, environment: 'production' }),
      });
      const data = await res.json();
      setDeployResult(data);
    } catch (err) {
      setDeployResult({ success: false, error: String(err) });
    } finally {
      setDeploying(false);
    }
  };

  useEffect(() => {
    const viewFile = searchParams.get('view');
    if (viewFile) setExpandedView(viewFile);
  }, [searchParams]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <GitBranch className="w-6 h-6 text-slate-600" /> Pipelines
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            SQL transformation layer — how CloudSense data becomes TMF entities. {VIEWS.length} views deployed.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/data/mapping-builder"
            className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors font-medium"
          >
            <Plus className="w-4 h-4" /> Create View
          </Link>
          <button
            onClick={async () => {
              setRedeployingAll(true);
              setRedeployProgress(['Starting redeploy...']);
              try {
                const res = await fetch('/platform/api/runtime', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'get-deploy-order' }),
                });
                const { deployOrder } = await res.json();
                for (const group of deployOrder) {
                  setRedeployProgress(prev => [...prev, `--- ${group.group} ---`]);
                  for (const file of group.files) {
                    const view = VIEWS.find(v => v.file === file);
                    if (view?.sqlSnippet) {
                      setRedeployProgress(prev => [...prev, `Deploying ${file}...`]);
                      await fetch('/platform/api/runtime', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'execute-sql', sql: view.sqlSnippet, environment: 'production' }),
                      });
                      setRedeployProgress(prev => [...prev, `  ✓ ${file}`]);
                    } else {
                      setRedeployProgress(prev => [...prev, `  ⊘ ${file} (no SQL available)`]);
                    }
                  }
                }
                setRedeployProgress(prev => [...prev, 'All views redeployed!']);
              } catch (err) {
                setRedeployProgress(prev => [...prev, `Error: ${String(err)}`]);
              } finally {
                setRedeployingAll(false);
              }
            }}
            disabled={redeployingAll}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 text-sm rounded-lg hover:bg-slate-50 transition-colors font-medium disabled:opacity-50"
          >
            {redeployingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Redeploy All
          </button>
        </div>
      </div>

      {/* Redeploy progress log */}
      {redeployProgress.length > 0 && (
        <div className="mb-6 bg-slate-900 rounded-xl p-4 max-h-48 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 font-medium">Deploy Log</span>
            {!redeployingAll && <button onClick={() => setRedeployProgress([])} className="text-xs text-slate-500 hover:text-slate-300">Clear</button>}
          </div>
          {redeployProgress.map((line, i) => (
            <div key={i} className={`text-[11px] font-mono ${line.startsWith('  ✓') ? 'text-green-400' : line.startsWith('  ⊘') ? 'text-slate-500' : line.startsWith('Error') ? 'text-red-400' : line.startsWith('---') ? 'text-blue-400 font-semibold' : 'text-slate-300'}`}>{line}</div>
          ))}
        </div>
      )}

      {/* SQL Editor Modal */}
      {showEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowEditor(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Code className="w-5 h-5 text-purple-600" />
                <h2 className="font-semibold text-slate-900">{editorTitle}</h2>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={deployToRuntime} disabled={deploying} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium">
                  {deploying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                  Deploy to Runtime
                </button>
                <button onClick={() => setShowEditor(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="p-4">
              <textarea
                value={editorSql}
                onChange={e => setEditorSql(e.target.value)}
                className="w-full h-80 font-mono text-[12px] bg-[#1e1e2e] text-green-400 p-4 rounded-lg border border-slate-700 focus:outline-none focus:border-purple-500 resize-none leading-relaxed"
                spellCheck={false}
              />
            </div>
            {deployResult && (
              <div className={`mx-4 mb-4 rounded-lg p-4 text-xs ${deployResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <div className="flex items-center gap-2 mb-1">
                  {deployResult.success ? <CheckCircle className="w-4 h-4 text-green-600" /> : <AlertTriangle className="w-4 h-4 text-red-600" />}
                  <span className={`font-semibold ${deployResult.success ? 'text-green-800' : 'text-red-800'}`}>
                    {deployResult.success ? 'SQL submitted to runtime' : 'Deploy failed'}
                  </span>
                </div>
                <p className="text-slate-600">{deployResult.output || deployResult.error}</p>
                {deployResult.manualCommand && (
                  <div className="mt-2">
                    <div className="text-[10px] text-slate-500 mb-1">Manual fallback command:</div>
                    <pre className="bg-slate-900 text-green-400 p-2 rounded text-[10px] overflow-x-auto">{deployResult.manualCommand}</pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-5 gap-3 mb-8">
        {[
          { label: 'Views Deployed', value: String(VIEWS.length), sub: `${VIEWS.filter(v=>v.group==='core').length} core + ${VIEWS.filter(v=>v.group==='detection').length} detect + ${VIEWS.filter(v=>v.group==='remediation').length} ops + ${VIEWS.filter(v=>v.group==='rest-fdw').length} FDW` },
          { label: 'TMF Standards', value: '7+', sub: 'TMF632/637/638/622/656/663/666 + Custom' },
          { label: 'CS Fields Available', value: '~1,100', sub: 'Across 7 mapped source objects' },
          { label: 'TMF Fields Exposed', value: '~115', sub: 'Core views only (focused mapping)' },
          { label: 'Field Coverage', value: '~10%', sub: 'By design — TMF-relevant + data quality' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-2xl font-bold text-slate-900">{s.value}</div>
            <div className="text-xs font-medium text-slate-700">{s.label}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Runtime Status Bar */}
      <div className="mb-6 bg-white rounded-xl border border-slate-200 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Wifi className={`w-4 h-4 ${metaLoading ? 'text-slate-300 animate-pulse' : mappedEntities.size > 0 ? 'text-green-500' : 'text-red-500'}`} />
          <span className="text-sm text-slate-700 font-medium">Runtime Status</span>
          {metaLoading ? (
            <span className="text-xs text-slate-400">Checking...</span>
          ) : (
            <span className="text-xs text-slate-500">
              <span className="text-green-600 font-semibold">{mappedEntities.size}</span> registered
              {' + '}
              <span className="text-blue-600 font-semibold">{allKnownEntities.size - mappedEntities.size}</span> active
              {' / '}
              <span className="text-slate-400">{metadata?.resources.length ?? '?'} TMF entities</span>
              {' / '}
              <span className="text-purple-500">{metadata?.sources.find(s => s.name === 'salesforce_server')?.resources.length.toLocaleString() ?? '?'}</span> SF objects
            </span>
          )}
        </div>
        <button
          onClick={() => refetchMeta()}
          className="flex items-center gap-1 px-2.5 py-1 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 font-medium"
        >
          <RefreshCw className={`w-3 h-3 ${metaLoading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {(Object.keys(VIEW_GROUPS) as (keyof typeof VIEW_GROUPS)[]).map(groupKey => {
        const group = VIEW_GROUPS[groupKey];
        const views = VIEWS.filter(v => v.group === groupKey);
        const isInternal = groupKey === 'remediation' || groupKey === 'rest-fdw';

        return (
          <div key={groupKey} className="mb-8">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${groupKey === 'rest-fdw' ? 'bg-orange-500' : groupKey === 'core' ? 'bg-blue-500' : groupKey === 'detection' ? 'bg-yellow-500' : 'bg-green-500'}`} />
              {group.label}
              <span className="px-1.5 py-0.5 bg-slate-200 text-slate-600 text-[10px] rounded-full font-mono">{views.length}</span>
              <span className="text-slate-400 font-normal normal-case">- {group.description}</span>
              {isInternal && <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[10px] rounded font-medium ml-1">Internal</span>}
            </h2>

            <div className="space-y-2">
              {views.map(view => {
                const isExpanded = expandedView === view.file;
                const isDetection = view.group === 'detection';
                const isInternalView = view.group === 'remediation' || view.group === 'rest-fdw';

                return (
                  <div key={view.file} className={`rounded-xl border overflow-hidden ${isInternalView ? 'bg-slate-50 border-slate-200/70' : 'bg-white border-slate-200'}`}>
                    <button
                      onClick={() => setExpandedView(isExpanded ? null : view.file)}
                      className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-slate-50 transition-colors"
                    >
                      {isExpanded
                        ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                        : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                      }
                      <FileCode className={`w-5 h-5 shrink-0 ${isInternalView ? 'text-slate-300' : 'text-slate-400'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-900 flex items-center gap-2">
                          {view.name}
                          {!metaLoading && view.tmfEntity && (
                            mappedEntities.has(view.tmfEntity) ? (
                              <span className="flex items-center gap-1 px-1.5 py-0.5 bg-green-50 border border-green-200 rounded text-[9px] text-green-700 font-medium" title="Registered and live on runtime">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Live
                              </span>
                            ) : allKnownEntities.has(view.tmfEntity) ? (
                              <span className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 border border-blue-200 rounded text-[9px] text-blue-600 font-medium" title="View exists but was deployed after startup — API responds but metadata shows unregistered">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" /> Active
                              </span>
                            ) : view.tmfEndpoint ? (
                              <span className="flex items-center gap-1 px-1.5 py-0.5 bg-yellow-50 border border-yellow-200 rounded text-[9px] text-yellow-600 font-medium" title="Has endpoint but entity not in runtime metadata">
                                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" /> Custom
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded text-[9px] text-slate-500 font-medium" title="Detection logic — no dedicated API endpoint">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> Filter
                              </span>
                            )
                          )}
                        </div>
                        <div className="text-xs text-slate-500 font-mono">{view.file}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {view.tmfApi && (
                          <span className="px-2 py-1 bg-purple-50 text-purple-700 text-xs rounded font-medium">
                            {view.tmfApi}
                          </span>
                        )}
                        {view.direction && (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${view.direction === 'Write' ? 'bg-red-100 text-red-700' : view.direction === 'Read' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                            {view.direction}
                          </span>
                        )}
                        <span className="text-xs text-slate-400">{view.joins} JOIN{view.joins !== 1 ? 's' : ''}</span>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-slate-100 px-5 py-4 bg-slate-50/50">
                        {/* Description */}
                        <p className="text-sm text-slate-600 mb-4">{view.description}</p>

                        {/* Source -> Target summary */}
                        <div className="flex items-center gap-2 mb-4 text-xs">
                          <span className="px-2 py-1 bg-blue-50 border border-blue-200 rounded font-mono text-blue-800">{view.sourceObject}</span>
                          <ArrowRight className="w-4 h-4 text-slate-300" />
                          <span className="px-2 py-1 bg-slate-100 border border-slate-200 rounded font-mono text-slate-700">{view.file}</span>
                          <ArrowRight className="w-4 h-4 text-slate-300" />
                          <span className="px-2 py-1 bg-purple-50 border border-purple-200 rounded font-mono text-purple-800">{view.tmfEntity} ({view.tmfApi})</span>
                        </div>

                        {/* Transformation metadata */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs mb-4">
                          <div className="bg-white rounded-lg border border-slate-200 p-2.5">
                            <span className="text-slate-400 block mb-0.5">JOINs</span>
                            <span className="text-slate-700 font-medium">{view.joins === 0 ? 'None (single-table)' : `${view.joins} LEFT JOIN${view.joins > 1 ? 's' : ''}`}</span>
                          </div>
                          {view.csFieldCount && (
                            <div className="bg-white rounded-lg border border-slate-200 p-2.5">
                              <span className="text-slate-400 block mb-0.5">Field Coverage</span>
                              <span className="text-slate-700 font-medium">{view.mappedFieldCount}/{view.csFieldCount} fields ({((view.mappedFieldCount || 0) / view.csFieldCount * 100).toFixed(0)}%)</span>
                            </div>
                          )}
                          <div className="bg-white rounded-lg border border-slate-200 p-2.5">
                            <span className="text-slate-400 block mb-0.5">Fields Mapped</span>
                            <span className="text-slate-700 font-medium">{view.fields.length} TMF fields</span>
                          </div>
                          {view.tmfEndpoint && (
                            <div className="bg-white rounded-lg border border-slate-200 p-2.5">
                              <span className="text-slate-400 block mb-0.5">API Endpoint</span>
                              <span className="font-mono text-slate-700 text-[10px]">{view.tmfEndpoint}</span>
                            </div>
                          )}
                        </div>

                        {/* WHERE filter (prominent for detection views) */}
                        {view.whereFilter && (
                          <div className={`rounded-lg px-4 py-3 text-xs mb-4 ${isDetection ? 'bg-yellow-50 border-2 border-yellow-300' : 'bg-yellow-50 border border-yellow-200'}`}>
                            <span className="text-yellow-700 font-semibold">WHERE:</span>{' '}
                            <code className="text-yellow-800 font-mono">{view.whereFilter}</code>
                            {isDetection && (
                              <div className="text-yellow-600 mt-1.5 text-[11px]">
                                This is a detection view — inherits all fields from the base <code className="font-mono">service</code> view with an additional WHERE clause for scoping.
                              </div>
                            )}
                          </div>
                        )}

                        {/* Performance note */}
                        {view.performanceNote && (
                          <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-xs mb-4">
                            <Zap className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                            <span className="text-blue-800">{view.performanceNote}</span>
                          </div>
                        )}

                        {/* Internal view indicator */}
                        {isInternalView && (
                          <div className="flex items-start gap-2 bg-slate-100 border border-slate-200 rounded-lg px-4 py-3 text-xs mb-4">
                            <Database className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                            <span className="text-slate-600">
                              {view.group === 'rest-fdw'
                                ? 'REST FDW foreign table — writes map to Salesforce Apex REST API calls (INSERT -> POST, DELETE -> DELETE).'
                                : 'Internal platform table — no CloudSense source. Data managed by the TMF runtime and batch orchestrator.'}
                            </span>
                          </div>
                        )}

                        {/* SQL Query (the main content) */}
                        {view.sqlSnippet && (
                          <div className="mb-4">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                                <Code className="w-3.5 h-3.5" /> SQL View Definition
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono">{view.file}</span>
                            </div>
                            <div className="rounded-lg overflow-hidden border border-slate-700">
                              <div className="bg-slate-800 px-4 py-1.5 flex items-center gap-2 border-b border-slate-700">
                                <span className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
                                <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/80" />
                                <span className="w-2.5 h-2.5 rounded-full bg-green-400/80" />
                                <span className="text-[10px] text-slate-500 ml-2 font-mono">{view.file}</span>
                              </div>
                              <div className="bg-[#1e1e2e] p-4 overflow-x-auto">
                                <pre className="text-[11.5px] font-mono leading-[1.6] whitespace-pre">{view.sqlSnippet.split('\n').map((line, i) => {
                                  const highlighted = line
                                    .replace(/^(--.*)/g, '<c class="text-slate-500 italic">$1</c>')
                                    .replace(/\b(CREATE VIEW|SELECT|FROM|LEFT JOIN|CASE|WHEN|THEN|ELSE|END|AS|AND|OR|IN|IS NULL|IS NOT NULL|NULL|ARRAY|ROW|ARRAY_AGG|ARRAY_REMOVE|FILTER|WHERE|GROUP BY|COALESCE|DROP VIEW IF EXISTS|ON|NOT|CASE WHEN)\b/gi, (m) => `<c class="text-purple-400 font-semibold">${m}</c>`)
                                    .replace(/::(text|boolean|timestamptz|timestamp|int|integer|float|double precision|jsonb|date)/g, '<c class="text-sky-400">::$1</c>')
                                    .replace(/::tmf\."([^"]+)"/g, '<c class="text-sky-400">::tmf."$1"</c>')
                                    .replace(/'([^']*)'/g, '<c class="text-amber-300">\'$1\'</c>')
                                    .replace(/salesforce_server\."([^"]+)"/g, '<c class="text-teal-300">salesforce_server."$1"</c>');
                                  return (
                                    <div key={i} className="flex">
                                      <span className="w-8 text-right text-slate-600 select-none mr-4 shrink-0">{i + 1}</span>
                                      <span className="text-slate-300" dangerouslySetInnerHTML={{ __html: highlighted }} />
                                    </div>
                                  );
                                })}</pre>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Actions + Navigation */}
                        <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                          <div className="flex items-center gap-3">
                            {view.tmfEntity && !isInternalView && (
                              <Link href={`/data/semantic-mapping?entity=${view.tmfEntity}`} className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 font-medium">
                                <LinkIcon className="w-3 h-3" /> View Field Dictionary
                              </Link>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {view.sqlSnippet && (
                              <button
                                onClick={() => openEditor(`Edit: ${view.name}`, view.sqlSnippet!)}
                                className="flex items-center gap-1 px-2 py-1 text-[10px] text-slate-500 hover:text-slate-700 border border-slate-200 rounded hover:bg-slate-50 font-medium"
                              >
                                <Pencil className="w-3 h-3" /> Edit
                              </button>
                            )}
                            {view.sqlSnippet && (
                              <button
                                onClick={async () => {
                                  await fetch('/platform/api/runtime', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ action: 'execute-sql', sql: view.sqlSnippet, environment: 'production' }),
                                  });
                                }}
                                className="flex items-center gap-1 px-2 py-1 text-[10px] text-blue-600 hover:text-blue-800 border border-blue-200 rounded hover:bg-blue-50 font-medium"
                              >
                                <RefreshCw className="w-3 h-3" /> Redeploy
                              </button>
                            )}
                            <button
                              onClick={() => openEditor(`Drop: ${view.name}`, `DROP VIEW IF EXISTS salesforce_server."${view.tmfEntity}" CASCADE;`)}
                              className="flex items-center gap-1 px-2 py-1 text-[10px] text-red-500 hover:text-red-700 border border-red-200 rounded hover:bg-red-50 font-medium"
                            >
                              <Trash2 className="w-3 h-3" /> Drop
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
