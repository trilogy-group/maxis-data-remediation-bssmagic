'use client';

import { useQuery } from '@tanstack/react-query';
import { queryTMF, triggerRemediation } from '@/lib/api';
import { AlertTriangle, RefreshCw, Wrench, Eye, ChevronRight, X } from 'lucide-react';
import { useState } from 'react';

interface ServiceProblem {
  id: string;
  category?: string;
  status?: string;
  name?: string;
  description?: string;
  statusChangeDate?: string;
  firstAlert?: string;
  priority?: string;
  characteristic?: Array<{ name: string; value: unknown }>;
  [key: string]: unknown;
}

export default function IssuesPage() {
  const [selectedIssue, setSelectedIssue] = useState<ServiceProblem | null>(null);
  const [remediating, setRemediating] = useState<string | null>(null);

  const { data: issues, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['service-problems'],
    queryFn: () => queryTMF('/tmf-api/serviceProblemManagement/v5/serviceProblem', { limit: '100' }) as Promise<ServiceProblem[]>,
  });

  const getChar = (issue: ServiceProblem, name: string) => {
    const c = issue.characteristic?.find(ch => ch.name === name);
    return c?.value as string | undefined;
  };

  const handleRemediate = async (solutionId: string) => {
    setRemediating(solutionId);
    try {
      await triggerRemediation(solutionId);
      await refetch();
    } catch (e) {
      console.error('Remediation failed:', e);
    } finally {
      setRemediating(null);
    }
  };

  const categoryCounts: Record<string, number> = {};
  const statusCounts: Record<string, number> = {};
  (issues ?? []).forEach(i => {
    categoryCounts[i.category || 'unknown'] = (categoryCounts[i.category || 'unknown'] || 0) + 1;
    statusCounts[i.status || 'unknown'] = (statusCounts[i.status || 'unknown'] || 0) + 1;
  });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-slate-600" /> Issue Dashboard
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Live ServiceProblem records from the Maxis runtime
          </p>
        </div>
        <button onClick={() => refetch()} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm hover:bg-slate-50">
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-3xl font-bold text-slate-900">{issues?.length ?? '—'}</div>
          <div className="text-sm text-slate-500">Total Issues</div>
        </div>
        {Object.entries(statusCounts).map(([status, count]) => (
          <div key={status} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-3xl font-bold text-slate-700">{count}</div>
            <div className="text-sm text-slate-500 capitalize">{status}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-6">
        <div className={`flex-1 ${selectedIssue ? 'max-w-[55%]' : ''} transition-all`}>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 text-slate-500 font-medium">Category</th>
                  <th className="text-left px-4 py-3 text-slate-500 font-medium">Status</th>
                  <th className="text-left px-4 py-3 text-slate-500 font-medium">Description</th>
                  <th className="text-left px-4 py-3 text-slate-500 font-medium">Updated</th>
                  <th className="text-left px-4 py-3 text-slate-500 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-400">Loading issues...</td></tr>
                ) : issues?.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-400">No service problems found</td></tr>
                ) : (
                  issues?.map(issue => (
                    <tr key={issue.id} className={`border-b border-slate-50 hover:bg-slate-50 cursor-pointer ${selectedIssue?.id === issue.id ? 'bg-purple-50' : ''}`}>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                          issue.category === 'SolutionEmpty' ? 'bg-red-100 text-red-700' :
                          issue.category === 'PartialDataMissing' ? 'bg-orange-100 text-orange-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {issue.category || 'unknown'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-xs rounded font-medium ${
                          issue.status === 'resolved' ? 'bg-green-100 text-green-700' :
                          issue.status === 'inProgress' ? 'bg-blue-100 text-blue-700' :
                          issue.status === 'rejected' ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {issue.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{issue.description || issue.name || issue.id}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{issue.statusChangeDate ? new Date(issue.statusChangeDate).toLocaleDateString() : '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setSelectedIssue(issue)} className="p-1 hover:bg-slate-200 rounded" title="View details">
                            <Eye className="w-4 h-4 text-slate-500" />
                          </button>
                          {issue.status === 'pending' && (
                            <button
                              onClick={() => {
                                const sid = getChar(issue, 'solutionId');
                                if (sid) handleRemediate(sid);
                              }}
                              disabled={remediating === issue.id}
                              className="p-1 hover:bg-purple-100 rounded"
                              title="Remediate"
                            >
                              <Wrench className={`w-4 h-4 text-purple-600 ${remediating === issue.id ? 'animate-spin' : ''}`} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {selectedIssue && (
          <div className="w-[45%] bg-white rounded-xl border border-slate-200 p-5 h-fit sticky top-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900">Issue Details</h3>
              <button onClick={() => setSelectedIssue(null)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div><span className="text-slate-500">ID:</span> <span className="font-mono text-xs">{selectedIssue.id}</span></div>
              <div><span className="text-slate-500">Category:</span> <span className="font-medium">{selectedIssue.category}</span></div>
              <div><span className="text-slate-500">Status:</span> <span className="font-medium">{selectedIssue.status}</span></div>
              <div><span className="text-slate-500">Description:</span> <span>{selectedIssue.description || '—'}</span></div>
              {selectedIssue.characteristic && (
                <div>
                  <span className="text-slate-500">Characteristics:</span>
                  <div className="mt-2 space-y-1">
                    {selectedIssue.characteristic.map((c, i) => (
                      <div key={i} className="flex gap-2 text-xs bg-slate-50 rounded px-2 py-1">
                        <span className="text-slate-500 font-medium">{c.name}:</span>
                        <span className="text-slate-700 font-mono truncate">{typeof c.value === 'object' ? JSON.stringify(c.value) : String(c.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
