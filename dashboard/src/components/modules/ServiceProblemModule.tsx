'use client';

import React, { useState } from 'react';
import { useServiceProblemList } from '@/tmf/working-apis/hooks';
import type { ServiceProblem } from '@/tmf/working-apis/api';
import { extractServiceProblemDetails } from '@/tmf/working-apis/api';

interface ServiceProblemModuleProps {
  filterCategory?: string; // Optional filter to show only specific category (e.g., "SolutionEmpty")
}

// Apex Job details from serviceProblemEventRecord API
interface ApexJobDetails {
  id: string;
  eventType: string;
  eventTime: string;
  recordTime: string;
  notification?: {
    '@type'?: string;
    '@baseType'?: string;
    '@schemaLocation'?: string;
  };
}

// Status badge colors (TMF656 ServiceProblemStateType)
const statusColors: Record<string, { bg: string; text: string; dot: string }> = {
  pending: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', dot: 'bg-yellow-400' },
  acknowledged: { bg: 'bg-blue-500/10', text: 'text-blue-400', dot: 'bg-blue-400' },
  inProgress: { bg: 'bg-blue-500/10', text: 'text-blue-400', dot: 'bg-blue-400' },
  resolved: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  rejected: { bg: 'bg-red-500/10', text: 'text-red-400', dot: 'bg-red-400' },
  held: { bg: 'bg-orange-500/10', text: 'text-orange-400', dot: 'bg-orange-400' },
  cancelled: { bg: 'bg-slate-500/10', text: 'text-slate-400', dot: 'bg-slate-400' },
  closed: { bg: 'bg-slate-500/10', text: 'text-slate-400', dot: 'bg-slate-400' },
};

// Category badge colors
const categoryColors: Record<string, string> = {
  'SolutionEmpty': 'bg-violet-500/20 text-violet-300',
  'PartialDataMissing': 'bg-amber-500/20 text-amber-300',
  'PartialDataMissing_Voice': 'bg-amber-500/20 text-amber-300',
  'PartialDataMissing_Fibre': 'bg-cyan-500/20 text-cyan-300',
  'PartialDataMissing_eSMS': 'bg-pink-500/20 text-pink-300',
};

