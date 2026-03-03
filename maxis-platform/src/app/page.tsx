'use client';

import Link from 'next/link';
import { Database, Share2, Zap, ArrowRight, AlertTriangle, Server, Package, Users, ShoppingCart, FileText, Layers } from 'lucide-react';
import { MAXIS_CONTRACT, MAXIS_OBJECTS, USE_CASES, RUNTIME_STATS } from '@/lib/maxis-data';

const sections = [
  {
    icon: Database,
    title: 'Data Layer',
    description: 'Storage connections, SQL view pipelines, semantic mappings, and live data exploration',
    href: '/data/storage',
    stats: ['3 data sources', `${RUNTIME_STATS.sqlViews} SQL views`, `${RUNTIME_STATS.mappedEntities} core entities`],
    color: 'from-blue-500 to-cyan-500',
  },
  {
    icon: Share2,
    title: 'Ontology Layer',
    description: 'TMF entity definitions, detection rules, knowledge graph, and governance',
    href: '/ontology/entities',
    stats: [`${RUNTIME_STATS.tmfEntities}+ TMF entities`, '4 detection rules', '12 CS objects mapped'],
    color: 'from-purple-500 to-pink-500',
  },
  {
    icon: Zap,
    title: 'Capabilities Studio',
    description: 'Operational apps: issue resolution, remediation workflows, ontology discovery, and health trends',
    href: '/capabilities/issues',
    stats: ['4 issue categories', '2 workflows', 'Discovery agent'],
    color: 'from-orange-500 to-red-500',
  },
];

export default function Home() {
  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold text-slate-900">Maxis BSS Magic Platform</h1>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm text-green-700 font-medium">Live</span>
          </div>
        </div>
        <p className="text-slate-600 mb-8">
          Operational intelligence for CloudSense issue detection and remediation.
          Connected to the live Maxis runtime in AWS Singapore.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {sections.map(s => (
            <Link key={s.href} href={s.href} className="group block">
              <div className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-lg hover:border-slate-300 transition-all h-full">
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${s.color} flex items-center justify-center mb-4`}>
                  <s.icon className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-lg font-semibold text-slate-900 mb-2 flex items-center gap-2">
                  {s.title}
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
                </h2>
                <p className="text-sm text-slate-600 mb-4">{s.description}</p>
                <div className="flex flex-wrap gap-2">
                  {s.stats.map(stat => (
                    <span key={stat} className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded-md">{stat}</span>
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Active Use Cases
            </h3>
            <div className="space-y-3">
              {USE_CASES.map(uc => (
                <div key={uc.id} className={`border-l-3 border-${uc.color}-500 pl-4 py-2`} style={{ borderLeftWidth: 3, borderLeftColor: uc.color === 'red' ? '#ef4444' : uc.color === 'orange' ? '#f97316' : uc.color === 'yellow' ? '#eab308' : '#3b82f6' }}>
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-slate-900 text-sm">{uc.name} ({uc.id})</h4>
                    <span className="text-xs text-slate-500">{uc.estimatedIssues}</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">{uc.description}</p>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-400">
                    <span>Impact: <strong className="text-slate-600">{uc.impact}</strong></span>
                    <span>Flow: <strong className="text-slate-600">{uc.remediationFlow.split(':')[0]}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4 flex items-center gap-2">
              <Layers className="w-4 h-4" /> CloudSense Object Landscape
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-2 text-slate-400 font-medium">Object</th>
                    <th className="text-left py-2 text-slate-400 font-medium">Records</th>
                    <th className="text-left py-2 text-slate-400 font-medium">Fields</th>
                    <th className="text-left py-2 text-slate-400 font-medium">TMF Mapping</th>
                  </tr>
                </thead>
                <tbody>
                  {MAXIS_OBJECTS.map(obj => (
                    <tr key={obj.apiName} className="border-b border-slate-50">
                      <td className="py-1.5">
                        <span className="font-medium text-slate-800">{obj.name}</span>
                        <br /><span className="text-slate-400 font-mono text-[10px]">{obj.apiName}</span>
                      </td>
                      <td className="py-1.5 font-mono text-slate-600">{obj.records}</td>
                      <td className="py-1.5 text-slate-500">{obj.fields}</td>
                      <td className="py-1.5">
                        <span className={`text-[10px] ${obj.tmf.startsWith('TMF') ? 'text-purple-600' : 'text-slate-400'}`}>
                          {obj.tmf}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Runtime Connection</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            <div>
              <div className="text-slate-500 text-xs">ALB Endpoint</div>
              <div className="font-mono text-[10px] text-slate-700 break-all">bssmagic-alb-*.elb.amazonaws.com</div>
            </div>
            <div>
              <div className="text-slate-500 text-xs">Region</div>
              <div className="text-slate-700">{RUNTIME_STATS.region}</div>
            </div>
            <div>
              <div className="text-slate-500 text-xs">ECS Cluster</div>
              <div className="text-slate-700">{RUNTIME_STATS.cluster}</div>
            </div>
            <div>
              <div className="text-slate-500 text-xs">Contract</div>
              <div className="text-slate-700">{MAXIS_CONTRACT.value} · {MAXIS_CONTRACT.scope}</div>
            </div>
            <div>
              <div className="text-slate-500 text-xs">Manual Effort Saved</div>
              <div className="text-slate-700 font-medium">{MAXIS_CONTRACT.manualEffortSaved}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
