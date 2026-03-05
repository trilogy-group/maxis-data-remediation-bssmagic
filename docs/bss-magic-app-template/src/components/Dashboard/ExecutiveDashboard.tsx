import { useMemo } from 'react';
import {
  CheckCircle,
  AlertCircle,
  Clock,
  Target,
  Zap,
  Activity,
  Download,
  RefreshCw,
} from 'lucide-react';
import { MetricCard } from './MetricCard';
import { useServiceProblems } from '../../services/tmf/hooks';
import type { ServiceProblem } from '../../types/tmf-api';
import { downloadCSV } from '../../lib/csv-export';
import { Spinner } from './Loader';

function getChar(sp: ServiceProblem, name: string): string {
  return (sp.characteristic?.find(c => c.name === name)?.value as string) ?? '';
}

function parseSeconds(sp: ServiceProblem): number | null {
  const raw = getChar(sp, 'remediationDuration');
  if (!raw) return null;
  const n = parseFloat(raw);
  return isNaN(n) ? null : n;
}

interface Stats {
  total: number;
  resolved: number;
  pending: number;
  inProgress: number;
  rejected: number;
  avgMttrSeconds: number | null;
  successRate: number;
  bySeverity: Record<string, number>;
  byCategory: Record<string, number>;
  byServiceType: Record<string, number>;
  recentDetections: number;
  recentResolutions: number;
  scheduledRemediations: number;
  manualRemediations: number;
}

function computeStats(problems: ServiceProblem[]): Stats {
  const total = problems.length;
  const resolved = problems.filter(p => p.status === 'resolved').length;
  const pending = problems.filter(p => p.status === 'pending').length;
  const inProgress = problems.filter(p => p.status === 'inProgress').length;
  const rejected = problems.filter(p => p.status === 'rejected').length;

  const durations = problems
    .map(parseSeconds)
    .filter((d): d is number => d !== null && d > 0);
  const avgMttrSeconds =
    durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : null;

  const successRate = total > 0 ? (resolved / total) * 100 : 0;

  const bySeverity: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  const byServiceType: Record<string, number> = {};

  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;
  let recentDetections = 0;
  let recentResolutions = 0;
  let scheduledRemediations = 0;
  let manualRemediations = 0;

  for (const p of problems) {
    const sev = p.impactImportanceFactor || 'unknown';
    bySeverity[sev] = (bySeverity[sev] || 0) + 1;

    const cat = p.category || 'unknown';
    byCategory[cat] = (byCategory[cat] || 0) + 1;

    const st = getChar(p, 'serviceType') || 'unknown';
    byServiceType[st] = (byServiceType[st] || 0) + 1;

    const detected = getChar(p, 'detectedAt') || p.creationDate;
    if (detected && now - new Date(detected).getTime() < oneDayMs) {
      recentDetections++;
    }
    const resolvedAt = getChar(p, 'resolvedAt') || p.resolutionDate;
    if (
      p.status === 'resolved' &&
      resolvedAt &&
      now - new Date(resolvedAt).getTime() < oneDayMs
    ) {
      recentResolutions++;
    }

    const triggeredBy = getChar(p, 'triggeredBy');
    if (triggeredBy) {
      if (triggeredBy.startsWith('scheduled')) {
        scheduledRemediations++;
      } else {
        manualRemediations++;
      }
    }
  }

  return {
    total,
    resolved,
    pending,
    inProgress,
    rejected,
    avgMttrSeconds,
    successRate,
    bySeverity,
    byCategory,
    byServiceType,
    recentDetections,
    recentResolutions,
    scheduledRemediations,
    manualRemediations,
  };
}

function formatMttr(seconds: number | null): string {
  if (seconds === null) return 'N/A';
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  return `${(seconds / 60).toFixed(1)} min`;
}

function ExportButton({ problems }: { problems: ServiceProblem[] }) {
  const handleExport = () => {
    const rows = problems.map(p => ({
      id: p.id ?? '',
      status: p.status ?? '',
      category: p.category ?? '',
      description: p.description ?? '',
      priority: p.priority ?? '',
      serviceId: getChar(p, 'serviceId'),
      serviceType: getChar(p, 'serviceType'),
      missingFields: getChar(p, 'missingFields'),
      fieldsPatched: getChar(p, 'fieldsPatched'),
      triggeredBy: getChar(p, 'triggeredBy'),
      remediationDuration: getChar(p, 'remediationDuration'),
      remediationState: getChar(p, 'remediationState'),
      detectedAt: getChar(p, 'detectedAt'),
      resolvedAt: getChar(p, 'resolvedAt'),
      creationDate: p.creationDate ?? '',
      resolutionDate: p.resolutionDate ?? '',
      statusChangeReason: p.reason ?? '',
    }));
    const ts = new Date().toISOString().slice(0, 10);
    downloadCSV(rows, `audit-trail-export-${ts}.csv`);
  };

  return (
    <button
      onClick={handleExport}
      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
    >
      <Download size={16} />
      Export Report (CSV)
    </button>
  );
}

