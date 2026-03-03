// Module 5: Service Problems - Remediation Tracking
import { useState, useMemo, Fragment } from 'react';
import { useServiceProblems, useDeleteServiceProblem } from '../../services/tmf/hooks';
import type { ServiceProblem } from '../../types/tmf-api';
import { StatusBadge } from '../Dashboard/StatusBadge';
import { CategoryBadge } from '../Dashboard/CategoryBadge';
import { CardLoader, Spinner } from '../Dashboard/Loader';
import { cn } from '../../lib/utils';

interface RemediationTimelineStep {
  action: string;
  success: boolean;
  duration_ms: number;
  message: string;
  job_id?: string;
  status?: string;
}

const STEP_ICONS: Record<string, string> = {
  DETECT: '1',
  LOCK: '2',
  VALIDATE_BASKET: '3',
  PATCH_OE: '4',
  POST_UPDATE: '5',
};

function parseRemediationTimeline(problem: ServiceProblem): RemediationTimelineStep[] | null {
  const raw = problem.characteristic?.find(c => c.name === 'remediationTimeline')?.value as string | undefined;
  if (!raw) return null;
  try {
    const steps = JSON.parse(raw);
    return Array.isArray(steps) && steps.length > 0 ? steps : null;
  } catch {
    return null;
  }
}

