'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, Play, Square, ChevronDown, ChevronRight, BookOpen, Shield, Database, Zap, Clock, CheckCircle, XCircle, AlertTriangle, Code, Lightbulb, FileText } from 'lucide-react';

interface SSEEvent {
  type: string;
  [key: string]: unknown;
}

export default function DiscoveryPage() {
  const [entityIds, setEntityIds] = useState('');
  const [description, setDescription] = useState('');
  const [depth, setDepth] = useState('standard');
  const [running, setRunning] = useState(false);
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const [expandedEvents, setExpandedEvents] = useState<Set<number>>(new Set());
  const eventsEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [knowledge, setKnowledge] = useState<{ tribal: unknown[]; detections: unknown[] } | null>(null);
  const [showContext, setShowContext] = useState(false);

  useEffect(() => {
    fetch('/platform/api/knowledge').then(r => r.json()).then(setKnowledge).catch(() => {});
  }, []);

  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  const startInvestigation = async () => {
    setRunning(true);
    setEvents([]);
    setExpandedEvents(new Set());
    abortRef.current = new AbortController();

    try {
      const res = await fetch('/platform/api/investigate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_ids: entityIds, description, depth }),
        signal: abortRef.current.signal,
      });

      const reader = res.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const event = JSON.parse(data) as SSEEvent;
              setEvents(prev => [...prev, event]);
            } catch { /* skip parse errors */ }
          }
        }
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        setEvents(prev => [...prev, { type: 'error', message: (e as Error).message }]);
      }
    } finally {
      setRunning(false);
    }
  };

  const stopInvestigation = () => {
    abortRef.current?.abort();
    setRunning(false);
  };

  const toggleEvent = (idx: number) => {
    setExpandedEvents(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'tool_call': return <Code className="w-4 h-4 text-blue-500" />;
      case 'tool_result': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'thinking': return <Lightbulb className="w-4 h-4 text-yellow-500" />;
      case 'iteration_start': return <Clock className="w-4 h-4 text-purple-500" />;
      case 'new_knowledge': return <BookOpen className="w-4 h-4 text-amber-500" />;
      case 'done': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'error': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <FileText className="w-4 h-4 text-slate-400" />;
    }
  };

  const getEventLabel = (event: SSEEvent) => {
    switch (event.type) {
      case 'tool_call': return `Tool Call: ${event.tool}`;
      case 'tool_result': return `Result: ${event.tool}`;
      case 'thinking': return 'Claude thinking...';
      case 'iteration_start': return `Iteration ${event.iteration}/${event.max}`;
      case 'new_knowledge': return `New ${event.knowledge_type}: ${(event.entry as Record<string, string>)?.id || (event.entry as Record<string, string>)?.name}`;
      case 'done': return 'Investigation Complete';
      case 'error': return `Error: ${event.message}`;
      case 'investigation_start': return `Starting investigation (${(event.entityIds as string[])?.length || 0} entities, max ${event.maxIterations} iterations)`;
      case 'stream_end': return `Done (${(event.findings as unknown[])?.length || 0} findings, ${(event.queryLog as unknown[])?.length || 0} queries)`;
      default: return event.type;
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Search className="w-6 h-6 text-slate-600" /> Ontology Discovery
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Investigate CloudSense issues using AI-driven analysis. Claude runs SOQL queries, analyzes data, and records findings into the ontology.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="font-semibold text-slate-900 mb-3">Start Investigation</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-slate-600 mb-1">Entity IDs (comma-separated)</label>
                <input value={entityIds} onChange={e => setEntityIds(e.target.value)} placeholder="a0uMg00000CMkA9IAL, a0uMg00000CQPv7IAH, ..." className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono" disabled={running} />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Description</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="RPA reports these baskets as stuck in Requires Update status..." className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm h-16 resize-none" disabled={running} />
              </div>
              <div className="flex items-center gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Depth</label>
                  <select value={depth} onChange={e => setDepth(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white" disabled={running}>
                    <option value="quick">Quick (10 iterations)</option>
                    <option value="standard">Standard (25 iterations)</option>
                    <option value="full">Full (50 iterations)</option>
                  </select>
                </div>
                {running ? (
                  <button onClick={stopInvestigation} className="mt-4 flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium">
                    <Square className="w-4 h-4" /> Stop
                  </button>
                ) : (
                  <button onClick={startInvestigation} disabled={!entityIds && !description} className="mt-4 flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm font-medium">
                    <Play className="w-4 h-4" /> Investigate
                  </button>
                )}
              </div>
              {false && (
                <div className="hidden" />
              )}
            </div>
          </div>

          {events.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-900 px-5 py-3 flex items-center justify-between">
                <h3 className="text-white font-semibold text-sm">Investigation Stream</h3>
                <span className="text-xs text-slate-400">{events.length} events</span>
              </div>
              <div className="max-h-[600px] overflow-y-auto">
                {events.map((event, idx) => {
                  const isExpanded = expandedEvents.has(idx);
                  const hasDetail = event.type === 'tool_call' || event.type === 'tool_result' || event.type === 'thinking' || event.type === 'new_knowledge' || event.type === 'done' || event.type === 'stream_end';
                  return (
                    <div key={idx} className={`border-b border-slate-100 ${event.type === 'error' ? 'bg-red-50' : event.type === 'done' ? 'bg-green-50' : event.type === 'new_knowledge' ? 'bg-amber-50' : ''}`}>
                      <button onClick={() => hasDetail && toggleEvent(idx)} className={`w-full flex items-center gap-2 px-4 py-2 text-left text-sm ${hasDetail ? 'hover:bg-slate-50 cursor-pointer' : 'cursor-default'}`}>
                        {hasDetail ? (isExpanded ? <ChevronDown className="w-3 h-3 text-slate-400" /> : <ChevronRight className="w-3 h-3 text-slate-400" />) : <span className="w-3" />}
                        {getEventIcon(event.type)}
                        <span className="text-slate-700 flex-1">{getEventLabel(event)}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{event.type}</span>
                      </button>
                      {isExpanded && hasDetail && (
                        <div className="px-4 pb-3 ml-9">
                          {event.type === 'tool_call' && (
                            <pre className="text-xs font-mono bg-slate-50 p-2 rounded border border-slate-200 overflow-auto max-h-40 text-slate-700">
                              {JSON.stringify(event.input, null, 2)}
                            </pre>
                          )}
                          {event.type === 'tool_result' && (
                            <pre className="text-xs font-mono bg-green-50 p-2 rounded border border-green-200 overflow-auto max-h-60 text-slate-700">
                              {JSON.stringify(event.output, null, 2)}
                            </pre>
                          )}
                          {event.type === 'thinking' && (
                            <div className="text-xs text-slate-600 whitespace-pre-wrap bg-yellow-50 p-2 rounded border border-yellow-200">
                              {String(event.text)}
                            </div>
                          )}
                          {event.type === 'new_knowledge' && (
                            <pre className="text-xs font-mono bg-amber-50 p-2 rounded border border-amber-200 overflow-auto max-h-40 text-slate-700">
                              {JSON.stringify(event.entry, null, 2)}
                            </pre>
                          )}
                          {event.type === 'done' && (
                            <div className="text-sm text-slate-700 whitespace-pre-wrap bg-green-50 p-3 rounded border border-green-200">
                              {String(event.summary)}
                            </div>
                          )}
                          {event.type === 'stream_end' && (
                            <div className="text-xs text-slate-600">
                              <strong>{(event.findings as unknown[])?.length || 0}</strong> findings recorded,{' '}
                              <strong>{(event.queryLog as unknown[])?.length || 0}</strong> SOQL queries executed
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                <div ref={eventsEndRef} />
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <button onClick={() => setShowContext(!showContext)} className="w-full flex items-center justify-between text-left">
              <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                <Database className="w-4 h-4 text-purple-600" /> Ontology Context
              </h3>
              {showContext ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
            </button>
            <p className="text-xs text-slate-400 mt-1 mb-3">Knowledge the investigator uses as context</p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-600"><BookOpen className="w-3.5 h-3.5 text-purple-600" /> Tribal Knowledge</span>
                <span className="font-mono text-slate-900 font-medium">{knowledge?.tribal?.length ?? '...'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-600"><Zap className="w-3.5 h-3.5 text-green-600" /> Detection Functions</span>
                <span className="font-mono text-slate-900 font-medium">{knowledge?.detections?.length ?? '...'}</span>
              </div>
            </div>

            {showContext && knowledge && (
              <div className="mt-3 pt-3 border-t border-slate-100 space-y-2 max-h-80 overflow-y-auto">
                <h4 className="text-xs font-semibold text-slate-400 uppercase">Tribal Knowledge</h4>
                {(knowledge.tribal as Array<{ id: string; fact: string; severity: string }>).map(tk => (
                  <div key={tk.id} className="text-[10px] bg-slate-50 rounded px-2 py-1">
                    <span className={`font-mono ${tk.severity === 'critical' ? 'text-red-600' : 'text-orange-600'}`}>{tk.id}</span>
                    <span className="text-slate-500 ml-1">{tk.fact.slice(0, 80)}...</span>
                  </div>
                ))}
                <h4 className="text-xs font-semibold text-slate-400 uppercase mt-2">Detections</h4>
                {(knowledge.detections as Array<{ name: string; description: string }>).map(d => (
                  <div key={d.name} className="text-[10px] bg-slate-50 rounded px-2 py-1">
                    <span className="font-mono text-slate-700">{d.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-900 text-sm mb-3">SOQL Console</h3>
            <SOQLConsole />
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-900 text-sm mb-2">How It Works</h3>
            <div className="space-y-1.5 text-xs text-slate-600">
              {[
                'You provide entity IDs or issue description',
                'Claude loads all ontology knowledge as context',
                'Runs SOQL queries against live Salesforce',
                'Analyzes data, traces entity graphs',
                'Records findings + new tribal knowledge',
                'New knowledge becomes permanent ontology',
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-[9px] font-bold shrink-0">{i + 1}</span>
                  {step}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SOQLConsole() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/platform/api/soql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      setResult(await res.json());
    } catch (e) {
      setResult({ error: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <textarea value={query} onChange={e => setQuery(e.target.value)} placeholder="SELECT Id, Name FROM Account LIMIT 5" className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs font-mono h-16 resize-none" />
      <button onClick={run} disabled={loading || !query.trim()} className="w-full px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-50">
        {loading ? 'Running...' : 'Execute SOQL'}
      </button>
      {result && (
        <pre className="text-[10px] font-mono bg-slate-50 p-2 rounded border border-slate-200 max-h-48 overflow-auto text-slate-700">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}
