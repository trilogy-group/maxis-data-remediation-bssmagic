// Module: 1867 OE Data Patcher (Redesigned - 1147 Pattern)
// Two-table layout: Detection Table (top) + Service Problem Tracking Table (bottom)

import { useState, useMemo, useCallback, useRef } from 'react';
import {
  Wrench,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Search,
  Loader2,
  Zap,
  Play,
  RotateCcw,
  Settings,
  Clock,
  TrendingUp,
  X,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { downloadCSV } from '../../lib/csv-export';
import { useServices } from '../../services/tmf/hooks';
import {
  useOERemediateSingle,
  useOEServiceProblems,
} from '../../services/gateways/hooks';
import {
  batchCheckOEServices,
  fetchCheckProgress,
} from '../../services/salesforce/client';
import type { Service } from '../../types/tmf-api';
import type { OEServiceProblem } from '../../services/salesforce/client';
import { OERulesEditor } from './OERulesEditor';
import { BatchScheduler } from './BatchScheduler';
import { OEAnalyticsPanel } from './OEAnalyticsPanel';

type ScenarioType = 'voice' | 'fibre' | 'esms' | 'access';

interface Scenario {
  id: ScenarioType;
  name: string;
  description: string;
  color: string;
  serviceType: string;
  requiredFields: Array<{ name: string; source: string; constant?: string }>;
}

const scenarios: Scenario[] = [
  {
    id: 'voice',
    name: 'Voice',
    description: 'Voice services missing OE fields (ReservedNumber, PICEmail)',
    color: 'cyan',
    serviceType: 'Voice',
    requiredFields: [
      { name: 'ReservedNumber', source: 'External_ID__c (voice service)' },
      { name: 'ResourceSystemGroupID', source: 'Constant', constant: 'Migrated' },
      { name: 'NumberStatus', source: 'Constant', constant: 'Reserved' },
      { name: 'PICEmail', source: 'BA → Contact → Email' },
    ],
  },
  {
    id: 'fibre',
    name: 'Fibre Service',
    description: 'Fibre services missing OE fields (BillingAccount)',
    color: 'blue',
    serviceType: 'Fibre Service',
    requiredFields: [
      { name: 'BillingAccount', source: 'Billing_Account__c' },
    ],
  },
  {
    id: 'esms',
    name: 'eSMS Service',
    description: 'eSMS services missing OE fields (ReservedNumber, eSMSUserName)',
    color: 'pink',
    serviceType: 'eSMS Service',
    requiredFields: [
      { name: 'ReservedNumber', source: 'External_ID__c' },
      { name: 'eSMSUserName', source: 'BA → Contact → Email' },
    ],
  },
  {
    id: 'access',
    name: 'Access Service',
    description: 'Access services missing OE fields (BillingAccount, PICEmail)',
    color: 'emerald',
    serviceType: 'Access Service',
    requiredFields: [
      { name: 'BillingAccount', source: 'Billing_Account__c' },
      { name: 'PICEmail', source: 'BA → Contact → Email' },
    ],
  },
];

function getMissingFieldsFromView(service: Service, scenarioId: ScenarioType): string[] {
  const missing: string[] = [];
  switch (scenarioId) {
    case 'voice':
      if (!service.x_externalId) missing.push('ReservedNumber');
      if (!service.x_picEmail) missing.push('PICEmail');
      break;
    case 'fibre':
      if (!service.x_billingAccountId) missing.push('BillingAccount');
      break;
    case 'esms':
      if (!service.x_externalId) missing.push('ReservedNumber');
      if (!service.x_picEmail) missing.push('eSMSUserName');
      break;
    case 'access':
      if (!service.x_billingAccountId) missing.push('BillingAccount');
      if (!service.x_picEmail) missing.push('PICEmail');
      break;
  }
  return missing;
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    pending: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', label: 'Pending' },
    inProgress: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', label: 'In Progress' },
    resolved: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', label: 'Resolved' },
    rejected: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', label: 'Rejected' },
  };
  const s = map[status] || map.pending;
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-medium', s.bg, s.text)}>
      {s.label}
    </span>
  );
}