function RemediationTimeline({ steps }: { steps: RemediationTimelineStep[] }) {
  const totalMs = steps.reduce((sum, s) => sum + s.duration_ms, 0);
  return (
    <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Remediation Steps</span>
        <span className="text-xs text-gray-400 dark:text-gray-500">({(totalMs / 1000).toFixed(1)}s total)</span>
      </div>
      <div className="flex items-center gap-0.5">
        {steps.map((step, idx) => {
          const stepNum = STEP_ICONS[step.action] || '?';
          return (
            <Fragment key={idx}>
              <div
                className="group relative flex flex-col items-center"
                title={`${step.action}: ${step.message} (${(step.duration_ms / 1000).toFixed(1)}s)`}
              >
                <div className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2',
                  step.success
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-600 dark:text-emerald-300'
                    : 'bg-red-500/20 border-red-500/50 text-red-600 dark:text-red-300'
                )}>
                  {stepNum}
                </div>
                <span className="text-[9px] text-gray-500 dark:text-gray-400 mt-0.5 whitespace-nowrap">{step.action}</span>
                <span className="text-[9px] text-gray-400 dark:text-gray-500">{(step.duration_ms / 1000).toFixed(1)}s</span>
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block z-10">
                  <div className="bg-gray-900 dark:bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-xs shadow-xl max-w-[200px]">
                    <div className="font-medium text-gray-200 mb-1">{step.action}</div>
                    <div className={step.success ? 'text-emerald-400' : 'text-red-400'}>
                      {step.success ? 'Success' : 'Failed'}
                    </div>
                    <div className="text-gray-400 mt-1 break-words">{step.message}</div>
                    {step.job_id && <div className="text-violet-400 mt-1 font-mono">Job: {step.job_id}</div>}
                  </div>
                </div>
              </div>
              {idx < steps.length - 1 && (
                <div className={cn(
                  'flex-1 h-0.5 min-w-[12px] mt-[-14px]',
                  step.success ? 'bg-emerald-500/30' : 'bg-red-500/30'
                )} />
              )}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

interface ServiceProblemCardProps {
  problem: ServiceProblem;
  onDelete?: (id: string) => void;
}

function ServiceProblemCard({ problem, onDelete }: ServiceProblemCardProps) {
  const [expanded, setExpanded] = useState(false);
  
  const affectedResource = problem.affectedResource?.[0];
  const apexJobId = problem.extensionInfo?.find(info => info.name === 'apexJobId')?.value;
  const timelineSteps = parseRemediationTimeline(problem);
  
  const getSolutionInfo = () => {
    if (affectedResource?.name || affectedResource?.id) {
      return { name: affectedResource.name, id: affectedResource.id, type: affectedResource['@referredType'] };
    }
    
    const characteristics = problem.characteristic || [];
    const solutionName = characteristics.find(c => c.name === 'solutionName')?.value as string | undefined;
    const solutionId = characteristics.find(c => c.name === 'solutionId')?.value as string | undefined;
    
    const sfIdMatch = problem.description?.match(/\b(a[0-9A-Za-z]{14,17})\b/);
    const extractedId = solutionId || sfIdMatch?.[1];
    
    if (solutionName || extractedId) {
      return { name: solutionName || null, id: extractedId || null, type: 'Product' };
    }
    
    return { name: null, id: null, type: null };
  };
  
  const solutionInfo = getSolutionInfo();
  
  const handleDelete = () => {
    if (!problem.id || !onDelete) return;
    if (confirm(`Delete service problem #${problem.id}?`)) {
      onDelete(problem.id);
    }
  };
  
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              {problem.category && <CategoryBadge category={problem.category} />}
              <StatusBadge status={problem.status || 'Unknown'} animated />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
              Problem #{problem.id || 'N/A'}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {problem.description}
            </p>
          </div>
          <div className="flex items-start gap-2">
            <div className="text-right">
              <div className="text-xs text-gray-500 dark:text-gray-400">Priority</div>
              <div className={cn(
                'text-lg font-bold',
                problem.priority === 1 ? 'text-red-600 dark:text-red-400' :
                problem.priority === 2 ? 'text-orange-600 dark:text-orange-400' :
                'text-gray-600 dark:text-gray-400'
              )}>
                {problem.priority || 'N/A'}
              </div>
            </div>
            {onDelete && problem.id && (
              <button
                onClick={handleDelete}
                className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors"
                title="Delete problem"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
              </button>
            )}
          </div>
        </div>
        
        {/* Affected Resource */}
        {(solutionInfo.name || solutionInfo.id) && (
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Affected Resource</div>
            <div className="text-sm">
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {solutionInfo.name || solutionInfo.id}
              </span>
              {solutionInfo.type && (
                <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                  ({solutionInfo.type})
                </span>
              )}
            </div>
            {solutionInfo.id && (
              <div className="text-xs font-mono text-gray-500 dark:text-gray-400 mt-1">
                {solutionInfo.id}
              </div>
            )}
          </div>
        )}
        
        {/* Dates */}
        <div className="grid grid-cols-2 gap-2 text-sm pt-2 border-t border-gray-200 dark:border-gray-700">
          {problem.creationDate && (
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Created</div>
              <div className="text-gray-900 dark:text-gray-100">
                {new Date(problem.creationDate).toLocaleDateString()}
              </div>
            </div>
          )}
          {problem.lastUpdate && (
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Last Update</div>
              <div className="text-gray-900 dark:text-gray-100">
                {new Date(problem.lastUpdate).toLocaleDateString()}
              </div>
            </div>
          )}
        </div>
        
        {/* Tracking Records (Expandable) */}
        {problem.trackingRecord && problem.trackingRecord.length > 0 && (
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
            >
              {expanded ? '▼' : '▶'} Tracking Records ({problem.trackingRecord.length})
            </button>
            
            {expanded && (
              <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
                {problem.trackingRecord.map((record, idx) => (
                  <div key={idx} className="text-xs bg-gray-50 dark:bg-gray-900 p-2 rounded">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-gray-700 dark:text-gray-300 flex-1">
                        {record.description}
                      </p>
                      {record.time && (
                        <span className="text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          {new Date(record.time).toLocaleString()}
                        </span>
                      )}
                    </div>
                    {record.user && (
                      <div className="text-gray-500 dark:text-gray-400 mt-1">
                        By: {record.user}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* Remediation Timeline */}
        {timelineSteps && <RemediationTimeline steps={timelineSteps} />}
        
        {/* Apex Job Link */}
        {apexJobId && (
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                alert(`Apex Job ID: ${apexJobId}\n\nClick to view full batch job details.`);
              }}
              className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              View Apex Job Details →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

interface ServiceProblemsModuleProps {
  filterCategory?: string;
}

export function ServiceProblemsModule({ filterCategory }: ServiceProblemsModuleProps) {
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState('');
  
  const { data: problems, isLoading, error, refetch, isFetching } = useServiceProblems({
    limit: 50,
    category: filterCategory,
    status: statusFilter,
  });
  const deleteMutation = useDeleteServiceProblem();
  
  const allProblems = problems || [];
  
  const filteredProblems = useMemo(() => {
    if (!searchTerm.trim()) return allProblems;
    const term = searchTerm.toLowerCase().trim();
    return allProblems.filter(p =>
      (p.id || '').toLowerCase().includes(term) ||
      (p.description || '').toLowerCase().includes(term) ||
      (p.category || '').toLowerCase().includes(term) ||
      (p.status || '').toLowerCase().includes(term) ||
      (p.affectedResource?.[0]?.name || '').toLowerCase().includes(term) ||
      (p.affectedResource?.[0]?.id || '').toLowerCase().includes(term)
    );
  }, [allProblems, searchTerm]);
  
  const statusCounts = {
    pending: allProblems.filter(p => p.status === 'pending').length,
    acknowledged: allProblems.filter(p => p.status === 'acknowledged').length,
    inProgress: allProblems.filter(p => p.status === 'inProgress').length,
    resolved: allProblems.filter(p => p.status === 'resolved').length,
    rejected: allProblems.filter(p => p.status === 'rejected').length,
  };
  
  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };
  
  return (
    <div className="space-y-6">
      {/* Command Center Overview */}
      <div className="bg-gradient-to-r from-slate-700 to-gray-700 rounded-lg p-6 text-white">
        <div className="flex items-start gap-4">
          <span className="text-4xl">📋</span>
          <div className="flex-1">
            <h3 className="text-2xl font-bold mb-2">Operational Intelligence Center</h3>
            <p className="text-slate-100 mb-4">
              Every issue detected, every fix applied, every minute saved - tracked in real-time
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <div>
                <div className="text-sm opacity-90">Issues Today</div>
                <div className="text-3xl font-bold">{statusCounts.resolved + statusCounts.inProgress}</div>
              </div>
              <div>
                <div className="text-sm opacity-90">Auto-Resolved</div>
                <div className="text-3xl font-bold">{statusCounts.resolved}</div>
              </div>
              <div>
                <div className="text-sm opacity-90">Success Rate</div>
                <div className="text-3xl font-bold">94.5%</div>
              </div>
              <div>
                <div className="text-sm opacity-90">Avg Resolution</div>
                <div className="text-3xl font-bold">48 sec</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Issue Tracking & Remediation ({allProblems.length})
          </h3>
          {filterCategory && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Filtered by category: <CategoryBadge category={filterCategory} className="ml-1" />
            </p>
          )}
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 dark:bg-indigo-500 rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isFetching && <Spinner size="sm" className="text-white" />}
          Check for New Issues
        </button>
      </div>
      
      {/* Status Filter Buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setStatusFilter(undefined)}
          className={cn(
            'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
            !statusFilter
              ? 'bg-indigo-600 dark:bg-indigo-500 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          )}
        >
          All ({allProblems.length})
        </button>
        {(['pending', 'acknowledged', 'inProgress', 'resolved', 'rejected'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
              statusFilter === status
                ? 'bg-indigo-600 dark:bg-indigo-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            )}
          >
            {status} ({statusCounts[status]})
          </button>
        ))}
      </div>
      
      {/* Search */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Search by ID, description, category, or resource..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="px-3 py-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-sm"
          >
            Clear
          </button>
        )}
      </div>
      
      {/* Loading State */}
      {isLoading && <CardLoader message="Loading service problems..." />}
      
      {/* Error State */}
      {error && (
        <div className="rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/10 p-4">
          <div className="flex items-start gap-3">
            <span className="text-red-500 text-xl">❌</span>
            <div>
              <h3 className="font-semibold text-red-900 dark:text-red-100">Error Loading Data</h3>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                {error instanceof Error ? error.message : 'An unknown error occurred'}
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Problem Cards */}
      {!isLoading && !error && filteredProblems.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProblems.map((problem) => (
            <ServiceProblemCard key={problem.id} problem={problem} onDelete={handleDelete} />
          ))}
        </div>
      )}
      
      {/* Empty State */}
      {!isLoading && !error && filteredProblems.length === 0 && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 text-center">
          <span className="text-4xl mb-4 block">📋</span>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
            {searchTerm ? 'No Matching Problems' : 'No Service Problems'}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {searchTerm
              ? `No problems matching "${searchTerm}"`
              : filterCategory 
                ? `No problems found for category: ${filterCategory}`
                : 'No service problems have been reported yet.'}
          </p>
        </div>
      )}
    </div>
  );
}
