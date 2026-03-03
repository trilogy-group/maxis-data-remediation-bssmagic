'use client';

import { Lock, Shield, Eye, Cog, ArrowDown } from 'lucide-react';

const LEVELS = [
  {
    level: '1a',
    title: 'Policy',
    icon: Shield,
    color: 'bg-red-500',
    description: 'Maxis data integrity standards and SLA requirements',
    items: [
      'All CloudSense data must be TMF-compliant before operational use',
      'Solution Empty (1147) issues must be resolved within 24 hours',
      'OE data completeness must exceed 95% across all service types',
      'Write operations require audit trail via ServiceProblem (TMF656)',
    ],
  },
  {
    level: '1b',
    title: 'Principles & Culture',
    icon: Eye,
    color: 'bg-orange-500',
    description: 'Operational guidelines for the remediation team',
    items: [
      'Automated remediation preferred over manual intervention',
      'MACD safety: skip solutions in "Order Enrichment" or "Submitted" stage',
      'Basket age rule: only remediate baskets older than 60 days',
      'REST FDW for all production writes (no direct Salesforce DML)',
    ],
  },
  {
    level: '2',
    title: 'Operational Governance',
    icon: Cog,
    color: 'bg-blue-500',
    description: 'Runtime controls and monitoring',
    items: [
      'Batch Orchestrator enforces state machine transitions (VALIDATE -> DELETE -> MIGRATE -> POLL -> POST_UPDATE)',
      'Concurrency limited to 15 parallel remediations',
      'ServiceProblem lifecycle: pending -> inProgress -> resolved/rejected',
      'CloudWatch logs monitored for 500 errors and FDW timeouts',
      'SQL views redeployed after every ECS restart via apply_all_views.sh',
    ],
  },
  {
    level: '3',
    title: 'Execution Controls',
    icon: Lock,
    color: 'bg-purple-500',
    description: 'Technical safeguards and validation',
    items: [
      'API Key authentication on all ALB requests',
      'FDW pushdown optimization: direct column references only (no COALESCE in WHERE)',
      'Never JOIN to tables >100K records (FDW performs full scan)',
      'Sandbox testing required before production deployment',
      'ECR tag: custom-v1 (not latest) for production images',
    ],
  },
];

export default function GovernancePage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Lock className="w-6 h-6 text-slate-600" /> Governance Stack
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Multi-level governance framework for Maxis BSS Magic operations
        </p>
      </div>

      <div className="max-w-3xl mx-auto space-y-4">
        {LEVELS.map((level, i) => (
          <div key={level.level}>
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className={`${level.color} px-6 py-3 flex items-center gap-3`}>
                <level.icon className="w-5 h-5 text-white" />
                <div>
                  <div className="text-white font-semibold text-sm">Level {level.level}: {level.title}</div>
                  <div className="text-white/70 text-xs">{level.description}</div>
                </div>
              </div>
              <div className="px-6 py-4">
                <ul className="space-y-2">
                  {level.items.map((item, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-slate-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            {i < LEVELS.length - 1 && (
              <div className="flex justify-center py-2">
                <ArrowDown className="w-5 h-5 text-slate-300" />
              </div>
            )}
          </div>
        ))}

        <div className="text-center text-xs text-slate-400 pt-4 mb-12">
          Feedback from operational execution flows back to inform policy, principles, and evaluation.
        </div>
      </div>

      <div className="max-w-3xl mx-auto mt-8">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Key Architectural Decisions</h2>
        <p className="text-sm text-slate-500 mb-6">Design choices that shape the Maxis BSS Magic implementation and their rationale.</p>
        <div className="space-y-3">
          {[
            { id: 1, title: 'Solution mapped as Product (not Agreement)', rationale: 'While csord__Solution__c conceptually fits TMF651 Agreement (85%), it is exposed as TMF637 Product — the Product entity has richer pricing, characteristic, and relationship structures needed for the dashboard and remediation workflows.' },
            { id: 2, title: 'Zero-JOIN Service view', rationale: 'The Service view (most queried, 321K records) uses zero JOINs for maximum FDW performance. All enrichment is via direct fields on csord__Service__c or deferred to client-side resolution.' },
            { id: 3, title: 'Custom x_* fields for detection', rationale: 'Rather than complex SQL logic, detection flags (x_has1867Issue, x_migratedData, x_serviceType) are exposed as filterable custom fields, enabling efficient SOQL-pushdown queries like ?x_has1867Issue=true&limit=100.' },
            { id: 4, title: 'Attribute table excluded from JOINs', rationale: 'cscfga__Attribute__c (7.5M records) is deliberately not JOINed — FDW would perform a full table scan. Characteristics are sourced from direct fields on the parent object instead.' },
            { id: 5, title: 'Status2__c over Status__c for Orders', rationale: 'Maxis uses csord__Status2__c as the authoritative order status. The legacy csord__Status__c field never transitions and would show all orders as "stuck."' },
            { id: 6, title: 'Actions modeled as TMF entities', rationale: 'REST FDW write operations (DELETE solution, POST migration, PUT attachment) are exposed as TMF-like entities with standard CRUD semantics — not ad-hoc custom endpoints. This makes the system an operational ontology (read AND write), not a read-only data lake.' },
            { id: 7, title: 'Rule-based, not AI-orchestrated (current phase)', rationale: 'All detection and remediation processes are deterministic. The state machines, MACD safety rules, and SET_IF_EMPTY patching are explicit code — not AI-driven. The ontology supports future AI orchestration, but the current phase prioritizes predictability and auditability.' },
          ].map(d => (
            <div key={d.id} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold shrink-0">{d.id}</div>
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm">{d.title}</h3>
                  <p className="text-xs text-slate-600 mt-1">{d.rationale}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
