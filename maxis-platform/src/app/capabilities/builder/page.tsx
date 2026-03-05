'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Workflow, X, ChevronRight, Play, Square, Clock, RefreshCw, Settings, Loader2, Plus, Trash2, GripVertical, ArrowDown } from 'lucide-react';

// --- Types ---

interface WfNode {
  id: string;
  label: string;
  sub: string;
  type: 'trigger' | 'query' | 'decision' | 'action' | 'ai' | 'human' | 'transform' | 'respond';
  x: number;
  y: number;
  detail?: { method?: string; endpoint?: string; description: string; safetyRules?: string[] };
}

interface WfEdge {
  from: string;
  to: string;
  label?: string;
}

interface CapabilityWorkflow {
  id: string;
  name: string;
  description: string;
  platformBlocks: string;
  nodes: WfNode[];
  edges: WfEdge[];
}

// --- Node colors by type ---

const NODE_STYLE: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  trigger:   { bg: '#ecfdf5', border: '#6ee7b7', text: '#065f46', badge: 'Trigger' },
  query:     { bg: '#eff6ff', border: '#93c5fd', text: '#1e40af', badge: 'Entity Query' },
  decision:  { bg: '#faf5ff', border: '#c4b5fd', text: '#5b21b6', badge: 'Decision' },
  action:    { bg: '#fff7ed', border: '#fdba74', text: '#9a3412', badge: 'Entity Action' },
  ai:        { bg: '#f0fdfa', border: '#5eead4', text: '#134e4a', badge: 'AI Assistant' },
  human:     { bg: '#fdf2f8', border: '#f9a8d4', text: '#9d174d', badge: 'Human in Loop' },
  transform: { bg: '#fefce8', border: '#fde047', text: '#854d0e', badge: 'Transform' },
  respond:   { bg: '#f1f5f9', border: '#94a3b8', text: '#334155', badge: 'Respond' },
};

// --- 4 Capability Workflows ---

