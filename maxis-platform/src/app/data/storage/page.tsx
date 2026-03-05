'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchMetadata } from '@/lib/api';
import { HardDrive, X, ExternalLink, Database, Globe, Shield, Server } from 'lucide-react';
import { VIEWS } from '@/lib/views-data';
import { useState } from 'react';
import Link from 'next/link';

interface ConnectorConfig {
  id: string;
  name: string;
  systemId: string;
  type: string;
  typeBadge: string;
  typeBadgeColor: string;
  iconLabel: string;
  iconBg: string;
  iconColor: string;
  description: string;
  connectionCount: string | number;
  status: 'connected' | 'disconnected';
  config: { label: string; value: string }[];
  exploreLink?: string;
}

const CONNECTORS: ConnectorConfig[] = [
  {
    id: 'cloudsense',
    name: 'Maxis CloudSense Sandbox',
    systemId: 'maxis-sandbox',
    type: 'CLOUDSENSE',
    typeBadge: 'CLOUDSENSE',
    typeBadgeColor: 'bg-purple-100 text-purple-700',
    iconLabel: 'CS',
    iconBg: 'bg-purple-100',
    iconColor: 'text-purple-600',
    description: 'Primary data source — Salesforce org with CloudSense managed packages for BSS operations',
    connectionCount: 'core',
    status: 'connected',
    config: [
      { label: 'Host', value: 'login.salesforce.com' },
      { label: 'Protocol', value: 'SOAP + REST API' },
      { label: 'Authentication', value: 'X.509 Certificate (mTLS)' },
      { label: 'FDW Type', value: 'Salesforce FDW (Multicorn/Python)' },
      { label: 'Schema', value: 'salesforce_server' },
      { label: 'Discovery', value: 'Auto-import via IMPORT FOREIGN SCHEMA' },
    ],
    exploreLink: '/data/explore',
  },
  {
    id: 'postgresql',
    name: 'Platform Storage',
    systemId: 'bssmagic-runtime-db',
    type: 'POSTGRESQL',
    typeBadge: 'POSTGRESQL',
    typeBadgeColor: 'bg-blue-100 text-blue-700',
    iconLabel: 'PG',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    description: 'Internal PostgreSQL tables for issue tracking, batch jobs, and remediation state',
    connectionCount: 'remediation',
    status: 'connected',
    config: [
      { label: 'Host', value: 'localhost:5432' },
      { label: 'Database', value: 'bssmagic_runtime' },
      { label: 'Schema', value: 'tmf (internal tables)' },
      { label: 'Authentication', value: 'Local (same container)' },
      { label: 'Tables', value: 'serviceProblem, batchJob, batchSchedule' },
      { label: 'Storage', value: 'ECS Fargate ephemeral (20 GB)' },
    ],
  },
  {
    id: 'rest-fdw',
    name: 'Salesforce Apex REST API v2.0',
    systemId: 'rest_server',
    type: 'REST_FDW',
    typeBadge: 'REST FDW',
    typeBadgeColor: 'bg-orange-100 text-orange-700',
    iconLabel: 'FDW',
    iconBg: 'bg-orange-100',
    iconColor: 'text-orange-600',
    description: 'Write-path connector for solution remediation and OE patching via Apex REST endpoints',
    connectionCount: 'rest-fdw',
    status: 'connected',
    config: [
      { label: 'Base URL', value: 'https://maboroshi2-dev-ed.my.salesforce.com/services/apexrest/csap/v2.0/' },
      { label: 'Authentication', value: 'OAuth 2.0 (JWT Bearer)' },
      { label: 'FDW Type', value: 'REST FDW (Multicorn/Python)' },
      { label: 'Schema', value: 'rest_server' },
      { label: 'Endpoints', value: 'solutionInfo, solutionMigration, migrationStatus, solutionPostUpdate' },
      { label: 'Direction', value: 'Write (INSERT/DELETE mapped to POST/DELETE)' },
    ],
  },
];

