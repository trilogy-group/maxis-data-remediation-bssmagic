'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchMetadata, healthCheck } from '@/lib/api';
import { DETECTION_FUNCTIONS } from '@/lib/tribal-knowledge-data';
import { CheckCircle, XCircle, Clock, RefreshCw, AlertTriangle, Zap, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

interface HealthResult {
  name: string;
  basePath: string;
  ok: boolean;
  ms: number;
  error?: string;
}

export default function DataQualityPage() {
  const [results, setResults] = useState<HealthResult[]>([]);
  const [running, setRunning] = useState(false);
  const [expandedDet, setExpandedDet] = useState<string | null>(null);

  const { data: metadata } = useQuery({ queryKey: ['metadata'], queryFn: fetchMetadata });

  const runHealthChecks = async () => {
    if (!metadata) return;
    setRunning(true);
    setResults([]);
    const mapped = metadata.resources.filter(r => r.mapped && r.basePath);
    const newResults: HealthResult[] = [];
    for (const resource of mapped) {
      const result = await healthCheck(resource.basePath!);
      const entry = { name: resource.name, basePath: resource.basePath!, ...result };
      newResults.push(entry);
      setResults([...newResults]);
    }
    setRunning(false);
  };

  const healthy = results.filter(r => r.ok).length;
  const unhealthy = results.filter(r => !r.ok).length;
  const avgMs = results.length > 0 ? Math.round(results.reduce((sum, r) => sum + r.ms, 0) / results.length) : 0;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <CheckCircle className="w-6 h-6 text-slate-600" /> Data Quality
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Live health checks against all mapped TMF API endpoints
          </p>
        </div>
        <button
          onClick={runHealthChecks}
          disabled={running || !metadata}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm font-medium"
        >
          <RefreshCw className={`w-4 h-4 ${running ? 'animate-spin' : ''}`} />
          {running ? 'Running...' : 'Run Health Checks'}
        </button>
      </div>

      {results.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-2xl font-bold text-green-600">{healthy}</div>
            <div className="text-sm text-slate-500">Healthy endpoints</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-2xl font-bold text-red-600">{unhealthy}</div>
            <div className="text-sm text-slate-500">Failed endpoints</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-2xl font-bold text-slate-700">{avgMs}ms</div>
            <div className="text-sm text-slate-500">Avg response time</div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-6 py-3 text-slate-500 font-medium">Status</th>
              <th className="text-left px-6 py-3 text-slate-500 font-medium">Entity</th>
              <th className="text-left px-6 py-3 text-slate-500 font-medium">Endpoint</th>
              <th className="text-left px-6 py-3 text-slate-500 font-medium">Response Time</th>
              <th className="text-left px-6 py-3 text-slate-500 font-medium">Details</th>
            </tr>
          </thead>
          <tbody>
            {results.length === 0 && !running ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                  <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  Click &quot;Run Health Checks&quot; to test all endpoints
                </td>
              </tr>
            ) : (
              results.map(r => (
                <tr key={r.name} className="border-b border-slate-50">
                  <td className="px-6 py-3">
                    {r.ok
                      ? <CheckCircle className="w-5 h-5 text-green-500" />
                      : <XCircle className="w-5 h-5 text-red-500" />
                    }
                  </td>
                  <td className="px-6 py-3 font-medium text-slate-900">{r.name}</td>
                  <td className="px-6 py-3 font-mono text-xs text-slate-600">{r.basePath}</td>
                  <td className="px-6 py-3">
                    <span className={`font-mono text-xs ${r.ms < 1000 ? 'text-green-600' : r.ms < 3000 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {r.ms}ms
                    </span>
                  </td>
                  <td className="px-6 py-3 text-xs text-slate-500">{r.error || 'OK'}</td>
                </tr>
              ))
            )}
            {running && (
              <tr>
                <td colSpan={5} className="px-6 py-3 text-center text-slate-400">
                  <Clock className="w-4 h-4 inline animate-spin mr-2" />
                  Checking remaining endpoints...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
          <Zap className="w-5 h-5 text-orange-500" /> Discovery-Based Detection Functions
        </h2>
        <p className="text-sm text-slate-500 mb-4">
          {DETECTION_FUNCTIONS.length} detection rules discovered through ontology investigations. These are SOQL-based checks that can run against live production data.
        </p>

        <div className="space-y-2">
          {DETECTION_FUNCTIONS.map(det => {
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
                      <h4 className="text-xs font-semibold text-slate-500 uppercase mb-1">Resolution</h4>
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