const WORKFLOWS: CapabilityWorkflow[] = [
  {
    id: 'detection',
    name: 'Issue Detection Pipeline',
    description: 'Scans for migrated services with data quality issues and creates ServiceProblem records.',
    platformBlocks: 'Schedule Trigger + Entity Query + Decision + Entity Action + Respond',
    nodes: [
      { id: 't1', label: 'Schedule Trigger', sub: 'Every 6 hours', type: 'trigger', x: 40, y: 60, detail: { description: 'Cron-based schedule runs detection scan every 6 hours. Configurable frequency.' } },
      { id: 'q1', label: 'Entity Query', sub: 'GET /service\n?x_has1867Issue=true', type: 'query', x: 230, y: 60, detail: { method: 'GET', endpoint: '/tmf-api/serviceInventoryManagement/v5/service?x_has1867Issue=true&limit=500', description: 'Query service view for records where the computed x_has1867Issue flag is true. FDW pushes filters to SOQL.' } },
      { id: 'd1', label: 'Decision', sub: 'New issue?\n(dedup check)', type: 'decision', x: 420, y: 60, detail: { description: 'Check if a ServiceProblem already exists for this service ID. Prevents duplicate issue creation.' } },
      { id: 'a1', label: 'Entity Action', sub: 'POST /serviceProblem\n(create record)', type: 'action', x: 610, y: 30, detail: { method: 'POST', endpoint: '/tmf-api/serviceProblemManagement/v5/serviceProblem', description: 'Create a new ServiceProblem record with category, affected service reference, and initial status=pending.' } },
      { id: 's1', label: 'Skip', sub: 'Already tracked', type: 'respond', x: 610, y: 100, detail: { description: 'Issue already exists in ServiceProblem table. No action needed.' } },
      { id: 'n1', label: 'Respond', sub: 'Log to dashboard', type: 'respond', x: 800, y: 30, detail: { description: 'Update detection run log with count of new issues found. Visible in Health Trends.' } },
    ],
    edges: [
      { from: 't1', to: 'q1' },
      { from: 'q1', to: 'd1' },
      { from: 'd1', to: 'a1', label: 'yes' },
      { from: 'd1', to: 's1', label: 'no' },
      { from: 'a1', to: 'n1' },
    ],
  },
  {
    id: 'triage',
    name: 'Issue Triage + Assignment',
    description: 'Classifies new issues by severity and routes to automated remediation or manual review.',
    platformBlocks: 'Event Trigger + AI Assistant + Decision + Trigger Workflow / Human in Loop',
    nodes: [
      { id: 't2', label: 'Event Trigger', sub: 'serviceProblem\n.created', type: 'trigger', x: 40, y: 60, detail: { description: 'Fires when a new ServiceProblem record is created by the detection pipeline.' } },
      { id: 'ai2', label: 'AI Assistant', sub: 'Classify severity\nAssign category', type: 'ai', x: 230, y: 60, detail: { description: 'AI analyzes the service context (type, migration status, account size) to classify severity and assign issue category (SolutionEmpty, PartialDataMissing, MigrationFailed, BillingAccountMissing).' } },
      { id: 'd2', label: 'Decision', sub: 'Auto-remediable?', type: 'decision', x: 420, y: 60, detail: { description: 'Check if the issue category has an automated remediation workflow. SolutionEmpty and PartialDataMissing are auto-remediable. MigrationFailed and BillingAccountMissing require manual review.' } },
      { id: 'a2', label: 'Trigger Workflow', sub: 'Start Remediation', type: 'action', x: 610, y: 30, detail: { description: 'Invoke the appropriate remediation workflow (5-step Solution or 4-step OE) with the service/solution ID.' } },
      { id: 'h2', label: 'Human in Loop', sub: 'Manual review queue', type: 'human', x: 610, y: 100, detail: { description: 'Route to Issue Dashboard for manual triage. Analyst reviews and decides on remediation approach.' } },
    ],
    edges: [
      { from: 't2', to: 'ai2' },
      { from: 'ai2', to: 'd2' },
      { from: 'd2', to: 'a2', label: 'yes' },
      { from: 'd2', to: 'h2', label: 'no' },
    ],
  },
  {
    id: 'remediation',
    name: 'Solution Remediation (5-Step)',
    description: 'Full remediation flow: validate MACD safety, delete artifacts, re-migrate, poll, update flags.',
    platformBlocks: 'Webhook Trigger + 5x Entity Action (REST FDW) + Decision (MACD) + External API Call (poll)',
    nodes: [
      { id: 't3', label: 'Webhook Trigger', sub: 'POST /remediate/{id}', type: 'trigger', x: 20, y: 60, detail: { description: 'Triggered by Batch Orchestrator or manual "Remediate" button on Issue Dashboard.' } },
      { id: 'v3', label: 'VALIDATE', sub: 'GET /solutionInfo', type: 'action', x: 170, y: 60, detail: { method: 'GET', endpoint: '/solutionInfo/{solutionId}', description: 'Check MACD eligibility: basket not in Order Enrichment/Submitted, basket age >= 60 days.', safetyRules: ['Skip if basket in active journey', 'Skip if basket < 60 days old', 'Skip if MACD relationship exists'] } },
      { id: 'd3', label: 'Decision', sub: 'MACD safe?', type: 'decision', x: 320, y: 60, detail: { description: 'MACD safety gate. If the solution has active customer journeys or recent baskets, reject to avoid disrupting live orders.' } },
      { id: 'rej', label: 'Reject', sub: 'PATCH /serviceProblem\nstatus=rejected', type: 'respond', x: 320, y: 145, detail: { method: 'PATCH', endpoint: '/serviceProblem/{id}', description: 'Mark as rejected with reason. Will not retry automatically.' } },
      { id: 'del', label: 'DELETE', sub: 'DELETE\n/solutionMigration', type: 'action', x: 470, y: 60, detail: { method: 'DELETE', endpoint: '/solutionMigration/{solutionId}', description: 'Clean up existing SM artifacts in Heroku PostgreSQL before re-migration.' } },
      { id: 'mig', label: 'MIGRATE', sub: 'POST\n/solutionMigration', type: 'action', x: 620, y: 60, detail: { method: 'POST', endpoint: '/solutionMigration', description: 'Trigger re-migration. Returns async jobId for polling.' } },
      { id: 'poll', label: 'POLL', sub: 'GET /migrationStatus\n(exponential backoff)', type: 'query', x: 770, y: 60, detail: { method: 'GET', endpoint: '/migrationStatus/{jobId}', description: 'Poll every 10s (backoff to 60s). Timeout after 30 minutes.' } },
      { id: 'post', label: 'POST_UPDATE', sub: 'POST\n/solutionPostUpdate', type: 'action', x: 920, y: 60, detail: { method: 'POST', endpoint: '/solutionPostUpdate', description: 'Set isMigratedToHeroku=true, isConfigurationUpdatedToHeroku=true, clear externalIdentifier.' } },
      { id: 'done', label: 'Resolve', sub: 'PATCH /serviceProblem\nstatus=resolved', type: 'respond', x: 1070, y: 60, detail: { method: 'PATCH', endpoint: '/serviceProblem/{id}', description: 'Mark ServiceProblem as resolved. Visible in Health Trends.' } },
    ],
    edges: [
      { from: 't3', to: 'v3' },
      { from: 'v3', to: 'd3' },
      { from: 'd3', to: 'rej', label: 'no' },
      { from: 'd3', to: 'del', label: 'yes' },
      { from: 'del', to: 'mig' },
      { from: 'mig', to: 'poll' },
      { from: 'poll', to: 'post' },
      { from: 'post', to: 'done' },
    ],
  },
  {
    id: 'batch',
    name: 'Batch Scheduling',
    description: 'Scheduled batch runs that process pending issues in parallel groups of 15.',
    platformBlocks: 'Schedule Trigger + Entity Query + Transform (batch) + Trigger Workflow (fan-out) + Entity Action',
    nodes: [
      { id: 't4', label: 'Schedule Trigger', sub: 'Cron: daily 2:00 AM', type: 'trigger', x: 40, y: 60, detail: { description: 'Daily batch run at 2 AM MYT. Can also be triggered manually from Bulk Remediation page.' } },
      { id: 'q4', label: 'Entity Query', sub: 'GET /serviceProblem\n?status=pending', type: 'query', x: 230, y: 60, detail: { method: 'GET', endpoint: '/tmf-api/serviceProblemManagement/v5/serviceProblem?status=pending', description: 'Fetch all pending issues that haven\'t been attempted yet.' } },
      { id: 'tf4', label: 'Transform', sub: 'Batch into groups\nof 15 (max concurrency)', type: 'transform', x: 420, y: 60, detail: { description: 'Split pending issues into groups of 15 for parallel processing. Respects API rate limits and governor limits.' } },
      { id: 'w4', label: 'Trigger Workflow', sub: 'Remediation x15\n(parallel fan-out)', type: 'action', x: 610, y: 60, detail: { description: 'Fan-out: trigger the Solution Remediation or OE Remediation workflow for each issue in the batch, 15 in parallel.' } },
      { id: 'l4', label: 'Entity Action', sub: 'PATCH /batchJob\nstatus=completed', type: 'action', x: 800, y: 60, detail: { method: 'PATCH', endpoint: '/batchJob/{id}', description: 'Update batch job record with final status, success/failure counts, and duration.' } },
    ],
    edges: [
      { from: 't4', to: 'q4' },
      { from: 'q4', to: 'tf4' },
      { from: 'tf4', to: 'w4' },
      { from: 'w4', to: 'l4' },
    ],
  },
];