function StatusBadge({ status }: { status: string }) {
  const colors = statusColors[status] || statusColors.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
      {status}
    </span>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const color = categoryColors[category] || 'bg-slate-500/20 text-slate-300';
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-mono ${color}`}>
      {category}
    </span>
  );
}

function formatDate(dateString?: string): string {
  if (!dateString) return '—';
  try {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}

// Modal component for showing Apex Job details
function ApexJobModal({ 
  jobId, 
  onClose 
}: { 
  jobId: string; 
  onClose: () => void;
}) {
  const [jobDetails, setJobDetails] = useState<ApexJobDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    async function fetchJobDetails() {
      try {
        setLoading(true);
        setError(null);
        
        // Build the TMF API URL
        const apiUrl = `/api/tmf-api/serviceProblemEventRecord/${jobId}`;
        
        // Log the TMF API call to console
        console.log('%c[TMF656] GET ServiceProblemEventRecord', 'color: #a78bfa; font-weight: bold;');
        console.log('🔗 API URL:', apiUrl);
        console.log('📋 Job ID:', jobId);
        
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
          console.error('%c[TMF656] Error', 'color: #f87171; font-weight: bold;', response.status);
          throw new Error(`Failed to fetch job details: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Log the response
        console.log('%c[TMF656] Response:', 'color: #34d399; font-weight: bold;');
        console.log(data);
        console.log('---');
        
        setJobDetails(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch job details');
      } finally {
        setLoading(false);
      }
    }

    fetchJobDetails();
  }, [jobId]);

  // Parse the notification to extract details
  const parseNotification = (notification?: ApexJobDetails['notification']) => {
    if (!notification) return null;
    
    const summary = notification['@type'] || '';
    const jobType = notification['@baseType'] || '';
    const createdById = notification['@schemaLocation'] || '';
    
    // Parse the enhanced summary: "BatchApex: ClassName | Status: X | Items: X/X | Errors: X | Detail: ..."
    const parts = summary.split(' | ');
    const classInfo = parts[0] || '';
    
    let status = '';
    let items = '';
    let errors = '';
    let detail = '';
    
    parts.forEach(part => {
      if (part.startsWith('Status: ')) status = part.replace('Status: ', '');
      if (part.startsWith('Items: ')) items = part.replace('Items: ', '');
      if (part.startsWith('Errors: ')) errors = part.replace('Errors: ', '');
      if (part.startsWith('Detail: ')) detail = part.replace('Detail: ', '');
      if (part.startsWith('Method: ')) detail = part.replace('Method: ', '');
    });
    
    return {
      classInfo,
      status,
      items,
      errors,
      detail,
      jobType,
      createdById,
    };
  };

  const parsed = parseNotification(jobDetails?.notification);

  return (
    <div 
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-slate-800 rounded-xl border border-slate-600 max-w-lg w-full shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-slate-100">Apex Job Details</h3>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin w-8 h-8 border-2 border-slate-500 border-t-violet-400 rounded-full" />
            </div>
          ) : error ? (
            <div className="text-red-400 bg-red-500/10 rounded-lg p-4 text-center">
              {error}
            </div>
          ) : jobDetails ? (
            <div className="space-y-4">
              {/* Job ID */}
              <div>
                <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Job ID</div>
                <div className="font-mono text-sm text-slate-200 bg-slate-900/50 px-3 py-2 rounded">
                  {jobDetails.id}
                </div>
              </div>

              {/* Event Type / Class */}
              <div>
                <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Apex Class</div>
                <div className="text-slate-200 font-medium">
                  {jobDetails.eventType || '—'}
                </div>
              </div>

              {/* Status & Items */}
              {parsed && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Status</div>
                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                      parsed.status === 'Completed' && !parsed.errors
                        ? 'bg-emerald-500/20 text-emerald-300' 
                        : parsed.status === 'Failed' || parsed.errors
                        ? 'bg-red-500/20 text-red-300'
                        : 'bg-yellow-500/20 text-yellow-300'
                    }`}>
                      {parsed.status || '—'}
                    </span>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Items Processed</div>
                    <div className="text-slate-200 font-mono">{parsed.items || '—'}</div>
                  </div>
                </div>
              )}

              {/* Errors */}
              {parsed?.errors && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                  <div className="text-xs text-red-400 uppercase tracking-wide mb-1">⚠️ Errors: {parsed.errors}</div>
                  {parsed.detail && (
                    <div className="text-red-300 text-sm font-mono break-words">
                      {parsed.detail}
                    </div>
                  )}
                </div>
              )}

              {/* Job Type */}
              {parsed?.jobType && (
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Job Type</div>
                  <span className="inline-block px-2 py-0.5 bg-violet-500/20 text-violet-300 rounded text-xs font-mono">
                    {parsed.jobType}
                  </span>
                </div>
              )}

              {/* Created By */}
              {parsed?.createdById && (
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Triggered By</div>
                  <div className="text-slate-300 font-mono text-xs">{parsed.createdById}</div>
                </div>
              )}

              {/* Timestamps */}
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-700">
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Started</div>
                  <div className="text-slate-300 text-sm">{formatDate(jobDetails.eventTime)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Completed</div>
                  <div className="text-slate-300 text-sm">{formatDate(jobDetails.recordTime)}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-slate-500 text-center py-4">No details available</div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function ProblemRow({ 
  problem, 
  onJobClick 
}: { 
  problem: ServiceProblem;
  onJobClick: (jobId: string) => void;
}) {
  const details = extractServiceProblemDetails(problem);
  
  return (
    <tr className="border-b border-slate-700/50 hover:bg-slate-800/30 transition-colors">
      <td className="px-4 py-3">
        <CategoryBadge category={details.module} />
      </td>
      <td className="px-4 py-3">
        <div className="font-medium text-slate-200">{details.solutionName || '—'}</div>
        <div className="text-xs text-slate-500 font-mono">{details.solutionId}</div>
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={details.status || 'pending'} />
      </td>
      <td className="px-4 py-3 text-sm text-slate-400">
        {details.jobId ? (
          <button
            onClick={() => onJobClick(details.jobId!)}
            className="font-mono text-xs bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 px-2 py-0.5 rounded cursor-pointer transition-colors border border-violet-500/30 hover:border-violet-500/50"
            title="Click to view Apex job details"
          >
            {details.jobId}
          </button>
        ) : (
          <span className="text-slate-600">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-slate-400">
        {formatDate(details.createdAt)}
      </td>
      <td className="px-4 py-3 text-sm text-slate-400">
        {formatDate(details.updatedAt)}
      </td>
      <td className="px-4 py-3 text-sm">
        {details.resultMessage ? (
          <span className={`text-xs ${details.status === 'rejected' ? 'text-red-400' : 'text-slate-400'}`}>
            {details.resultMessage.length > 50 ? `${details.resultMessage.slice(0, 50)}...` : details.resultMessage}
          </span>
        ) : details.description ? (
          <span className="text-xs text-slate-400">
            {details.description.length > 50 ? `${details.description.slice(0, 50)}...` : details.description}
          </span>
        ) : (
          <span className="text-slate-600">—</span>
        )}
      </td>
    </tr>
  );
}

export default function ServiceProblemModule({ filterCategory }: ServiceProblemModuleProps = {}) {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  
  const { data, isLoading, error, refetch } = useServiceProblemList(
    { limit: 50, category: filterCategory },
    { refetchInterval: 30000 } // Auto-refresh every 30s
  );

  // Normalize response (can be array or single object)
  const problems: ServiceProblem[] = React.useMemo(() => {
    if (!data?.data) return [];
    return Array.isArray(data.data) ? data.data : [data.data];
  }, [data]);

  // Sort by lastUpdate descending (most recent first)
  const sortedProblems = React.useMemo(() => {
    return [...problems].sort((a, b) => {
      const dateA = a.lastUpdate ? new Date(a.lastUpdate).getTime() : 0;
      const dateB = b.lastUpdate ? new Date(b.lastUpdate).getTime() : 0;
      return dateB - dateA;
    });
  }, [problems]);

  // Stats
  const stats = React.useMemo(() => {
    return {
      total: problems.length,
      resolved: problems.filter(p => p.status === 'resolved').length,
      rejected: problems.filter(p => p.status === 'rejected').length,
      pending: problems.filter(p => p.status === 'pending' || p.status === 'inProgress' || p.status === 'acknowledged').length,
    };
  }, [problems]);

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 text-center">
        <div className="text-red-400 font-medium mb-2">Failed to load service problems</div>
        <div className="text-red-300/70 text-sm mb-4">{error.message}</div>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-sm transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with stats */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">
            {filterCategory ? `${filterCategory} Issues` : 'Service Problems (TMF656)'}
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            {filterCategory 
              ? `Confirmed ${filterCategory} issues and remediation status` 
              : 'Track confirmed issues and remediation progress'}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isLoading}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm transition-colors disabled:opacity-50"
        >
          {isLoading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
          <div className="text-2xl font-bold text-slate-100">{stats.total}</div>
          <div className="text-sm text-slate-400">Total Issues</div>
        </div>
        <div className="bg-emerald-500/10 rounded-lg p-4 border border-emerald-500/30">
          <div className="text-2xl font-bold text-emerald-400">{stats.resolved}</div>
          <div className="text-sm text-emerald-300/70">Resolved</div>
        </div>
        <div className="bg-red-500/10 rounded-lg p-4 border border-red-500/30">
          <div className="text-2xl font-bold text-red-400">{stats.rejected}</div>
          <div className="text-sm text-red-300/70">Failed</div>
        </div>
        <div className="bg-yellow-500/10 rounded-lg p-4 border border-yellow-500/30">
          <div className="text-2xl font-bold text-yellow-400">{stats.pending}</div>
          <div className="text-sm text-yellow-300/70">Pending</div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-800/30 rounded-lg border border-slate-700/50 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-slate-400">
            <div className="animate-spin w-8 h-8 border-2 border-slate-500 border-t-slate-200 rounded-full mx-auto mb-4" />
            Loading service problems...
          </div>
        ) : sortedProblems.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <div className="text-4xl mb-4">✅</div>
            <div className="font-medium">No issues recorded</div>
            <div className="text-sm mt-1">Issues will appear here when detected and confirmed</div>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-800/50 text-left text-sm text-slate-400 border-b border-slate-700/50">
              <tr>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Solution</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Job ID</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Updated</th>
                <th className="px-4 py-3 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {sortedProblems.map((problem) => (
                <ProblemRow 
                  key={problem.id} 
                  problem={problem} 
                  onJobClick={(jobId) => setSelectedJobId(jobId)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Apex Job Details Modal */}
      {selectedJobId && (
        <ApexJobModal 
          jobId={selectedJobId} 
          onClose={() => setSelectedJobId(null)} 
        />
      )}
    </div>
  );
}