// ========================================================================
// KPI Summary Cards
// ========================================================================

function computeKPIs(problems: OEServiceProblem[]) {
  const total = problems.length;
  const remediated = problems.filter(p => p.status === 'resolved').length;
  const pending = problems.filter(p => p.status === 'pending').length;
  const failed = problems.filter(p => p.status === 'rejected').length;
  const inProgress = problems.filter(p => p.status === 'inProgress').length;

  let mttrSeconds: number | null = null;
  const resolved = problems.filter(p => p.status === 'resolved');
  if (resolved.length > 0) {
    const durations = resolved
      .map(p => {
        if (p.remediationDuration) return p.remediationDuration;
        const start = p.detectedAt || p.creationDate;
        const end = p.resolvedAt || p.resolutionDate;
        if (!start || !end) return null;
        return (new Date(end).getTime() - new Date(start).getTime()) / 1000;
      })
      .filter((d): d is number => d !== null && d > 0);
    if (durations.length > 0) {
      mttrSeconds = durations.reduce((a, b) => a + b, 0) / durations.length;
    }
  }

  const errorRate = total > 0 ? (failed / total) * 100 : 0;

  return { total, remediated, pending, failed, inProgress, mttrSeconds, errorRate };
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '--';
  if (seconds < 60) return `${seconds.toFixed(0)}s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

function KPISummaryCards({ problems }: { problems: OEServiceProblem[] }) {
  const kpi = useMemo(() => computeKPIs(problems), [problems]);

  const cards: Array<{ label: string; value: string | number; color: string; icon: typeof CheckCircle2 }> = [
    { label: 'Total Detected', value: kpi.total, color: 'text-slate-900 dark:text-slate-100', icon: Search },
    { label: 'Remediated', value: kpi.remediated, color: 'text-emerald-600 dark:text-emerald-400', icon: CheckCircle2 },
    { label: 'Pending', value: kpi.pending, color: 'text-amber-600 dark:text-amber-400', icon: Clock },
    { label: 'Failed', value: kpi.failed, color: kpi.failed > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-400', icon: XCircle },
    { label: 'MTTR', value: formatDuration(kpi.mttrSeconds), color: 'text-blue-600 dark:text-blue-400', icon: TrendingUp },
    { label: 'Error Rate', value: `${kpi.errorRate.toFixed(1)}%`, color: kpi.errorRate > 5 ? 'text-red-600 dark:text-red-400' : 'text-slate-400', icon: AlertTriangle },
  ];

  if (problems.length === 0) return null;

  return (
    <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
      {cards.map(c => (
        <div key={c.label} className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3 text-center">
          <div className="flex items-center justify-center mb-1">
            <c.icon className={cn('w-3.5 h-3.5', c.color)} />
          </div>
          <div className={cn('text-xl font-bold', c.color)}>{c.value}</div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">{c.label}</div>
        </div>
      ))}
    </div>
  );
}

// ========================================================================
// Failure Alert Banner
// ========================================================================

function FailureAlertBanner({ failedCount, onDismiss }: { failedCount: number; onDismiss: () => void }) {
  if (failedCount === 0) return null;

  return (
    <div className="flex items-center justify-between rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 px-4 py-3">
      <div className="flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
        <div>
          <p className="text-sm font-medium text-red-800 dark:text-red-200">
            {failedCount} service{failedCount > 1 ? 's' : ''} failed remediation
          </p>
          <p className="text-xs text-red-600 dark:text-red-400">
            Check the tracking table for details. Failed services can be retried.
          </p>
        </div>
      </div>
      <button onClick={onDismiss} className="p-1 text-red-400 hover:text-red-600 transition-colors" title="Dismiss">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ========================================================================
// Detection Table Row
// ========================================================================

function DetectionRow({ service, scenarioId }: { service: Service; scenarioId: ScenarioType }) {
  const [expanded, setExpanded] = useState(false);
  const missing = useMemo(() => getMissingFieldsFromView(service, scenarioId), [service, scenarioId]);
  const hasMissing = missing.length > 0;

  return (
    <>
      <tr
        className={cn(
          'border-b border-slate-100 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-xs',
          hasMissing && 'bg-red-50/50 dark:bg-red-900/5',
        )}
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-3 py-2">
          {expanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
        </td>
        <td className="px-3 py-2">
          <div className="font-medium text-slate-900 dark:text-slate-100 truncate max-w-[200px]" title={service.name || ''}>
            {service.name || 'Unknown'}
          </div>
          <div className="font-mono text-[10px] text-slate-400">{service.id}</div>
        </td>
        <td className="px-3 py-2">
          <span className={cn('font-mono', service.x_externalId ? 'text-slate-700 dark:text-slate-300' : 'text-red-500 font-medium')}>
            {service.x_externalId || 'MISSING'}
          </span>
        </td>
        <td className="px-3 py-2">
          <span className={cn('font-mono text-[10px]', service.x_billingAccountId ? 'text-slate-700 dark:text-slate-300' : 'text-red-500 font-medium')}>
            {service.x_billingAccountName || service.x_billingAccountId || 'MISSING'}
          </span>
        </td>
        <td className="px-3 py-2">
          <span className="font-mono text-[10px] text-slate-500 truncate block max-w-[120px]" title={service.x_solutionId || ''}>
            {service.x_solutionId || '—'}
          </span>
        </td>
        <td className="px-3 py-2 text-center">
          {hasMissing ? (
            <span className="px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded text-[10px] font-medium">
              {missing.length} missing
            </span>
          ) : (
            <span className="px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded text-[10px] font-medium">
              OK
            </span>
          )}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-slate-50 dark:bg-slate-800/30">
          <td colSpan={6} className="px-6 py-3">
            <div className="text-xs space-y-1">
              {hasMissing ? (
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-medium text-slate-700 dark:text-slate-300">Missing (service view heuristic): </span>
                    <span className="text-red-600 dark:text-red-400">{missing.join(', ')}</span>
                    <p className="text-slate-400 mt-1 text-[10px]">Run "Check All" for full OE attachment analysis</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>All checked fields present in service view</span>
                </div>
              )}
              {service.x_accountName && (
                <div className="text-slate-500">Account: <span className="text-slate-700 dark:text-slate-300">{service.x_accountName}</span></div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ========================================================================
// Service Problem Tracking Row
// ========================================================================

function TrackingRow({ sp, onRemediate, isRemediating }: {
  sp: OEServiceProblem;
  onRemediate: (serviceId: string, spId: string) => void;
  isRemediating: boolean;
}) {
  return (
    <tr className="border-b border-slate-100 dark:border-slate-700 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
      <td className="px-3 py-2">
        <div className="font-mono text-slate-900 dark:text-slate-100">{sp.serviceId}</div>
        <span className="px-1.5 py-0.5 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 rounded text-[9px]">
          {sp.serviceType}
        </span>
      </td>
      <td className="px-3 py-2">
        <StatusBadge status={sp.status} />
      </td>
      <td className="px-3 py-2">
        {sp.missingFields.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {sp.missingFields.map(f => (
              <span key={f} className="px-1.5 py-0.5 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded text-[10px]">
                {f}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>
      <td className="px-3 py-2 text-slate-500 text-[10px]">
        {sp.productDefinitionName || '—'}
      </td>
      <td className="px-3 py-2 text-slate-500 text-[10px]">
        {formatDate(sp.detectedAt || sp.creationDate)}
      </td>
      <td className="px-3 py-2 text-slate-500 text-[10px]">
        {sp.status === 'resolved' ? formatDate(sp.resolutionDate) : '—'}
      </td>
      <td className="px-3 py-2">
        {sp.status === 'pending' && (
          <button
            onClick={() => onRemediate(sp.serviceId, sp.id)}
            disabled={isRemediating}
            className="px-2.5 py-1 bg-indigo-600 text-white rounded text-[10px] font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1 transition-colors"
          >
            {isRemediating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
            Remediate
          </button>
        )}
        {sp.status === 'inProgress' && (
          <span className="px-2.5 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-[10px] font-medium flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" /> In Progress
          </span>
        )}
        {sp.status === 'resolved' && (
          <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded text-[10px] font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Done
          </span>
        )}
        {sp.status === 'rejected' && (
          <button
            onClick={() => onRemediate(sp.serviceId, sp.id)}
            disabled={isRemediating}
            className="px-2.5 py-1 bg-amber-500 text-white rounded text-[10px] font-medium hover:bg-amber-600 disabled:opacity-50 flex items-center gap-1 transition-colors"
          >
            {isRemediating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
            Retry
          </button>
        )}
      </td>
    </tr>
  );
}

// ========================================================================
// Main Module
// ========================================================================

const ALL_SERVICE_TYPES = ['Voice', 'Fibre Service', 'eSMS Service', 'Access Service'] as const;

interface DetectionProgress {
  running: boolean;
  currentType: string;
  typesCompleted: number;
  typesTotal: number;
  checked: number;
  total: number;
  with_issues: number;
  no_issues: number;
  errors: number;
  problems_created: number;
}

export function OEPatcherModule() {
  const [activeScenario, setActiveScenario] = useState<ScenarioType>('voice');
  const [searchTerm, setSearchTerm] = useState('');
  const [enrichmentFilter, setEnrichmentFilter] = useState<'all' | 'available' | 'missing'>('all');
  const [trackingFilter, setTrackingFilter] = useState<'all' | 'pending' | 'partial' | 'resolved' | 'rejected'>('all');
  const [remediatingId, setRemediatingId] = useState<string | null>(null);
  const [showConfigEditor, setShowConfigEditor] = useState(false);
  const [alertDismissed, setAlertDismissed] = useState(false);

  const scenario = scenarios.find(s => s.id === activeScenario) || scenarios[0];

  const remediateMutation = useOERemediateSingle();

  // ---- All-types detection state ----
  const [detecting, setDetecting] = useState(false);
  const [detectionProgress, setDetectionProgress] = useState<DetectionProgress | null>(null);
  const cancelledRef = useRef(false);

  const runDetectionAllTypes = useCallback(async () => {
    if (detecting) return;
    setDetecting(true);
    cancelledRef.current = false;

    const acc = { checked: 0, total: 0, with_issues: 0, no_issues: 0, errors: 0, problems_created: 0 };

    setDetectionProgress({
      running: true, currentType: '', typesCompleted: 0,
      typesTotal: ALL_SERVICE_TYPES.length, ...acc,
    });

    for (let i = 0; i < ALL_SERVICE_TYPES.length; i++) {
      if (cancelledRef.current) break;
      const svcType = ALL_SERVICE_TYPES[i];

      setDetectionProgress((prev) => prev ? { ...prev, currentType: svcType } : prev);

      try {
        await batchCheckOEServices({ service_type: svcType, max_count: 500 });

        // Poll until this type finishes
        let done = false;
        while (!done && !cancelledRef.current) {
          await new Promise((r) => setTimeout(r, 2000));
          try {
            const p = await fetchCheckProgress(svcType);
            setDetectionProgress((prev) => prev ? {
              ...prev,
              currentType: svcType,
              checked: acc.checked + p.checked,
              total: acc.total + p.total,
              with_issues: acc.with_issues + p.with_issues,
              no_issues: acc.no_issues + p.no_issues,
              errors: acc.errors + p.errors,
              problems_created: acc.problems_created + p.problems_created,
            } : prev);
            if (!p.running) {
              acc.checked += p.checked;
              acc.total += p.total;
              acc.with_issues += p.with_issues;
              acc.no_issues += p.no_issues;
              acc.errors += p.errors;
              acc.problems_created += p.problems_created;
              done = true;
            }
          } catch { /* ignore poll errors */ }
        }
      } catch (err) {
        console.error(`Detection failed for ${svcType}:`, err);
      }

      setDetectionProgress((prev) => prev ? { ...prev, typesCompleted: i + 1 } : prev);
    }

    setDetectionProgress((prev) => prev ? { ...prev, running: false, currentType: '' } : prev);
    setDetecting(false);
  }, [detecting]);

  const isRunning = detecting;

  const serviceQueryParams = (svcType: string) => ({
    limit: 500,
    x_serviceType: svcType,
    x_migratedData: true as const,
    x_replacementServiceId: '',
  });

  const { data: services, isLoading, error, refetch, isFetching } = useServices(serviceQueryParams(scenario.serviceType));

  const { data: voiceServices } = useServices(serviceQueryParams('Voice'));
  const { data: fibreServices } = useServices(serviceQueryParams('Fibre Service'));
  const { data: esmsServices } = useServices(serviceQueryParams('eSMS Service'));
  const { data: accessServices } = useServices(serviceQueryParams('Access Service'));

  const tabCounts: Record<ScenarioType, number | null> = useMemo(() => ({
    voice: voiceServices?.length ?? null,
    fibre: fibreServices?.length ?? null,
    esms: esmsServices?.length ?? null,
    access: accessServices?.length ?? null,
  }), [voiceServices, fibreServices, esmsServices, accessServices]);

  const { data: allProblems, isLoading: isLoadingProblems, refetch: refetchProblems } = useOEServiceProblems(detecting);

  // Filter problems by active tab's serviceType
  const tabProblems = useMemo(() => {
    if (!allProblems) return [];
    return allProblems.filter(sp => sp.serviceType === scenario.serviceType);
  }, [allProblems, scenario.serviceType]);

  const pendingCount = useMemo(() => tabProblems.filter(sp => sp.status === 'pending').length, [tabProblems]);
  const resolvedCount = useMemo(() => tabProblems.filter(sp => sp.status === 'resolved').length, [tabProblems]);
  const rejectedCount = useMemo(() => tabProblems.filter(sp => sp.status === 'rejected').length, [tabProblems]);
  const partialCount = useMemo(() => tabProblems.filter(sp => {
    const state = sp.remediationState || '';
    return state === 'PARTIALLY_REMEDIATED' || state === 'ENRICHMENT_UNAVAILABLE' || state === 'ATTACHMENT_CORRUPT';
  }).length, [tabProblems]);
  const globalFailedCount = useMemo(() => (allProblems || []).filter(sp => sp.status === 'rejected').length, [allProblems]);

  const filteredProblems = useMemo(() => {
    if (trackingFilter === 'all') return tabProblems;
    if (trackingFilter === 'partial') {
      return tabProblems.filter(sp => {
        const state = sp.remediationState || '';
        return state === 'PARTIALLY_REMEDIATED' || state === 'ENRICHMENT_UNAVAILABLE' || state === 'ATTACHMENT_CORRUPT';
      });
    }
    return tabProblems.filter(sp => sp.status === trackingFilter);
  }, [tabProblems, trackingFilter]);

  // Filter services by search + enrichment status
  const filteredServices = useMemo(() => {
    if (!services) return [];
    let result = services;

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      result = result.filter(s =>
        s.id.toLowerCase().includes(term) ||
        (s.name || '').toLowerCase().includes(term) ||
        (s.x_accountName || '').toLowerCase().includes(term) ||
        (s.x_solutionId || '').toLowerCase().includes(term) ||
        (s.x_solutionName || '').toLowerCase().includes(term)
      );
    }

    if (enrichmentFilter !== 'all') {
      result = result.filter(s => {
        const hasMissing = getMissingFieldsFromView(s, activeScenario).length > 0;
        return enrichmentFilter === 'missing' ? hasMissing : !hasMissing;
      });
    }

    return result;
  }, [services, searchTerm, enrichmentFilter, activeScenario]);

  const servicesWithIssues = useMemo(() => {
    if (!services) return [];
    return services.filter(s => getMissingFieldsFromView(s, activeScenario).length > 0);
  }, [services, activeScenario]);

  const servicesWithoutIssues = useMemo(() => {
    if (!services) return [];
    return services.filter(s => getMissingFieldsFromView(s, activeScenario).length === 0);
  }, [services, activeScenario]);

  const handleRemediate = (serviceId: string, spId: string) => {
    setRemediatingId(serviceId);
    remediateMutation.mutate(
      { serviceId, service_problem_id: spId },
      {
        onSettled: () => {
          setRemediatingId(null);
          refetchProblems();
        },
      },
    );
  };

  const handleBatchRemediate = () => {
    const pending = tabProblems.filter(sp => sp.status === 'pending');
    if (pending.length === 0) return;
    if (!confirm(`Remediate ${pending.length} pending ${scenario.name} services? This will update Salesforce attachments and trigger SM syncs.`)) return;

    let idx = 0;
    const processNext = () => {
      if (idx >= pending.length) {
        refetchProblems();
        return;
      }
      const sp = pending[idx++];
      setRemediatingId(sp.serviceId);
      remediateMutation.mutate(
        { serviceId: sp.serviceId, service_problem_id: sp.id },
        {
          onSettled: () => {
            setRemediatingId(null);
            refetchProblems();
            processNext();
          },
        },
      );
    };
    processNext();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Migrated Service Data Patching
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Use Case 1867 - Detect and fix missing Order Enrichment fields
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowConfigEditor(!showConfigEditor)}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 transition-colors',
              showConfigEditor
                ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
            )}
          >
            <Settings className="w-4 h-4" />
            Configure Rules
          </button>
          <button
            onClick={() => { refetch(); refetchProblems(); }}
            disabled={isFetching}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
          >
            {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Refresh
          </button>
        </div>
      </div>

      {/* Config Editor (inline toggle) */}
      {showConfigEditor && (
        <OERulesEditor onClose={() => setShowConfigEditor(false)} />
      )}

      {/* KPI Summary Cards */}
      <KPISummaryCards problems={allProblems || []} />

      {/* Failure Alert Banner */}
      {!alertDismissed && (
        <FailureAlertBanner failedCount={globalFailedCount} onDismiss={() => setAlertDismissed(true)} />
      )}

      {/* Analytics Panel (collapsible) */}
      <OEAnalyticsPanel problems={allProblems || []} />

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-700">
        <div className="flex flex-wrap gap-1">
          {scenarios.map((s) => {
            const isActive = activeScenario === s.id;
            const count = tabCounts[s.id];
            return (
              <button
                key={s.id}
                onClick={() => setActiveScenario(s.id)}
                className={cn(
                  'px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors',
                  isActive
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-b-0 border-slate-200 dark:border-slate-700'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                )}
              >
                {s.name}
                {count !== null && (
                  <span className={cn(
                    'ml-2 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold rounded-full',
                    isActive
                      ? 'bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400',
                  )}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Scenario Info (compact) */}
      <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
        <Wrench className="w-4 h-4" />
        <span>{scenario.description}</span>
        <span className="text-slate-300 dark:text-slate-600">|</span>
        <span>Fields: {scenario.requiredFields.map(f => f.name).join(', ')}</span>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <Search className="w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search by Service ID, name, account, solution..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
        {searchTerm && (
          <button onClick={() => setSearchTerm('')} className="text-slate-400 hover:text-slate-600 text-sm">Clear</button>
        )}
      </div>

      {/* ============================================================ */}
      {/* SECTION A: Detection Table                                   */}
      {/* ============================================================ */}

      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Service Candidates ({filteredServices.length}{enrichmentFilter !== 'all' ? ` of ${services?.length ?? 0}` : ''})
          </h3>
          <div className="flex items-center gap-1">
            {([
              { key: 'all', label: 'All', count: services?.length ?? 0 },
              { key: 'available', label: 'Enrichment Available', count: servicesWithoutIssues.length },
              { key: 'missing', label: 'Enrichment Missing', count: servicesWithIssues.length },
            ] as const).map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setEnrichmentFilter(key)}
                className={cn(
                  'px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors',
                  enrichmentFilter === key
                    ? key === 'missing'
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                      : key === 'available'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                        : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                    : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800',
                )}
              >
                {label} ({count})
              </button>
            ))}
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            <span className="ml-2 text-slate-500 text-sm">Loading services...</span>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/10 p-3 flex items-start gap-2">
            <XCircle className="w-4 h-4 text-red-500 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-300">
              {error instanceof Error ? error.message : 'Failed to load services'}
            </p>
          </div>
        )}

        {!isLoading && !error && filteredServices.length > 0 && (
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="max-h-[400px] overflow-y-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0 z-10">
                  <tr className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <th className="px-3 py-2 w-8"></th>
                    <th className="px-3 py-2">Service</th>
                    <th className="px-3 py-2">External ID</th>
                    <th className="px-3 py-2">Billing Account</th>
                    <th className="px-3 py-2">Solution</th>
                    <th className="px-3 py-2 text-center">Enrichment</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredServices.map((service) => (
                    <DetectionRow key={service.id} service={service} scenarioId={activeScenario} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!isLoading && !error && filteredServices.length === 0 && (
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 text-center text-sm text-slate-500">
            {searchTerm
              ? `No services matching "${searchTerm}"`
              : enrichmentFilter === 'missing'
                ? `No ${scenario.name} candidates with missing enrichment data.`
                : enrichmentFilter === 'available'
                  ? `No ${scenario.name} candidates with enrichment data available.`
                  : `No ${scenario.name} candidates found.`}
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* SECTION B: Run Detection (all service types at once)         */}
      {/* ============================================================ */}

      <div className="rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-900/20 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            <h4 className="font-semibold text-slate-900 dark:text-slate-100">OE Attachment Analysis</h4>
            <span className="text-xs text-slate-500">all service types</span>
          </div>
          <button
            onClick={runDetectionAllTypes}
            disabled={detecting}
            className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
          >
            {detecting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            {detecting ? 'Detecting...' : 'Run Detection'}
          </button>
        </div>

        {detectionProgress && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-teal-700 dark:text-teal-300 font-medium">
                {detectionProgress.running
                  ? `Scanning ${detectionProgress.currentType} (${detectionProgress.typesCompleted + 1}/${detectionProgress.typesTotal})`
                  : `Complete -- all ${detectionProgress.typesTotal} service types scanned`
                }
              </span>
              {detectionProgress.total > 0 && (
                <span className="text-slate-500">
                  {detectionProgress.checked}/{detectionProgress.total} services ({Math.round((detectionProgress.checked / detectionProgress.total) * 100)}%)
                </span>
              )}
            </div>
            {detectionProgress.total > 0 && (
              <div className="w-full bg-teal-200 dark:bg-teal-800 rounded-full h-2">
                <div
                  className={cn(
                    'h-2 rounded-full transition-all duration-500',
                    detectionProgress.running ? 'bg-teal-500 animate-pulse' : 'bg-teal-600',
                  )}
                  style={{ width: `${Math.round((detectionProgress.checked / detectionProgress.total) * 100)}%` }}
                />
              </div>
            )}
            <div className="grid grid-cols-5 gap-2 text-center">
              <div className="bg-white dark:bg-slate-800 rounded p-2">
                <div className="text-lg font-bold text-slate-900 dark:text-slate-100">{detectionProgress.checked}</div>
                <div className="text-[10px] text-slate-500">Checked</div>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded p-2">
                <div className="text-lg font-bold text-red-600">{detectionProgress.with_issues}</div>
                <div className="text-[10px] text-red-600">With Issues</div>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded p-2">
                <div className="text-lg font-bold text-emerald-600">{detectionProgress.no_issues}</div>
                <div className="text-[10px] text-emerald-600">Clean</div>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded p-2">
                <div className="text-lg font-bold text-amber-600">{detectionProgress.errors}</div>
                <div className="text-[10px] text-amber-600">Errors</div>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded p-2">
                <div className="text-lg font-bold text-teal-600">{detectionProgress.problems_created}</div>
                <div className="text-[10px] text-teal-600">SP Created</div>
              </div>
            </div>
            {detectionProgress.running && (
              <p className="text-[10px] text-teal-600 dark:text-teal-400">
                Scanning Voice, Fibre, eSMS, and Access services. Issues appear in the tracking table as they are discovered...
              </p>
            )}
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* SECTION C: Service Problem Tracking Table                    */}
      {/* ============================================================ */}

      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Remediation Tracking ({filteredProblems.length}{trackingFilter !== 'all' ? ` of ${tabProblems.length}` : ''})
            </h3>
          </div>
          <div className="flex items-center gap-1">
            {([
              { key: 'all' as const, label: 'All', count: tabProblems.length },
              { key: 'pending' as const, label: 'Pending', count: pendingCount },
              { key: 'partial' as const, label: 'Needs Attention', count: partialCount },
              { key: 'resolved' as const, label: 'Resolved', count: resolvedCount },
              { key: 'rejected' as const, label: 'Failed', count: rejectedCount },
            ]).map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setTrackingFilter(key)}
                className={cn(
                  'px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors',
                  trackingFilter === key
                    ? key === 'rejected'
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                      : key === 'resolved'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                        : key === 'pending'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                          : key === 'partial'
                            ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'
                            : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                    : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800',
                )}
              >
                {label} ({count})
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {tabProblems.length > 0 && (
              <button
                onClick={() => {
                  const rows = tabProblems.map(p => ({
                    id: p.id,
                    status: p.status,
                    serviceId: p.serviceId,
                    serviceType: p.serviceType,
                    missingFields: p.missingFields.join(', '),
                    fieldsPatched: p.fieldsPatched.join(', '),
                    presentFields: Object.entries(p.presentFields).map(([k, v]) => `${k}=${v}`).join(', '),
                    remediationState: p.remediationState,
                    triggeredBy: p.triggeredBy ?? '',
                    remediationDuration: p.remediationDuration ?? '',
                    detectedAt: p.detectedAt,
                    resolvedAt: p.resolvedAt ?? '',
                    productDefinitionName: p.productDefinitionName ?? '',
                    creationDate: p.creationDate ?? '',
                    resolutionDate: p.resolutionDate ?? '',
                  }));
                  const ts = new Date().toISOString().slice(0, 10);
                  downloadCSV(rows, `oe-audit-trail-${ts}.csv`);
                }}
                className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-1.5"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Export CSV
              </button>
            )}
            {pendingCount > 0 && (
              <button
                onClick={handleBatchRemediate}
                disabled={remediateMutation.isPending}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
              >
                {remediateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
                Batch Remediate ({pendingCount})
              </button>
            )}
          </div>
        </div>

        {isLoadingProblems && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
            <span className="ml-2 text-slate-500 text-sm">Loading service problems...</span>
          </div>
        )}

        {!isLoadingProblems && filteredProblems.length > 0 && (
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="max-h-[400px] overflow-y-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0 z-10">
                  <tr className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <th className="px-3 py-2">Service</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Missing Fields</th>
                    <th className="px-3 py-2">Product Definition</th>
                    <th className="px-3 py-2">Detected</th>
                    <th className="px-3 py-2">Resolved</th>
                    <th className="px-3 py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProblems.map((sp) => (
                    <TrackingRow
                      key={sp.id}
                      sp={sp}
                      onRemediate={handleRemediate}
                      isRemediating={remediatingId === sp.serviceId}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!isLoadingProblems && filteredProblems.length === 0 && (
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 text-center text-sm text-slate-500">
            {trackingFilter !== 'all' && tabProblems.length > 0
              ? `No ${trackingFilter} service problems for ${scenario.name}.`
              : <>No service problems tracked for {scenario.name} yet.
                  <br />
                  <span className="text-slate-400 text-xs">Run Detection above to analyze OE attachments and create tracking records.</span>
                </>}
          </div>
        )}

        {remediateMutation.isError && (
          <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
            Remediation error: {remediateMutation.error?.message}
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* SECTION D: Batch Scheduler                                   */}
      {/* ============================================================ */}

      <BatchScheduler
        category="PartialDataMissing"
        useCase="1867"
        onImmediateStart={() => {
          refetchProblems();
        }}
      />
    </div>
  );
}