export default function StoragePage() {
  const [selectedConnector, setSelectedConnector] = useState<string | null>(null);

  const { data: metadata, isLoading } = useQuery({
    queryKey: ['metadata'],
    queryFn: fetchMetadata,
  });

  const sfObjects = metadata?.sources.find(s => s.name === 'salesforce_server')?.resources.length ?? 0;

  const getConnectionCount = (c: ConnectorConfig) => {
    if (c.connectionCount === 'core') return `${VIEWS.filter(v => v.group === 'core').length} views`;
    if (c.connectionCount === 'remediation') return `${VIEWS.filter(v => v.group === 'remediation').length} views`;
    if (c.connectionCount === 'rest-fdw') return `${VIEWS.filter(v => v.group === 'rest-fdw').length} foreign tables`;
    return String(c.connectionCount);
  };

  const selected = CONNECTORS.find(c => c.id === selectedConnector);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <HardDrive className="w-6 h-6 text-slate-600" /> Connectors
          </h1>
          <p className="text-slate-500 text-sm mt-1">Data source connectors for the Maxis runtime</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left px-6 py-3 text-slate-500 font-medium">Name</th>
              <th className="text-left px-6 py-3 text-slate-500 font-medium">Type</th>
              <th className="text-left px-6 py-3 text-slate-500 font-medium">Description</th>
              <th className="text-left px-6 py-3 text-slate-500 font-medium">Connections</th>
              <th className="text-left px-6 py-3 text-slate-500 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {CONNECTORS.map(c => (
              <tr
                key={c.id}
                className={`border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors ${selectedConnector === c.id ? 'bg-blue-50/50' : ''}`}
                onClick={() => setSelectedConnector(selectedConnector === c.id ? null : c.id)}
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg ${c.iconBg} flex items-center justify-center`}>
                      <span className={`${c.iconColor} text-xs font-bold`}>{c.iconLabel}</span>
                    </div>
                    <div>
                      <div className="font-medium text-slate-900">{c.name}</div>
                      <div className="text-xs text-slate-500 font-mono">{c.systemId}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 ${c.typeBadgeColor} text-xs rounded font-medium`}>{c.typeBadge}</span>
                </td>
                <td className="px-6 py-4 text-slate-600">
                  {c.id === 'cloudsense' && !isLoading ? `${sfObjects.toLocaleString()} SF objects available` : c.description}
                </td>
                <td className="px-6 py-4 text-slate-700 font-medium">{getConnectionCount(c)}</td>
                <td className="px-6 py-4">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-green-700 text-xs font-medium">Connected</span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Slide-over detail panel */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setSelectedConnector(null)}>
          <div className="absolute inset-0 bg-black/20" />
          <div
            className="relative w-full max-w-lg bg-white shadow-2xl border-l border-slate-200 overflow-y-auto animate-in slide-in-from-right"
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg ${selected.iconBg} flex items-center justify-center`}>
                  <span className={`${selected.iconColor} text-sm font-bold`}>{selected.iconLabel}</span>
                </div>
                <div>
                  <h2 className="font-semibold text-slate-900">{selected.name}</h2>
                  <span className={`px-2 py-0.5 ${selected.typeBadgeColor} text-[10px] rounded font-medium`}>{selected.typeBadge}</span>
                </div>
              </div>
              <button onClick={() => setSelectedConnector(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-6">
              {/* Status */}
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 rounded-full text-xs text-green-700 font-medium">
                  <span className="w-2 h-2 rounded-full bg-green-500" /> Connected
                </span>
                <span className="text-xs text-slate-400 font-mono">{selected.systemId}</span>
              </div>

              {/* Description */}
              <p className="text-sm text-slate-600">{selected.description}</p>

              {/* Configuration */}
              <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5" /> Configuration
                </h3>
                <div className="bg-slate-50 rounded-lg border border-slate-200 divide-y divide-slate-200">
                  {selected.config.map(item => (
                    <div key={item.label} className="flex items-start px-4 py-3 gap-4">
                      <span className="text-xs text-slate-500 font-medium w-28 shrink-0 pt-0.5">{item.label}</span>
                      <span className="text-xs text-slate-800 font-mono break-all">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick stats */}
              <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5" /> Usage
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 rounded-lg border border-slate-200 p-3">
                    <div className="text-lg font-bold text-slate-900">{getConnectionCount(selected)}</div>
                    <div className="text-[10px] text-slate-500">Active connections</div>
                  </div>
                  {selected.id === 'cloudsense' && (
                    <div className="bg-slate-50 rounded-lg border border-slate-200 p-3">
                      <div className="text-lg font-bold text-slate-900">{isLoading ? '...' : sfObjects.toLocaleString()}</div>
                      <div className="text-[10px] text-slate-500">SF objects discovered</div>
                    </div>
                  )}
                  {selected.id === 'rest-fdw' && (
                    <div className="bg-slate-50 rounded-lg border border-slate-200 p-3">
                      <div className="text-lg font-bold text-slate-900">4</div>
                      <div className="text-[10px] text-slate-500">Apex REST endpoints</div>
                    </div>
                  )}
                  {selected.id === 'postgresql' && (
                    <div className="bg-slate-50 rounded-lg border border-slate-200 p-3">
                      <div className="text-lg font-bold text-slate-900">3</div>
                      <div className="text-[10px] text-slate-500">Internal tables</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Explore link */}
              {selected.exploreLink && (
                <Link
                  href={selected.exploreLink}
                  className="flex items-center gap-2 px-4 py-3 bg-purple-50 border border-purple-200 rounded-lg text-sm text-purple-700 font-medium hover:bg-purple-100 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" /> Explore Storage Data
                </Link>
              )}

              {/* REST FDW Foreign Tables */}
              {selected.id === 'rest-fdw' && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5" /> Foreign Tables (Endpoints)
                  </h3>
                  <div className="space-y-2">
                    {[
                      { name: 'solutionInfo', method: 'GET', path: '/solutions/{id}', desc: 'Read solution details + MACD state' },
                      { name: 'migrationStatus', method: 'GET', path: '/solutions/{id}/migrations/status', desc: 'Poll migration progress' },
                      { name: 'solutionMigration', method: 'POST/DELETE', path: '/solutions/{id}/migrations', desc: 'Trigger or clean migration' },
                      { name: 'solutionPostUpdate', method: 'PATCH', path: '/solutions/{id}', desc: 'Post-migration flag updates' },
                      { name: 'oeServiceInfo', method: 'GET', path: '/migrated-services/{id}', desc: 'Fetch OE attachment data' },
                      { name: 'oeServiceAttachment', method: 'PUT', path: '/migrated-services/{id}/attachment', desc: 'Patch OE attachment' },
                      { name: 'oeServiceRemediation', method: 'POST', path: '/migrated-services/{id}/remediations', desc: 'Trigger SM sync' },
                    ].map(ft => (
                      <div key={ft.name} className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-slate-900">{ft.name}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${ft.method.includes('GET') ? 'bg-green-100 text-green-700' : ft.method.includes('DELETE') ? 'bg-red-100 text-red-700' : ft.method.includes('PUT') ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>{ft.method}</span>
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 mb-1">{ft.path}</div>
                        <div className="text-[10px] text-slate-400">{ft.desc}</div>
                      </div>
                    ))}
                  </div>
                  <Link
                    href="/data/pipelines"
                    className="flex items-center gap-2 mt-3 px-4 py-2.5 bg-orange-50 border border-orange-200 rounded-lg text-xs text-orange-700 font-medium hover:bg-orange-100 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Add New Endpoint via Pipeline Editor
                  </Link>
                </div>
              )}

              {/* PostgreSQL Internal Tables */}
              {selected.id === 'postgresql' && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5" /> Internal Tables
                  </h3>
                  <div className="space-y-2">
                    {[
                      { name: 'tmf."serviceProblem"', ops: 'POST / PATCH / DELETE', desc: 'Issue tracking with TMF656 lifecycle' },
                      { name: 'tmf."batchJob"', ops: 'POST / PATCH / DELETE', desc: 'Batch execution records' },
                      { name: 'tmf."batchSchedule"', ops: 'POST / PATCH / DELETE', desc: 'Recurring schedule definitions' },
                    ].map(t => (
                      <div key={t.name} className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-mono font-medium text-slate-900">{t.name}</span>
                          <span className="text-[9px] text-blue-600 font-medium">{t.ops}</span>
                        </div>
                        <div className="text-[10px] text-slate-400">{t.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