// --- Writeback Registry ---

interface WritebackEntry {
  operation: string;
  method: 'GET' | 'POST' | 'DELETE' | 'PATCH' | 'PUT';
  endpoint: string;
  sourceSystem: string;
  direction: 'Read' | 'Write';
  safetyRules: string;
  workflow: string;
}

const WRITEBACKS: WritebackEntry[] = [
  { operation: 'Validate Solution', method: 'GET', endpoint: '/solutionInfo/{id}', sourceSystem: 'Apex REST v2.0', direction: 'Read', safetyRules: '-', workflow: 'remediation' },
  { operation: 'Delete SM Artifacts', method: 'DELETE', endpoint: '/solutionMigration/{id}', sourceSystem: 'Apex REST v2.0', direction: 'Write', safetyRules: 'MACD check, 60-day basket age', workflow: 'remediation' },
  { operation: 'Trigger Migration', method: 'POST', endpoint: '/solutionMigration', sourceSystem: 'Apex REST v2.0', direction: 'Write', safetyRules: 'Clean state required', workflow: 'remediation' },
  { operation: 'Poll Migration Status', method: 'GET', endpoint: '/migrationStatus/{id}', sourceSystem: 'Apex REST v2.0', direction: 'Read', safetyRules: '30min timeout', workflow: 'remediation' },
  { operation: 'Post-Migration Update', method: 'POST', endpoint: '/solutionPostUpdate', sourceSystem: 'Apex REST v2.0', direction: 'Write', safetyRules: 'Migration must succeed first', workflow: 'remediation' },
  { operation: 'Create ServiceProblem', method: 'POST', endpoint: '/serviceProblem', sourceSystem: 'Platform Storage', direction: 'Write', safetyRules: 'Dedup check on service ID', workflow: 'detection' },
  { operation: 'Update ServiceProblem', method: 'PATCH', endpoint: '/serviceProblem/{id}', sourceSystem: 'Platform Storage', direction: 'Write', safetyRules: 'Valid state transition only', workflow: 'triage' },
  { operation: 'Create BatchJob', method: 'POST', endpoint: '/batchJob', sourceSystem: 'Platform Storage', direction: 'Write', safetyRules: 'Max concurrency: 15', workflow: 'batch' },
  { operation: 'Fetch OE Service', method: 'GET', endpoint: '/migratedServices/{id}', sourceSystem: 'Apex REST v2.0', direction: 'Read', safetyRules: 'Service must be migrated', workflow: 'remediation' },
  { operation: 'Patch OE Attachment', method: 'PUT', endpoint: '/migratedServices/{id}', sourceSystem: 'Apex REST v2.0', direction: 'Write', safetyRules: 'Backup before modify', workflow: 'remediation' },
  { operation: 'Sync OE Data', method: 'POST', endpoint: '/oeServiceRemediation/{id}', sourceSystem: 'Apex REST v2.0', direction: 'Write', safetyRules: 'Patch must succeed first', workflow: 'remediation' },
];

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-green-100 text-green-700',
  POST: 'bg-blue-100 text-blue-700',
  DELETE: 'bg-red-100 text-red-700',
  PATCH: 'bg-orange-100 text-orange-700',
  PUT: 'bg-purple-100 text-purple-700',
};

