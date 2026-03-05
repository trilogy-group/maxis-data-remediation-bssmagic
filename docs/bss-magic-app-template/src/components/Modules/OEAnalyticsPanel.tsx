import { useMemo, useState } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { ChevronDown, ChevronRight, BarChart3 } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { OEServiceProblem } from '../../services/salesforce/client';

function toDateKey(iso: string | undefined): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

interface DayBucket {
  date: string;
  detected: number;
  resolved: number;
  failed: number;
  cumulativeOpen: number;
}

function buildTimeSeries(problems: OEServiceProblem[]): DayBucket[] {
  const detectedByDay: Record<string, number> = {};
  const resolvedByDay: Record<string, number> = {};
  const failedByDay: Record<string, number> = {};

  for (const p of problems) {
    const dKey = toDateKey(p.detectedAt || p.creationDate);
    if (dKey) detectedByDay[dKey] = (detectedByDay[dKey] || 0) + 1;

    if (p.status === 'resolved') {
      const rKey = toDateKey(p.resolvedAt || p.resolutionDate);
      if (rKey) resolvedByDay[rKey] = (resolvedByDay[rKey] || 0) + 1;
    }
    if (p.status === 'rejected') {
      const fKey = toDateKey(p.resolvedAt || p.resolutionDate || p.creationDate);
      if (fKey) failedByDay[fKey] = (failedByDay[fKey] || 0) + 1;
    }
  }

  const allDates = new Set([
    ...Object.keys(detectedByDay),
    ...Object.keys(resolvedByDay),
    ...Object.keys(failedByDay),
  ]);
  const sorted = [...allDates].sort();

  let cumulativeOpen = 0;
  return sorted.map(date => {
    const detected = detectedByDay[date] || 0;
    const resolved = resolvedByDay[date] || 0;
    const failed = failedByDay[date] || 0;
    cumulativeOpen += detected - resolved;
    return { date, detected, resolved, failed, cumulativeOpen: Math.max(0, cumulativeOpen) };
  });
}

function buildMTTRData(problems: OEServiceProblem[]): Array<{ date: string; mttrMinutes: number; count: number }> {
  const resolved = problems.filter(p => p.status === 'resolved');
  const byDay: Record<string, { totalSec: number; count: number }> = {};

  for (const p of resolved) {
    const rKey = toDateKey(p.resolvedAt || p.resolutionDate);
    if (!rKey) continue;

    let durationSec = p.remediationDuration;
    if (!durationSec) {
      const start = p.detectedAt || p.creationDate;
      const end = p.resolvedAt || p.resolutionDate;
      if (start && end) {
        durationSec = (new Date(end).getTime() - new Date(start).getTime()) / 1000;
      }
    }
    if (!durationSec || durationSec <= 0) continue;

    if (!byDay[rKey]) byDay[rKey] = { totalSec: 0, count: 0 };
    byDay[rKey].totalSec += durationSec;
    byDay[rKey].count += 1;
  }

  return Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => ({
      date,
      mttrMinutes: Number(((d.totalSec / d.count) / 60).toFixed(2)),
      count: d.count,
    }));
}

function formatDateLabel(date: string): string {
  try {
    const d = new Date(date + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  } catch {
    return date;
  }
}

export function OEAnalyticsPanel({ problems }: { problems: OEServiceProblem[] }) {
  const [expanded, setExpanded] = useState(false);
  const timeSeries = useMemo(() => buildTimeSeries(problems), [problems]);
  const mttrData = useMemo(() => buildMTTRData(problems), [problems]);

  if (problems.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-indigo-500" />
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">Analytics</span>
          <span className="text-xs text-slate-400">{timeSeries.length} day{timeSeries.length !== 1 ? 's' : ''} of data</span>
        </div>
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-6">
          {/* Chart 1: Detection vs Remediation over time */}
          {timeSeries.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                Detection & Remediation Over Time
              </h4>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={timeSeries} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={formatDateLabel} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip
                    labelFormatter={formatDateLabel}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="detected" name="Detected" fill="#f59e0b" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="resolved" name="Resolved" fill="#10b981" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="failed" name="Failed" fill="#ef4444" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Chart 2: Open Backlog Trend */}
          {timeSeries.length > 1 && (
            <div>
              <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                Open Backlog Trend
              </h4>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={timeSeries} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={formatDateLabel} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip
                    labelFormatter={formatDateLabel}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="cumulativeOpen"
                    name="Open Issues"
                    stroke="#6366f1"
                    fill="#6366f1"
                    fillOpacity={0.15}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Chart 3: MTTR Trend */}
          {mttrData.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                Average Resolution Time (MTTR)
              </h4>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={mttrData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={formatDateLabel} />
                  <YAxis tick={{ fontSize: 10 }} unit="m" allowDecimals={false} />
                  <Tooltip
                    labelFormatter={formatDateLabel}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    formatter={(value: number) => [`${value} min`, 'Avg MTTR']}
                  />
                  <Bar dataKey="mttrMinutes" name="MTTR (minutes)" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {timeSeries.length === 0 && (
            <p className={cn('text-sm text-slate-400 text-center py-6')}>
              No data available yet. Run detection and remediation to see trends.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
