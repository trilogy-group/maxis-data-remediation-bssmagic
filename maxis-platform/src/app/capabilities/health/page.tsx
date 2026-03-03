'use client';

import { useQuery } from '@tanstack/react-query';
import { queryTMF } from '@/lib/api';
import { Activity, TrendingUp, TrendingDown, Minus, AlertCircle } from 'lucide-react';

interface ServiceProblem {
  id: string;
  category?: string;
  status?: string;
  statusChangeDate?: string;
  firstAlert?: string;
  resolutionDate?: string;
}

const CATEGORIES = [
  { key: 'SolutionEmpty', label: 'Solution Empty', color: 'border-red-500', bg: 'bg-red-50' },
  { key: 'PartialDataMissing', label: 'Partial Data Missing', color: 'border-orange-500', bg: 'bg-orange-50' },
  { key: 'MigrationFailed', label: 'Migration Failed', color: 'border-yellow-500', bg: 'bg-yellow-50' },
  { key: 'BillingAccountMissing', label: 'Billing Account Missing', color: 'border-blue-500', bg: 'bg-blue-50' },
];

function isWithinWindow(dateStr: string | undefined, hours: number): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const cutoff = new Date(Date.now() - hours * 3600 * 1000);
  return d >= cutoff;
}

export default function HealthPage() {
  const { data: issues, isLoading } = useQuery({
    queryKey: ['health-problems'],
    queryFn: () => queryTMF('/tmf-api/serviceProblemManagement/v5/serviceProblem', { limit: '500' }) as Promise<ServiceProblem[]>,
    refetchInterval: 60000,
  });

  const metrics = CATEGORIES.map(cat => {
    const catIssues = (issues ?? []).filter(i => i.category === cat.key);
    const active = catIssues.filter(i => i.status !== 'resolved' && i.status !== 'rejected');
    const resolved = catIssues.filter(i => i.status === 'resolved');

    return {
      ...cat,
      active: active.length,
      detected24h: catIssues.filter(i => isWithinWindow(i.firstAlert || i.statusChangeDate, 24)).length,
      detected7d: catIssues.filter(i => isWithinWindow(i.firstAlert || i.statusChangeDate, 168)).length,
      detected30d: catIssues.length,
      resolved24h: resolved.filter(i => isWithinWindow(i.resolutionDate || i.statusChangeDate, 24)).length,
      resolved7d: resolved.filter(i => isWithinWindow(i.resolutionDate || i.statusChangeDate, 168)).length,
      resolved30d: resolved.length,
    };
  });

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Activity className="w-6 h-6 text-slate-600" /> Health Trends
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Data integrity health across 4 use cases with sliding time windows (User Story 1)
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-slate-400">Loading health data...</div>
      ) : (
        <div className="space-y-6">
          {metrics.map(m => {
            const trending = m.detected24h > m.resolved24h ? 'worsening' : m.resolved24h > m.detected24h ? 'improving' : 'stable';
            return (
              <div key={m.key} className={`bg-white rounded-xl border-l-4 ${m.color} border border-slate-200 p-6`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold text-slate-900">{m.label}</h2>
                    {m.active > 0 && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                        <AlertCircle className="w-3 h-3" />
                        {m.active} active
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-sm">
                    {trending === 'improving' && <><TrendingDown className="w-4 h-4 text-green-500" /><span className="text-green-600 font-medium">Improving</span></>}
                    {trending === 'worsening' && <><TrendingUp className="w-4 h-4 text-red-500" /><span className="text-red-600 font-medium">Worsening</span></>}
                    {trending === 'stable' && <><Minus className="w-4 h-4 text-slate-400" /><span className="text-slate-500">Stable</span></>}
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-4 text-center text-sm">
                  <div className={`${m.bg} rounded-lg p-3`}>
                    <div className="text-2xl font-bold text-slate-900">{m.active}</div>
                    <div className="text-xs text-slate-500">Active Now</div>
                  </div>

                  <div className="col-span-3">
                    <div className="text-xs text-slate-400 font-medium uppercase mb-2">Detected</div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-slate-50 rounded-lg p-2">
                        <div className="text-lg font-bold text-slate-700">{m.detected24h}</div>
                        <div className="text-[10px] text-slate-400">24h</div>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-2">
                        <div className="text-lg font-bold text-slate-700">{m.detected7d}</div>
                        <div className="text-[10px] text-slate-400">7d</div>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-2">
                        <div className="text-lg font-bold text-slate-700">{m.detected30d}</div>
                        <div className="text-[10px] text-slate-400">30d</div>
                      </div>
                    </div>
                  </div>

                  <div className="col-span-3">
                    <div className="text-xs text-slate-400 font-medium uppercase mb-2">Resolved</div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-green-50 rounded-lg p-2">
                        <div className="text-lg font-bold text-green-700">{m.resolved24h}</div>
                        <div className="text-[10px] text-slate-400">24h</div>
                      </div>
                      <div className="bg-green-50 rounded-lg p-2">
                        <div className="text-lg font-bold text-green-700">{m.resolved7d}</div>
                        <div className="text-[10px] text-slate-400">7d</div>
                      </div>
                      <div className="bg-green-50 rounded-lg p-2">
                        <div className="text-lg font-bold text-green-700">{m.resolved30d}</div>
                        <div className="text-[10px] text-slate-400">30d</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