// --- Component ---

function OperationsTab() {
  const { data: schedules, isLoading: schLoading, refetch: refetchSch } = useQuery({
    queryKey: ['batchSchedules'],
    queryFn: async () => {
      const res = await fetch('/platform/api/tmf/tmf-api/batchProcessing/v1/batchSchedule?limit=20');
      return res.ok ? res.json() : [];
    },
    staleTime: 15000,
  });

  const { data: jobs, isLoading: jobsLoading } = useQuery({
    queryKey: ['batchJobs'],
    queryFn: async () => {
      const res = await fetch('/platform/api/tmf/tmf-api/batchProcessing/v1/batchJob?limit=10');
      return res.ok ? res.json() : [];
    },
    staleTime: 15000,
  });

  const USE_CASES = [
    { id: 'detection', name: 'Issue Detection', desc: 'Scan services for data quality issues and create ServiceProblem records', icon: '🔍', category: 'PartialDataMissing', triggerType: 'Schedule', defaultFreq: 'Every 6 hours' },
    { id: 'solution-remediation', name: 'Solution Remediation (1147)', desc: '5-step flow: Validate → Delete → Migrate → Poll → Post-Update', icon: '🔧', category: 'SolutionEmpty', triggerType: 'Webhook / Batch', defaultFreq: 'On-demand + Nightly 2 AM' },
    { id: 'oe-remediation', name: 'OE Remediation (1867)', desc: '4-step flow: Fetch → Analyze → Patch → Sync for migrated services', icon: '📋', category: 'PartialDataMissing', triggerType: 'Webhook / Batch', defaultFreq: 'On-demand' },
    { id: 'batch-scheduling', name: 'Batch Processing', desc: 'Scheduled batch runs processing pending issues in parallel groups', icon: '⏰', category: 'All', triggerType: 'Cron Schedule', defaultFreq: 'Daily 2:00 AM MYT' },
  ];

  const activeSchedules = Array.isArray(schedules) ? schedules.filter((s: Record<string, unknown>) => s.isActive) : [];
  const recentJobs = Array.isArray(jobs) ? jobs.slice(0, 5) : [];

  return (
    <div>
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <div className="text-2xl font-bold text-slate-900">{USE_CASES.length}</div>
          <div className="text-[10px] text-slate-500">Use Cases</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{activeSchedules.length}</div>
          <div className="text-[10px] text-slate-500">Active Schedules</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{recentJobs.length}</div>
          <div className="text-[10px] text-slate-500">Recent Jobs</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <div className="text-2xl font-bold text-purple-600">11</div>
          <div className="text-[10px] text-slate-500">Writeback Actions</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        {USE_CASES.map(uc => {
          const relatedSchedules = Array.isArray(schedules)
            ? schedules.filter((s: Record<string, unknown>) => typeof s.name === 'string' && (s.name as string).toLowerCase().includes(uc.category.toLowerCase().slice(0, 8)))
            : [];
          const relatedJobs = Array.isArray(jobs)
            ? jobs.filter((j: Record<string, unknown>) => j.category === uc.category || uc.category === 'All')
            : [];

          return (
            <div key={uc.id} className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{uc.icon}</span>
                  <div>
                    <h3 className="font-semibold text-slate-900 text-sm">{uc.name}</h3>
                    <p className="text-[10px] text-slate-500">{uc.desc}</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 bg-green-50 text-green-700 text-[9px] rounded-full font-medium border border-green-200">Active</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px] mb-3">
                <div className="bg-slate-50 rounded-lg p-2">
                  <span className="text-slate-400 block">Trigger</span>
                  <span className="text-slate-700 font-medium">{uc.triggerType}</span>
                </div>
                <div className="bg-slate-50 rounded-lg p-2">
                  <span className="text-slate-400 block">Frequency</span>
                  <span className="text-slate-700 font-medium">{uc.defaultFreq}</span>
                </div>
              </div>

              {relatedJobs.length > 0 && (
                <div className="border-t border-slate-100 pt-2 mt-2">
                  <span className="text-[9px] text-slate-400 uppercase tracking-wide">Recent Executions</span>
                  {relatedJobs.slice(0, 2).map((j: Record<string, unknown>, i: number) => (
                    <div key={i} className="flex items-center justify-between mt-1 text-[10px]">
                      <span className="text-slate-600 truncate">{String(j.name ?? '').slice(0, 30)}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-medium ${j.state === 'completed' ? 'bg-green-100 text-green-700' : j.state === 'failed' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                        {String(j.state ?? 'unknown')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Live Schedules */}
      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
        <Clock className="w-3.5 h-3.5" /> Active Schedules
        <button onClick={() => refetchSch()} className="ml-auto text-slate-400 hover:text-slate-600"><RefreshCw className="w-3 h-3" /></button>
      </h3>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-6">
        {schLoading ? (
          <div className="p-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-300" /></div>
        ) : Array.isArray(schedules) && schedules.length > 0 ? (
          <table className="w-full text-xs">
            <thead><tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-4 py-2 text-slate-500 font-medium">Schedule</th>
              <th className="text-left px-4 py-2 text-slate-500 font-medium">Active</th>
              <th className="text-left px-4 py-2 text-slate-500 font-medium">Pattern</th>
              <th className="text-left px-4 py-2 text-slate-500 font-medium">Category</th>
            </tr></thead>
            <tbody>
              {schedules.map((s: Record<string, unknown>, i: number) => (
                <tr key={i} className="border-b border-slate-50">
                  <td className="px-4 py-2.5 font-medium text-slate-900">{String(s.name ?? 'Unnamed')}</td>
                  <td className="px-4 py-2.5">
                    <span className={`w-2 h-2 rounded-full inline-block ${s.isActive ? 'bg-green-500' : 'bg-slate-300'}`} />
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{String(s.x_recurrencePattern ?? s.recurrencePattern ?? 'once')}</td>
                  <td className="px-4 py-2.5 text-slate-600">{String(s.category ?? '-')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-6 text-center text-xs text-slate-400">No schedules configured</div>
        )}
      </div>

      {/* Recent Jobs */}
      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Recent Batch Jobs</h3>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {jobsLoading ? (
          <div className="p-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-300" /></div>
        ) : recentJobs.length > 0 ? (
          <table className="w-full text-xs">
            <thead><tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-4 py-2 text-slate-500 font-medium">Job</th>
              <th className="text-left px-4 py-2 text-slate-500 font-medium">State</th>
              <th className="text-left px-4 py-2 text-slate-500 font-medium">Category</th>
              <th className="text-left px-4 py-2 text-slate-500 font-medium">Created</th>
            </tr></thead>
            <tbody>
              {recentJobs.map((j: Record<string, unknown>, i: number) => (
                <tr key={i} className="border-b border-slate-50">
                  <td className="px-4 py-2.5 font-medium text-slate-900">{String(j.name ?? 'Unnamed')}</td>
                  <td className="px-4 py-2.5">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${j.state === 'completed' ? 'bg-green-100 text-green-700' : j.state === 'failed' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                      {String(j.state ?? 'unknown')}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{String(j.category ?? '-')}</td>
                  <td className="px-4 py-2.5 text-slate-400">{String(j.creationDate ?? '-').slice(0, 16)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-6 text-center text-xs text-slate-400">No batch jobs found</div>
        )}
      </div>
    </div>
  );
}

function WorkflowBuilderTab() {
  const [nodes, setNodes] = useState<{ id: string; type: string; label: string; x: number; y: number }[]>([
    { id: 'n1', type: 'trigger', label: 'Schedule Trigger', x: 40, y: 60 },
    { id: 'n2', type: 'query', label: 'Entity Query', x: 230, y: 60 },
  ]);
  const [edges, setEdges] = useState<{ from: string; to: string }[]>([
    { from: 'n1', to: 'n2' },
  ]);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [selectedForEdge, setSelectedForEdge] = useState<string | null>(null);

  const PALETTE = [
    { type: 'trigger', label: 'Trigger', color: '#6ee7b7' },
    { type: 'query', label: 'Entity Query', color: '#93c5fd' },
    { type: 'decision', label: 'Decision', color: '#c4b5fd' },
    { type: 'action', label: 'Entity Action', color: '#fdba74' },
    { type: 'ai', label: 'AI Assistant', color: '#5eead4' },
    { type: 'human', label: 'Human in Loop', color: '#f9a8d4' },
    { type: 'transform', label: 'Transform', color: '#fde047' },
    { type: 'respond', label: 'Respond', color: '#94a3b8' },
  ];

  const addNode = (type: string, label: string) => {
    const id = `n${nodes.length + 1}_${Date.now()}`;
    const maxX = nodes.reduce((max, n) => Math.max(max, n.x), 0);
    setNodes(prev => [...prev, { id, type, label, x: maxX + 190, y: 60 }]);
    if (nodes.length > 0) {
      setEdges(prev => [...prev, { from: nodes[nodes.length - 1].id, to: id }]);
    }
  };

  const removeNode = (id: string) => {
    setNodes(prev => prev.filter(n => n.id !== id));
    setEdges(prev => prev.filter(e => e.from !== id && e.to !== id));
  };

  const handleMouseDown = (id: string, e: React.MouseEvent) => {
    const node = nodes.find(n => n.id === id);
    if (!node) return;
    setDragging(id);
    setDragOffset({ x: e.clientX - node.x, y: e.clientY - node.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    const svgRect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    setNodes(prev => prev.map(n => n.id === dragging ? { ...n, x: e.clientX - svgRect.left - dragOffset.x + svgRect.left, y: e.clientY - svgRect.top - dragOffset.y + svgRect.top } : n));
  };

  const handleMouseUp = () => setDragging(null);

  const svgWidth = Math.max(800, ...nodes.map(n => n.x + 180));

  return (
    <div>
      {/* Palette */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="text-[10px] text-slate-500 font-medium mr-2">Add Block:</span>
        {PALETTE.map(p => (
          <button
            key={p.type}
            onClick={() => addNode(p.type, p.label)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs hover:bg-slate-50 transition-colors"
          >
            <span className="w-2.5 h-2.5 rounded" style={{ backgroundColor: p.color }} />
            {p.label}
          </button>
        ))}
      </div>

      {/* Canvas */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto mb-4">
        <div className="bg-slate-50/50 border-b border-slate-100 px-5 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-green-400/80" />
            </div>
            <span className="text-[10px] text-slate-400 font-mono ml-2">workflow://new-workflow</span>
          </div>
          <span className="text-[10px] text-slate-400">{nodes.length} nodes, {edges.length} edges — drag to reposition, click palette to add</span>
        </div>
        <svg
          width={svgWidth}
          height={180}
          className="p-4 cursor-default"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <defs>
            <marker id="arr2" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
            </marker>
          </defs>
          {edges.map((edge, i) => {
            const from = nodes.find(n => n.id === edge.from);
            const to = nodes.find(n => n.id === edge.to);
            if (!from || !to) return null;
            return (
              <line key={i} x1={from.x + 140} y1={from.y + 22} x2={to.x} y2={to.y + 22} stroke="#cbd5e1" strokeWidth={2} markerEnd="url(#arr2)" />
            );
          })}
          {nodes.map(node => {
            const palette = PALETTE.find(p => p.type === node.type);
            return (
              <g key={node.id} onMouseDown={e => handleMouseDown(node.id, e)} style={{ cursor: dragging === node.id ? 'grabbing' : 'grab' }}>
                <rect x={node.x} y={node.y} width={140} height={44} rx={8} fill={palette?.color + '30'} stroke={palette?.color} strokeWidth={1.5} />
                <text x={node.x + 70} y={node.y + 18} textAnchor="middle" style={{ fontSize: '10px', fontWeight: 600, fill: '#334155' }}>{node.label}</text>
                <text x={node.x + 70} y={node.y + 32} textAnchor="middle" style={{ fontSize: '8px', fill: '#94a3b8' }}>{node.type}</text>
                <g onClick={(e) => { e.stopPropagation(); removeNode(node.id); }} style={{ cursor: 'pointer' }}>
                  <circle cx={node.x + 132} cy={node.y + 8} r={7} fill="#fee2e2" stroke="#fca5a5" strokeWidth={1} />
                  <text x={node.x + 132} y={node.y + 12} textAnchor="middle" style={{ fontSize: '10px', fill: '#dc2626' }}>×</text>
                </g>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 text-xs text-slate-500">
        <p className="font-medium text-slate-700 mb-1">Workflow Builder (Preview)</p>
        <p>Add blocks from the palette to compose a workflow. Drag nodes to reposition. Click × to remove. In a future release, each node will be configurable with endpoints, conditions, and parameters — and the workflow will be deployable as an executable automation on the BSS Magic Runtime.</p>
      </div>
    </div>
  );
}

export default function CapabilityBuilderPage() {
  const [activeTab, setActiveTab] = useState<'architecture' | 'operations' | 'builder'>('architecture');
  const [activeWorkflow, setActiveWorkflow] = useState('detection');
  const [selectedNode, setSelectedNode] = useState<WfNode | null>(null);

  const wf = WORKFLOWS.find(w => w.id === activeWorkflow)!;

  const svgWidth = activeWorkflow === 'remediation' ? 1160 : 900;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Workflow className="w-6 h-6 text-slate-600" /> Capability Studio
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Build, configure, and operate Maxis capabilities
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 rounded-lg p-1 w-fit">
        {[
          { id: 'architecture' as const, label: 'Architecture', icon: '📐' },
          { id: 'operations' as const, label: 'Operations', icon: '⚡' },
          { id: 'builder' as const, label: 'Workflow Builder', icon: '🔨' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab.id ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'operations' && <OperationsTab />}
      {activeTab === 'builder' && <WorkflowBuilderTab />}
      {activeTab === 'architecture' && (
      <div>

      {/* Workflow selector tabs */}
      <div className="flex gap-2 mb-4">
        {WORKFLOWS.map(w => (
          <button
            key={w.id}
            onClick={() => { setActiveWorkflow(w.id); setSelectedNode(null); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeWorkflow === w.id ? 'bg-purple-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            {w.name}
          </button>
        ))}
      </div>

      {/* Workflow info */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
        <h2 className="font-semibold text-slate-900 mb-1">{wf.name}</h2>
        <p className="text-sm text-slate-600 mb-3">{wf.description}</p>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="font-medium text-slate-700">Platform blocks:</span> {wf.platformBlocks}
        </div>
      </div>

      {/* SVG Workflow Canvas */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto mb-6">
        <div className="bg-slate-50/50 border-b border-slate-100 px-5 py-2 flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-green-400/80" />
          </div>
          <span className="text-[10px] text-slate-400 font-mono ml-2">workflow://{wf.id}</span>
        </div>
        <svg width={svgWidth} height={wf.nodes.some(n => n.y > 100) ? 200 : 150} className="p-4">
          {/* Edges */}
          {wf.edges.map((edge, i) => {
            const from = wf.nodes.find(n => n.id === edge.from)!;
            const to = wf.nodes.find(n => n.id === edge.to)!;
            const fx = from.x + 70;
            const fy = from.y + 20;
            const tx = to.x;
            const ty = to.y + 20;
            const mx = (fx + tx) / 2;
            return (
              <g key={i}>
                <path
                  d={`M${fx},${fy} C${mx},${fy} ${mx},${ty} ${tx},${ty}`}
                  fill="none"
                  stroke="#cbd5e1"
                  strokeWidth={2}
                  markerEnd="url(#arrowhead)"
                />
                {edge.label && (
                  <text x={mx} y={Math.min(fy, ty) - 5} textAnchor="middle" className="text-[9px] fill-slate-400 font-medium">
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}
          {/* Arrowhead marker */}
          <defs>
            <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
            </marker>
          </defs>
          {/* Nodes */}
          {wf.nodes.map(node => {
            const style = NODE_STYLE[node.type];
            const isSelected = selectedNode?.id === node.id;
            return (
              <g
                key={node.id}
                onClick={() => setSelectedNode(isSelected ? null : node)}
                style={{ cursor: 'pointer' }}
              >
                <rect
                  x={node.x}
                  y={node.y}
                  width={140}
                  height={42}
                  rx={8}
                  fill={style.bg}
                  stroke={isSelected ? '#7c3aed' : style.border}
                  strokeWidth={isSelected ? 2.5 : 1.5}
                />
                <text x={node.x + 70} y={node.y + 16} textAnchor="middle" style={{ fontSize: '10px', fontWeight: 600, fill: style.text }}>
                  {node.label}
                </text>
                <text x={node.x + 70} y={node.y + 30} textAnchor="middle" style={{ fontSize: '8px', fill: style.text, opacity: 0.7 }}>
                  {node.sub.split('\n')[0]}
                </text>
                {/* Type badge */}
                <rect x={node.x} y={node.y - 10} width={style.badge.length * 5.5 + 8} height={12} rx={3} fill={style.border} opacity={0.3} />
                <text x={node.x + 4} y={node.y - 2} style={{ fontSize: '7px', fontWeight: 600, fill: style.text }}>
                  {style.badge}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Node detail panel */}
      {selectedNode && selectedNode.detail && (
        <div className="bg-white rounded-xl border border-purple-200 p-5 mb-6 relative">
          <button onClick={() => setSelectedNode(null)} className="absolute top-3 right-3 text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 mb-3">
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase`} style={{ backgroundColor: NODE_STYLE[selectedNode.type].border + '40', color: NODE_STYLE[selectedNode.type].text }}>
              {NODE_STYLE[selectedNode.type].badge}
            </span>
            <h3 className="font-semibold text-slate-900">{selectedNode.label}</h3>
          </div>
          {selectedNode.detail.method && selectedNode.detail.endpoint && (
            <div className="flex items-center gap-2 mb-3">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${METHOD_COLORS[selectedNode.detail.method]}`}>
                {selectedNode.detail.method}
              </span>
              <code className="text-xs font-mono text-slate-700">{selectedNode.detail.endpoint}</code>
            </div>
          )}
          <p className="text-sm text-slate-600 mb-3">{selectedNode.detail.description}</p>
          {selectedNode.detail.safetyRules && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="text-[10px] font-semibold text-yellow-700 uppercase mb-1">Safety Rules</div>
              <ul className="text-xs text-yellow-800 space-y-1">
                {selectedNode.detail.safetyRules.map((r, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <ChevronRight className="w-3 h-3 text-yellow-500 shrink-0 mt-0.5" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Writeback Registry */}
      <div className="mt-8">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Writeback Registry</h2>
        <p className="text-sm text-slate-600 mb-4">All configured write operations across the 4 capability workflows. Each operation is governed by safety rules and routed through the TMF Runtime REST FDW.</p>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-5 py-3 text-slate-500 font-medium text-xs">Operation</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium text-xs">Method</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium text-xs">Endpoint</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium text-xs">Source System</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium text-xs">Direction</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium text-xs">Safety Rules</th>
              </tr>
            </thead>
            <tbody>
              {WRITEBACKS.map((wb, i) => (
                <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-5 py-3 font-medium text-slate-900 text-xs">{wb.operation}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${METHOD_COLORS[wb.method]}`}>{wb.method}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{wb.endpoint}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">{wb.sourceSystem}</td>
                  <td className="px-4 py-3">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${wb.direction === 'Write' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>{wb.direction}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{wb.safetyRules}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </div>
      )}
    </div>
  );
}