function CategoryBreakdown({ byCategory }: { byCategory: Record<string, number> }) {
  const sorted = Object.entries(byCategory).sort(([, a], [, b]) => b - a);
  const total = sorted.reduce((s, [, v]) => s + v, 0);

  const categoryLabels: Record<string, string> = {
    SolutionEmpty: 'Failed Migrations (1147)',
    PartialDataMissing: 'Missing OE Data (1867)',
    FailedMigration: 'Failed Migration',
    MissingBillingAccount: 'Missing Billing Account',
  };

  const categoryColors: Record<string, string> = {
    SolutionEmpty: 'bg-red-500',
    PartialDataMissing: 'bg-amber-500',
    FailedMigration: 'bg-orange-500',
    MissingBillingAccount: 'bg-blue-500',
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
        Issues by Category
      </h3>
      <div className="space-y-4">
        {sorted.map(([cat, count]) => {
          const pct = total > 0 ? (count / total) * 100 : 0;
          return (
            <div key={cat}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {categoryLabels[cat] || cat}
                </span>
                <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                  {count} ({pct.toFixed(0)}%)
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className={`${categoryColors[cat] || 'bg-indigo-500'} h-2 rounded-full transition-all`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ServiceTypeBreakdown({ byServiceType }: { byServiceType: Record<string, number> }) {
  const sorted = Object.entries(byServiceType)
    .filter(([k]) => k !== 'unknown')
    .sort(([, a], [, b]) => b - a);
  const total = sorted.reduce((s, [, v]) => s + v, 0);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
        Issues by Service Type
      </h3>
      <div className="space-y-4">
        {sorted.map(([st, count]) => {
          const pct = total > 0 ? (count / total) * 100 : 0;
          return (
            <div key={st}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {st}
                </span>
                <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                  {count}
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-indigo-500 h-2 rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
        {sorted.length === 0 && (
          <p className="text-sm text-gray-400">No service type data available</p>
        )}
      </div>
    </div>
  );
}

export function ExecutiveDashboard() {
  const {
    data: problems = [],
    isLoading,
    isFetching,
    refetch,
  } = useServiceProblems({ limit: 1000 });

  const stats = useMemo(() => computeStats(problems), [problems]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
        <span className="ml-3 text-gray-500 dark:text-gray-400">
          Loading dashboard data...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-lg p-8 text-white">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">
              Data Integrity &amp; Remediation Overview
            </h2>
            <p className="text-indigo-100 text-lg">
              Automated Detection, Patching &amp; Audit Trail
            </p>
            <div className="mt-4 flex items-center gap-2 text-sm">
              <div className="h-2 w-2 bg-green-400 rounded-full animate-pulse" />
              <span>
                Live Data -- {stats.total} tracked issues
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ExportButton problems={problems} />
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-white/20 rounded-lg hover:bg-white/30 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Top KPI Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Issues Tracked"
          value={stats.total}
          subtitle="Across all service categories"
          trend={stats.recentDetections > 0 ? 'up' : 'neutral'}
          trendText={`${stats.recentDetections} detected today`}
          icon={Activity}
          variant="default"
        />

        <MetricCard
          title="Successfully Remediated"
          value={stats.resolved}
          subtitle={`${stats.successRate.toFixed(1)}% success rate`}
          trend="up"
          trendText={`${stats.recentResolutions} resolved today`}
          icon={CheckCircle}
          variant="success"
        />

        <MetricCard
          title="Pending / In Progress"
          value={stats.pending + stats.inProgress}
          subtitle={`${stats.pending} pending, ${stats.inProgress} active`}
          trend={stats.pending > 10 ? 'down' : 'neutral'}
          trendText={stats.pending > 10 ? 'Backlog growing' : 'Manageable'}
          icon={Clock}
          variant={stats.pending > 20 ? 'warning' : 'default'}
        />

        <MetricCard
          title="Failed / Rejected"
          value={stats.rejected}
          subtitle="Require manual intervention"
          trend={stats.rejected > 0 ? 'down' : 'neutral'}
          trendText={stats.rejected > 0 ? 'Review needed' : 'All clear'}
          icon={AlertCircle}
          variant={stats.rejected > 0 ? 'danger' : 'default'}
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          title="Average MTTR"
          value={formatMttr(stats.avgMttrSeconds)}
          subtitle="Mean time to remediation"
          icon={Zap}
          variant="default"
        />

        <MetricCard
          title="Scheduled vs Manual"
          value={
            stats.scheduledRemediations + stats.manualRemediations > 0
              ? `${((stats.scheduledRemediations / (stats.scheduledRemediations + stats.manualRemediations)) * 100).toFixed(0)}% scheduled`
              : 'N/A'
          }
          subtitle={`${stats.scheduledRemediations} scheduled, ${stats.manualRemediations} manual`}
          icon={Target}
          variant="default"
        />

        <MetricCard
          title="Error Rate"
          value={
            stats.total > 0
              ? `${((stats.rejected / stats.total) * 100).toFixed(1)}%`
              : '0%'
          }
          subtitle="Remediation failure rate"
          icon={AlertCircle}
          variant={
            stats.total > 0 && stats.rejected / stats.total > 0.1
              ? 'warning'
              : 'default'
          }
        />
      </div>

      {/* Breakdown Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CategoryBreakdown byCategory={stats.byCategory} />
        <ServiceTypeBreakdown byServiceType={stats.byServiceType} />
      </div>

    </div>
  );
}
