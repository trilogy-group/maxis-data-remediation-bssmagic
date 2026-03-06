// Module: 1147 Solution Empty Validator Drill-Down
// User Story: Execute Controlled Re-Migration for Solution Empty (Use Case 1147)
// Implements controlled batch re-migration with state engine tracking:
// 1. User selects batch size and solutions
// 2. State machine processes each solution deterministically
// 3. Execution report generated for audit

import { useState, useEffect, useMemo, Fragment } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  FileText,
  Wrench,
  Loader2,
  X,
  ExternalLink,
  Play,
  Square,
  Calendar,
  CheckSquare,
  SquareIcon,
  BarChart3,
  Download,
  Plus,
  ArrowRight,
  RotateCcw,
  Trash2,
  Search,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useSolutionEmptyData } from '../../services/solutionEmpty/hooks';
import { useFixSolution } from '../../hooks/useFixSolution';
import { useBatchRemediation, STATE_DESCRIPTIONS, STATE_PROGRESS } from '../../hooks/useBatchRemediation';
import { BatchScheduler } from './BatchScheduler';
import { deleteServiceProblem } from '../../services/tmf/client';
import type {
  SolutionEmptyIssue,
  SolutionEmptySummary,
  ServiceProblem,
  RemediationOutcome,
  BatchExecutionConfig,
  ExecutionReport,
  RemediationState,
} from '../../types/solution-empty';
import { FAILURE_STAGES } from '../../types/solution-empty';

// Apex Job Details Modal
interface ApexJobDetails {
  id: string;
  eventType?: string;
  eventTime?: string;
  recordTime?: string;
  notification?: {
    '@type'?: string;
    '@baseType'?: string;
    '@schemaLocation'?: string;
  };
}

function ApexJobModal({ jobId, onClose }: { jobId: string; onClose: () => void }) {
  const [jobDetails, setJobDetails] = useState<ApexJobDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchJobDetails() {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch job details via ts-dashboard task API (queries Salesforce AsyncApexJob directly)
        // The /api/task endpoint maps Salesforce job data to a TMF653-like Task format
        const apiUrl = `/api/task?id=${jobId}`;
        
        console.log('%c[ApexJob] GET Task', 'color: #a78bfa; font-weight: bold;');
        console.log('🔗 API URL:', apiUrl);
        
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch job details: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('%c[ApexJob] Response:', 'color: #34d399; font-weight: bold;', data);
        
        // Map Task API response to our expected format
        if (data) {
          setJobDetails({
            id: data.id,
            eventType: data.name, // Apex class name
            eventTime: data.startDate,
            recordTime: data.completionDate,
            notification: {
              '@type': `${data.name} | Status: ${data.status} | ${data.description}`,
              '@baseType': data.category, // JobType (BatchApex, etc.)
              '@schemaLocation': data.statusChangeReason || '',
            }
          });
        } else {
          throw new Error('Job not found');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch job details');
      } finally {
        setLoading(false);
      }
    }

    fetchJobDetails();
  }, [jobId]);

  // Parse notification to extract job info
  const parseNotification = (notification?: ApexJobDetails['notification']) => {
    if (!notification) return null;
    
    const summary = notification['@type'] || '';
    const jobType = notification['@baseType'] || '';
    const createdById = notification['@schemaLocation'] || '';
    
    // Parse: "BatchApex: ClassName | Status: X | Items: X/X | Errors: X | Detail: ..."
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
    
    return { classInfo, status, items, errors, detail, jobType, createdById };
  };

  const parsed = parseNotification(jobDetails?.notification);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Apex Job Details
            </h3>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-4 overflow-y-auto max-h-[60vh]">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
              </div>
            ) : error ? (
              <div className="text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg p-4 text-center">
                {error}
              </div>
            ) : jobDetails ? (
              <div className="space-y-4">
                {/* Job ID */}
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Job ID</div>
                  <div className="font-mono text-sm text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-900 px-3 py-2 rounded">
                    {jobDetails.id}
                  </div>
                </div>

                {/* Apex Class */}
                {(jobDetails.eventType || parsed?.classInfo) && (
                  <div>
                    <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Apex Class</div>
                    <div className="text-slate-900 dark:text-slate-100 font-medium">
                      {jobDetails.eventType || parsed?.classInfo || '—'}
                    </div>
                  </div>
                )}

                {/* Status & Items */}
                {parsed && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Status</div>
                      <span className={cn(
                        'inline-block px-3 py-1 rounded-full text-sm font-medium',
                        parsed.status === 'Completed' && !parsed.errors
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : parsed.status === 'Failed' || parsed.errors
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      )}>
                        {parsed.status || '—'}
                      </span>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Items Processed</div>
                      <div className="text-slate-900 dark:text-slate-100 font-mono">{parsed.items || '—'}</div>
                    </div>
                  </div>
                )}

                {/* Errors */}
                {parsed?.errors && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                    <div className="text-xs text-red-600 dark:text-red-400 uppercase tracking-wide mb-1">
                      Errors: {parsed.errors}
                    </div>
                    {parsed.detail && (
                      <div className="text-red-700 dark:text-red-300 text-sm font-mono break-words">
                        {parsed.detail}
                      </div>
                    )}
                  </div>
                )}

                {/* Job Type */}
                {parsed?.jobType && (
                  <div>
                    <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Job Type</div>
                    <span className="inline-block px-2 py-0.5 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 rounded text-xs font-mono">
                      {parsed.jobType}
                    </span>
                  </div>
                )}

                {/* Timestamps */}
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <div>
                    <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Started</div>
                    <div className="text-slate-700 dark:text-slate-300 text-sm">{formatDate(jobDetails.eventTime)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Completed</div>
                    <div className="text-slate-700 dark:text-slate-300 text-sm">{formatDate(jobDetails.recordTime)}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-slate-500 text-center py-4">No details available</div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-sm transition-colors"
            >
              Close
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// Local remediation status tracking (for single-solution fixes)
type LocalRemediationState = {
  status: 'idle' | 'pending' | 'success' | 'error';
  message?: string;
  jobId?: string;
  serviceProblemId?: string;
};

export function SolutionEmptyModule() {
  const { data, issues, serviceProblems, isLoading, isError, lastUpdated, refetch } = useSolutionEmptyData();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [remediationStates, setRemediationStates] = useState<Record<string, LocalRemediationState>>({});
  const [isServiceProblemsCollapsed, setIsServiceProblemsCollapsed] = useState(false);
  
  // Selection state for detection table
  const [selectedSolutions, setSelectedSolutions] = useState<Set<string>>(new Set());
  const [isAddingToRemediation, setIsAddingToRemediation] = useState(false);
  const [showExecutionReport, setShowExecutionReport] = useState(false);
  
  // Selection state for remediation table
  const [selectedServiceProblems, setSelectedServiceProblems] = useState<Set<string>>(new Set());
  const [batchSize, setBatchSize] = useState<10 | 50 | 100 | 500>(10);
  
  // Manual solution ID input
  const [manualSolutionId, setManualSolutionId] = useState('');
  const [isAddingManual, setIsAddingManual] = useState(false);
  
  // Search state for both tables
  const [detectionSearchTerm, setDetectionSearchTerm] = useState('');
  const [trackingSearchTerm, setTrackingSearchTerm] = useState('');
  
  // Use the proper useFixSolution hook (same as original TS app)
  const fixSolution = useFixSolution();
  
  // Batch remediation hook
  const {
    startBatch,
    currentReport,
    isRunning: isBatchRunning,
    progress: batchProgress,
    currentSolution,
    currentState,
    cancelBatch,
  } = useBatchRemediation();
  
  // Get solution IDs that are already in tracking
  const trackedSolutionIds = useMemo(() => {
    const ids = new Set<string>();
    for (const sp of serviceProblems) {
      // Extract solution ID from externalIdentifier or characteristic
      const solutionId = sp.externalIdentifier?.find(e => e.externalIdentifierType === 'SolutionId')?.id
        || sp.characteristic?.find(c => c.name === 'solutionId')?.value as string | undefined
        || sp.affectedResource?.[0]?.id;
      if (solutionId) ids.add(solutionId);
    }
    return ids;
  }, [serviceProblems]);
  
  // Filtered detection results
  const filteredIssues = useMemo(() => {
    if (!detectionSearchTerm.trim()) return issues;
    const term = detectionSearchTerm.toLowerCase();
    return issues.filter(i =>
      i.solutionId.toLowerCase().includes(term) ||
      (i.solutionName && i.solutionName.toLowerCase().includes(term)) ||
      i.fixability.reasonCode.toLowerCase().includes(term) ||
      i.remediation.outcome.toLowerCase().includes(term)
    );
  }, [issues, detectionSearchTerm]);

  // Filtered tracking (service problems)
  const filteredServiceProblems = useMemo(() => {
    if (!trackingSearchTerm.trim()) return serviceProblems;
    const term = trackingSearchTerm.toLowerCase();
    return serviceProblems.filter(sp => {
      const solId = sp.externalIdentifier?.find(e => e.externalIdentifierType === 'SolutionId')?.id
        || sp.characteristic?.find(c => c.name === 'solutionId')?.value as string | undefined
        || sp.affectedResource?.[0]?.id || '';
      const solName = sp.name || '';
      return solId.toLowerCase().includes(term) ||
        solName.toLowerCase().includes(term) ||
        sp.status.toLowerCase().includes(term) ||
        sp.description?.toLowerCase().includes(term) ||
        sp.category?.toLowerCase().includes(term);
    });
  }, [serviceProblems, trackingSearchTerm]);

  // Select all solutions (that are not already tracked)
  const handleSelectAll = () => {
    const untracked = issues.filter(i => !trackedSolutionIds.has(i.solutionId));
    if (selectedSolutions.size === untracked.length) {
      setSelectedSolutions(new Set());
    } else {
      setSelectedSolutions(new Set(untracked.map(s => s.solutionId)));
    }
  };
  
  // Toggle individual selection
  const toggleSelection = (solutionId: string) => {
    const newSelection = new Set(selectedSolutions);
    if (newSelection.has(solutionId)) {
      newSelection.delete(solutionId);
    } else {
      newSelection.add(solutionId);
    }
    setSelectedSolutions(newSelection);
  };
  
  // Add selected solutions to remediation tracking (creates ServiceProblem entries)
  const handleAddToRemediation = async () => {
    if (selectedSolutions.size === 0) return;
    
    setIsAddingToRemediation(true);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const API_KEY = import.meta.env.VITE_BSSMAGIC_API_KEY || 'bssmagic-d58d6761265b01accc13e8b21bae8282';
    if (import.meta.env.PROD) headers['X-API-Key'] = API_KEY;
    
    const TMF_API_PATH = '/tmf-api/serviceProblemManagement/v5/serviceProblem';
    
    for (const solutionId of selectedSolutions) {
      const issue = issues.find(i => i.solutionId === solutionId);
      if (!issue) continue;
      
      const spId = `sp-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
      const now = new Date().toISOString();
      
      try {
        await fetch(TMF_API_PATH, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            '@type': 'ServiceProblem',
            '@baseType': 'Entity',
            id: spId,
            name: `SolutionEmpty - ${issue.solutionName || issue.solutionId}`,
            description: `Solution ${issue.solutionName || issue.solutionId} detected for re-migration`,
            category: 'SolutionEmpty',
            status: 'pending',
            priority: 1,
            reason: 'SolutionEmpty issue detected',
            statusChangeReason: 'Added to remediation tracking',
            creationDate: now,
            lastUpdate: now,
            originatingSystem: 'BSS Magic Dashboard',
            affectedResource: [{
              '@type': 'ResourceRef',
              '@referredType': 'Product',
              id: issue.solutionId,
              name: issue.solutionName,
            }],
            externalIdentifier: [{
              id: issue.solutionId,
              externalIdentifierType: 'SolutionId',
              owner: 'CloudSense',
              '@type': 'ExternalIdentifier',
            }],
            characteristic: [
              { '@type': 'StringCharacteristic', name: 'solutionName', value: issue.solutionName || '' },
              { '@type': 'StringCharacteristic', name: 'solutionId', value: issue.solutionId },
              { '@type': 'StringCharacteristic', name: 'remediationState', value: 'DETECTED' },
            ],
          }),
        });
        console.log(`✅ Added ${issue.solutionId} to tracking`);
      } catch (e) {
        console.error(`Failed to add ${issue.solutionId} to tracking:`, e);
      }
    }
    
    setIsAddingToRemediation(false);
    setSelectedSolutions(new Set());
    refetch(); // Refresh data to show new ServiceProblem entries
  };
  
  // Add a solution manually by ID (without needing it in the detected issues list)
  const handleAddManualSolution = async () => {
    const trimmedId = manualSolutionId.trim();
    if (!trimmedId) return;
    
    // Check if already tracked
    const alreadyTracked = serviceProblems.some(sp => 
      sp.externalIdentifier?.some(e => e.id === trimmedId) ||
      sp.characteristic?.some(c => c.name === 'solutionId' && c.value === trimmedId)
    );
    
    if (alreadyTracked) {
      alert(`Solution ${trimmedId} is already in tracking.`);
      return;
    }
    
    setIsAddingManual(true);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const API_KEY = import.meta.env.VITE_BSSMAGIC_API_KEY || 'bssmagic-d58d6761265b01accc13e8b21bae8282';
    if (import.meta.env.PROD) headers['X-API-Key'] = API_KEY;
    
    const TMF_API_PATH = '/tmf-api/serviceProblemManagement/v5/serviceProblem';
    const spId = `sp-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    const now = new Date().toISOString();
    
    try {
      await fetch(TMF_API_PATH, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          '@type': 'ServiceProblem',
          '@baseType': 'Entity',
          id: spId,
          name: `SolutionEmpty - ${trimmedId} (Manual)`,
          description: `Solution ${trimmedId} manually added for re-migration`,
          category: 'SolutionEmpty',
          status: 'pending',
          priority: 1,
          reason: 'Manually added for remediation',
          statusChangeReason: 'Added manually via UI',
          creationDate: now,
          lastUpdate: now,
          originatingSystem: 'BSS Magic Dashboard',
          affectedResource: [{
            '@type': 'ResourceRef',
            '@referredType': 'Product',
            id: trimmedId,
            name: `Solution ${trimmedId}`,
          }],
          externalIdentifier: [{
            id: trimmedId,
            externalIdentifierType: 'SolutionId',
            owner: 'CloudSense',
            '@type': 'ExternalIdentifier',
          }],
          characteristic: [
            { '@type': 'StringCharacteristic', name: 'solutionName', value: `Solution ${trimmedId}` },
            { '@type': 'StringCharacteristic', name: 'solutionId', value: trimmedId },
            { '@type': 'StringCharacteristic', name: 'remediationState', value: 'DETECTED' },
            { '@type': 'StringCharacteristic', name: 'addedManually', value: 'true' },
          ],
        }),
      });
      console.log(`✅ Manually added ${trimmedId} to tracking`);
      setManualSolutionId(''); // Clear input on success
      refetch(); // Refresh data
    } catch (e) {
      console.error(`Failed to add ${trimmedId} to tracking:`, e);
      alert(`Failed to add solution: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setIsAddingManual(false);
    }
  };
  
  // Start remediation for a single ServiceProblem
  const handleStartRemediation = async (serviceProblemId: string, solutionId: string, solutionName?: string) => {
    const existingIssue = issues.find(i => i.solutionId === solutionId);
    
    // Always create issue with isFixable: true to let the API decide eligibility
    // The validate-remigration API call in processSolution will properly SKIP if not eligible
    const issue: SolutionEmptyIssue = {
      solutionId,
      solutionName: existingIssue?.solutionName || solutionName || null,
      sfEnvironment: existingIssue?.sfEnvironment || 'FDRV2 Sandbox',
      detectedAt: existingIssue?.detectedAt || new Date().toISOString(),
      useCase: '1147' as const,
      detectionSource: 'BSS Magic – Solution Validator' as const,
      // Override fixability to true - let the API validate eligibility
      fixability: { isFixable: true, reasonCode: 'ELIGIBLE' as const, reasonDescription: 'Attempting remediation' },
      remediation: existingIssue?.remediation || { lastAttempt: null, outcome: 'not_attempted' as const, failureStage: null, failureReason: null, jobId: null },
      // Include ServiceProblem ID so we can update its state
      serviceProblemId: serviceProblemId || undefined,
    };
    
    const config: BatchExecutionConfig = {
      batchSize: 10,
      executionMode: 'immediate',
    };
    
    await startBatch([issue], config);
    setShowExecutionReport(true);
    refetch();
  };
  
  const handleDeleteServiceProblem = async (id: string) => {
    try {
      await deleteServiceProblem(id);
      refetch();
    } catch (err) {
      console.error('Failed to delete service problem:', err);
    }
  };

  // Start batch remediation from remediation table
  const handleStartBatchRemediation = async () => {
    // Get issues that correspond to selected service problems
    const selectedIssues: SolutionEmptyIssue[] = [];
    for (const spId of selectedServiceProblems) {
      const sp = serviceProblems.find(s => s.id === spId);
      if (!sp) continue;
      
      const solutionId = sp.externalIdentifier?.find(e => e.externalIdentifierType === 'SolutionId')?.id
        || sp.characteristic?.find(c => c.name === 'solutionId')?.value as string | undefined;
      if (!solutionId) continue;
      
      const existingIssue = issues.find(i => i.solutionId === solutionId);
      
      // Always create issue with isFixable: true to let the API decide eligibility
      const issue: SolutionEmptyIssue = {
        solutionId,
        solutionName: existingIssue?.solutionName || sp.affectedResource?.[0]?.name || sp.characteristic?.find(c => c.name === 'solutionName')?.value as string || null,
        sfEnvironment: existingIssue?.sfEnvironment || 'FDRV2 Sandbox',
        detectedAt: existingIssue?.detectedAt || sp.creationDate || new Date().toISOString(),
        useCase: '1147' as const,
        detectionSource: 'BSS Magic – Solution Validator' as const,
        // Override fixability to true - let the API validate eligibility
        fixability: { isFixable: true, reasonCode: 'ELIGIBLE' as const, reasonDescription: 'Attempting remediation' },
        remediation: existingIssue?.remediation || { lastAttempt: null, outcome: 'not_attempted' as const, failureStage: null, failureReason: null, jobId: null },
        // Include ServiceProblem ID so we can update its state
        serviceProblemId: spId,
      };
      selectedIssues.push(issue);
    }
    
    if (selectedIssues.length === 0) return;
    
    const config: BatchExecutionConfig = {
      batchSize,
      executionMode: 'immediate',
    };
    
    await startBatch(selectedIssues, config);
    setShowExecutionReport(true);
    setSelectedServiceProblems(new Set());
    refetch();
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const toggleRow = (solutionId: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(solutionId)) {
        next.delete(solutionId);
      } else {
        next.add(solutionId);
      }
      return next;
    });
  };

  if (isLoading && !data) {
    return <LoadingState />;
  }

  if (isError) {
    return <ErrorState onRetry={handleRefresh} />;
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/50">
            <Package className="w-6 h-6 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Solution Remediation Validator
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Use Case 1147 • Detected by BSS Magic – Solution Validator
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Clock className="w-3.5 h-3.5" />
            <span>Updated {formatTimestamp(lastUpdated)}</span>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={cn(
              'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg',
              'text-sm font-medium',
              'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700',
              'text-slate-700 dark:text-slate-300',
              'transition-colors disabled:opacity-50'
            )}
          >
            <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Header - Matches Health Dashboard metrics */}
      {data?.summary && (
        <SummaryHeader summary={data.summary} />
      )}

      {/* Quick Stats Bar */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-sm">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <span className="text-amber-700 dark:text-amber-300">Detected: {issues.length}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-sm">
          <FileText className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          <span className="text-purple-700 dark:text-purple-300">In Tracking: {serviceProblems.length}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span className="text-emerald-700 dark:text-emerald-300">
            Resolved: {serviceProblems.filter(sp => sp.status === 'resolved').length}
          </span>
        </div>
      </div>

      {/* Add to Tracking Controls */}
      <div className="rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/20 p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/50">
              <Plus className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                Add to Remediation Tracking
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {selectedSolutions.size} solution{selectedSolutions.size !== 1 ? 's' : ''} selected
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Add Selected Button */}
            <button
              onClick={handleAddToRemediation}
              disabled={selectedSolutions.size === 0 || isAddingToRemediation}
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 transition-colors',
                selectedSolutions.size > 0 && !isAddingToRemediation
                  ? 'bg-purple-600 hover:bg-purple-700 text-white'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed dark:bg-slate-700 dark:text-slate-500'
              )}
            >
              {isAddingToRemediation ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Add to Tracking ({selectedSolutions.size})
            </button>

            {/* View Report Button */}
            {currentReport && (
              <button
                onClick={() => setShowExecutionReport(true)}
                className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm rounded-lg flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                <BarChart3 className="w-4 h-4" />
                Report
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Detection Results Table - Top table showing Salesforce query results */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-900">
        {/* Table Header */}
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Detection Results
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-medium">
                {detectionSearchTerm ? `${filteredIssues.length} of ${issues.length}` : `${issues.length}`} issues
              </span>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={detectionSearchTerm}
                onChange={(e) => setDetectionSearchTerm(e.target.value)}
                placeholder="Search solutions..."
                className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent w-48"
              />
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50/50 dark:bg-slate-800/30">
              <tr>
                {/* Select All Checkbox */}
                <th className="px-4 py-3 text-center w-10">
                  <button
                    onClick={handleSelectAll}
                    disabled={issues.length === 0}
                    className={cn(
                      'p-1 rounded transition-colors',
                      issues.length > 0 ? 'hover:bg-slate-200 dark:hover:bg-slate-700' : 'opacity-50 cursor-not-allowed'
                    )}
                    title={selectedSolutions.size === issues.length ? 'Deselect all' : 'Select all'}
                  >
                    {selectedSolutions.size === issues.length && issues.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    ) : (
                      <SquareIcon className="w-4 h-4 text-slate-400" />
                    )}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Solution
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Detected
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Tracking Status
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Action
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider w-10">
                  
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredIssues.map((issue, index) => (
                <SolutionRow
                  key={issue.solutionId}
                  issue={issue}
                  isExpanded={expandedRows.has(issue.solutionId)}
                  onToggle={() => toggleRow(issue.solutionId)}
                  delay={index * 0.05}
                  isTracked={trackedSolutionIds.has(issue.solutionId)}
                  isSelected={selectedSolutions.has(issue.solutionId)}
                  onToggleSelect={() => toggleSelection(issue.solutionId)}
                  onAddToTracking={async () => {
                    setSelectedSolutions(new Set([issue.solutionId]));
                    await handleAddToRemediation();
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>

        {/* Empty State */}
        {filteredIssues.length === 0 && (
          <div className="py-12 text-center">
            {detectionSearchTerm ? (
              <>
                <Search className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  No Matching Results
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  No solutions match "{detectionSearchTerm}"
                </p>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  No Active Issues
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  All Solution Remediation issues have been resolved.
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Service Problems Table - Bottom table showing BSS Magic internal tracking */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-900">
        <button
          onClick={() => setIsServiceProblemsCollapsed(!isServiceProblemsCollapsed)}
          className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Remediation Tracking
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-medium">
                {serviceProblems.length} tracked
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">
                Solutions in remediation workflow
              </span>
            </div>
            {isServiceProblemsCollapsed ? (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            )}
          </div>
        </button>

        <AnimatePresence>
          {!isServiceProblemsCollapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {/* Manual Solution Input */}
              <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/30 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <Plus className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span className="font-medium">Add manually:</span>
                  </div>
                  <input
                    type="text"
                    value={manualSolutionId}
                    onChange={(e) => setManualSolutionId(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddManualSolution()}
                    placeholder="Enter Solution ID (e.g., a246D000000pXakQAE)"
                    className="flex-1 max-w-md px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    disabled={isAddingManual}
                  />
                  <button
                    onClick={handleAddManualSolution}
                    disabled={!manualSolutionId.trim() || isAddingManual}
                    className={cn(
                      'px-3 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors',
                      manualSolutionId.trim() && !isAddingManual
                        ? 'bg-purple-600 hover:bg-purple-700 text-white'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                    )}
                  >
                    {isAddingManual ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <Plus className="w-3 h-3" />
                        Add to Tracking
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Search Tracking Table */}
              <div className="px-4 py-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={trackingSearchTerm}
                    onChange={(e) => setTrackingSearchTerm(e.target.value)}
                    placeholder="Search tracked solutions..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                {trackingSearchTerm && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Showing {filteredServiceProblems.length} of {serviceProblems.length} tracked solutions
                  </p>
                )}
              </div>

              {/* Batch Scheduling & Controls */}
              <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/30 border-b border-slate-200 dark:border-slate-700">
                <BatchScheduler
                  category="SolutionEmpty"
                  useCase="1147"
                  onImmediateStart={({ batchSize: size }) => {
                    setBatchSize(size as 10 | 50 | 100 | 500);
                    const pendingSPs = serviceProblems.filter(sp => sp.status === 'pending');
                    setSelectedServiceProblems(new Set(pendingSPs.map(sp => sp.id || '')));
                    handleStartBatchRemediation();
                  }}
                />
                
                {/* Progress Bar (when running) */}
                {isBatchRunning && (
                  <div className="mt-4 p-3 bg-violet-50 dark:bg-violet-950/20 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-violet-700 dark:text-violet-300">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Batch In Progress</span>
                      </div>
                      <button
                        onClick={cancelBatch}
                        className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded flex items-center gap-1"
                      >
                        <Square className="w-3 h-3" />
                        Cancel
                      </button>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                      <span>Processing: {currentSolution || '...'}</span>
                      <span>{batchProgress}%</span>
                    </div>
                    <div className="h-2 bg-violet-200 dark:bg-violet-900/30 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-violet-600"
                        initial={{ width: 0 }}
                        animate={{ width: `${batchProgress}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                    {currentState && (
                      <div className="mt-1 text-xs text-violet-600 dark:text-violet-400">
                        State: {STATE_DESCRIPTIONS[currentState]}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Pending Solutions Count */}
                {!isBatchRunning && serviceProblems.filter(sp => sp.status === 'pending').length > 0 && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <Play className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                    <span>
                      {serviceProblems.filter(sp => sp.status === 'pending').length} solution(s) ready for remediation
                    </span>
                  </div>
                )}
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 dark:bg-slate-800/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                        Solution
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                        Failure Info
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                        Detected
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                        Fixed
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredServiceProblems.map((sp, index) => (
                      <ServiceProblemRow 
                        key={sp.id || index} 
                        problem={sp} 
                        delay={index * 0.05}
                        onStartRemediation={handleStartRemediation}
                        onDelete={handleDeleteServiceProblem}
                        isProcessing={isBatchRunning && currentSolution === (
                          sp.externalIdentifier?.find(e => e.externalIdentifierType === 'SolutionId')?.id
                          || sp.characteristic?.find(c => c.name === 'solutionId')?.value as string
                        )}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Empty State */}
              {filteredServiceProblems.length === 0 && (
                <div className="py-12 text-center">
                  {trackingSearchTerm ? (
                    <>
                      <Search className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                        No Matching Results
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        No tracked solutions match "{trackingSearchTerm}"
                      </p>
                    </>
                  ) : (
                    <>
                      <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                        No Solutions in Tracking
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Click "Add to Tracking" on detected solutions above to start.
                      </p>
                    </>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-slate-400 dark:text-slate-500">
        Showing {issues.length} detected issues, {serviceProblems.length} in remediation tracking •
        Last updated: {formatTimestamp(lastUpdated)}
      </div>

      {/* Execution Report Modal */}
      {showExecutionReport && currentReport && (
        <ExecutionReportModal
          report={currentReport}
          onClose={() => setShowExecutionReport(false)}
        />
      )}

    </div>
  );
}

// Execution Report Modal Component
function ExecutionReportModal({ report, onClose }: { report: ExecutionReport; onClose: () => void }) {
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const statusColors = {
    SUCCESS: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    FAILED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    SKIPPED: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-4xl w-full max-h-[85vh] overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Execution Report
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                {report.executionId}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn(
                'px-2 py-1 rounded-full text-xs font-medium',
                report.status === 'completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                report.status === 'running' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              )}>
                {report.status.toUpperCase()}
              </span>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Summary */}
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400 uppercase">Total</div>
                <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{report.summary.total}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400 uppercase">Successful</div>
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{report.summary.successful}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400 uppercase">Failed</div>
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">{report.summary.failed}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400 uppercase">Skipped</div>
                <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{report.summary.skipped}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400 uppercase">Duration</div>
                <div className="text-lg font-medium text-slate-700 dark:text-slate-300">
                  {report.endTime ? `${Math.round((new Date(report.endTime).getTime() - new Date(report.startTime).getTime()) / 1000)}s` : '—'}
                </div>
              </div>
            </div>
            <div className="mt-3 flex gap-6 text-xs text-slate-500 dark:text-slate-400">
              <div>Started: {formatDate(report.startTime)}</div>
              <div>Ended: {formatDate(report.endTime)}</div>
              <div>Batch Size: {report.batchSizeRequested}</div>
            </div>
          </div>

          {/* Results Table */}
          <div className="overflow-y-auto max-h-[50vh]">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800/50 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase">Solution</th>
                  <th className="px-4 py-2 text-center text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase">Status</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase">Final State</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase">Failure</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {report.results.map((result, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900 dark:text-slate-100 text-sm">
                        {result.solutionName || 'Unknown'}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                        {result.solutionId}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn(
                        'inline-block px-2 py-0.5 rounded-full text-xs font-medium',
                        statusColors[result.status]
                      )}>
                        {result.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono text-slate-600 dark:text-slate-400">
                        {result.currentState}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {result.failureReason ? (
                        <div className="text-xs text-red-600 dark:text-red-400 max-w-xs truncate" title={result.failureReason}>
                          <span className="font-medium">{result.failureStage}:</span> {result.failureReason}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex justify-between">
            <button
              onClick={() => {
                const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `execution-report-${report.executionId}.json`;
                a.click();
              }}
              className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg flex items-center gap-2 transition-colors"
            >
              <Download className="w-4 h-4" />
              Download JSON
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-sm transition-colors"
            >
              Close
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// Summary Header Component - Time-aligned grouping (detected/resolved/total per period)
interface SummaryHeaderProps {
  summary: SolutionEmptySummary;
}

function SummaryHeader({ summary }: SummaryHeaderProps) {
  // Calculate totals for each time period
  const total24h = summary.detected24h + summary.resolved24h;
  const total7d = summary.detected7d + summary.resolved7d;
  const total30d = summary.detected30d + summary.resolved30d;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-4"
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Active Issues - Featured */}
        <div className="p-3 rounded-lg bg-white dark:bg-slate-900/50">
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Currently Active</div>
          <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">
            {summary.activeCount}
          </div>
        </div>

        {/* 24 Hours - Time-aligned grouping */}
        <div className="p-3 rounded-lg bg-white dark:bg-slate-900/50">
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Last 24 Hours</div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-semibold text-slate-900 dark:text-slate-100">{summary.detected24h}</span>
            <span className="text-slate-400 dark:text-slate-500">/</span>
            <span className="text-xl font-semibold text-emerald-600 dark:text-emerald-400">{summary.resolved24h}</span>
            <span className="text-slate-400 dark:text-slate-500">/</span>
            <span className="text-lg font-medium text-slate-500 dark:text-slate-400">{total24h}</span>
          </div>
          <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
            detected / resolved / total
          </div>
        </div>

        {/* 7 Days - Time-aligned grouping */}
        <div className="p-3 rounded-lg bg-white dark:bg-slate-900/50">
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Last 7 Days</div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-semibold text-slate-900 dark:text-slate-100">{summary.detected7d}</span>
            <span className="text-slate-400 dark:text-slate-500">/</span>
            <span className="text-xl font-semibold text-emerald-600 dark:text-emerald-400">{summary.resolved7d}</span>
            <span className="text-slate-400 dark:text-slate-500">/</span>
            <span className="text-lg font-medium text-slate-500 dark:text-slate-400">{total7d}</span>
          </div>
          <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
            detected / resolved / total
          </div>
        </div>

        {/* 30 Days - Time-aligned grouping */}
        <div className="p-3 rounded-lg bg-white dark:bg-slate-900/50">
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Last 30 Days</div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-semibold text-slate-900 dark:text-slate-100">{summary.detected30d}</span>
            <span className="text-slate-400 dark:text-slate-500">/</span>
            <span className="text-xl font-semibold text-emerald-600 dark:text-emerald-400">{summary.resolved30d}</span>
            <span className="text-slate-400 dark:text-slate-500">/</span>
            <span className="text-lg font-medium text-slate-500 dark:text-slate-400">{total30d}</span>
          </div>
          <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
            detected / resolved / total
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// Solution Row Component (Detection Table)
interface SolutionRowProps {
  issue: SolutionEmptyIssue;
  isExpanded: boolean;
  onToggle: () => void;
  delay?: number;
  isTracked: boolean;  // Whether solution is already in tracking table
  isSelected?: boolean;
  onToggleSelect?: () => void;
  onAddToTracking?: () => void;
}

function SolutionRow({ 
  issue, 
  isExpanded, 
  onToggle, 
  delay = 0, 
  isTracked,
  isSelected = false,
  onToggleSelect,
  onAddToTracking,
}: SolutionRowProps) {
  return (
    <>
      <motion.tr
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay }}
        className={cn(
          'hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors',
          isExpanded && 'bg-slate-50 dark:bg-slate-800/50',
          isTracked && 'bg-purple-50/50 dark:bg-purple-900/10'
        )}
      >
        {/* Selection Checkbox */}
        <td className="px-4 py-3 text-center">
          <button
            onClick={(e) => { e.stopPropagation(); onToggleSelect?.(); }}
            disabled={isTracked}
            className={cn(
              'p-1 rounded transition-colors',
              !isTracked
                ? 'hover:bg-slate-200 dark:hover:bg-slate-700'
                : 'opacity-50 cursor-not-allowed'
            )}
            title={isTracked ? 'Already in tracking' : 'Select for tracking'}
          >
            {isSelected ? (
              <CheckSquare className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            ) : (
              <SquareIcon className={cn(
                'w-4 h-4',
                !isTracked ? 'text-slate-400' : 'text-slate-300 dark:text-slate-600'
              )} />
            )}
          </button>
        </td>
        
        {/* Solution */}
        <td className="px-4 py-3 cursor-pointer" onClick={onToggle}>
          <div className="flex items-start gap-2">
            <div className="min-w-0">
              <div className="font-medium text-slate-900 dark:text-slate-100 truncate max-w-xs">
                {issue.solutionName || 'Unnamed Solution'}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                {issue.solutionId}
              </div>
            </div>
          </div>
        </td>

        {/* Detected */}
        <td className="px-4 py-3 cursor-pointer" onClick={onToggle}>
          <div className="text-sm text-slate-700 dark:text-slate-300">
            {formatRelativeTime(issue.detectedAt)}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {issue.sfEnvironment}
          </div>
        </td>

        {/* Tracking Status */}
        <td className="px-4 py-3 text-center cursor-pointer" onClick={onToggle}>
          {isTracked ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
              <FileText className="w-3 h-3" />
              In Tracking
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              <AlertTriangle className="w-3 h-3" />
              Not Tracked
            </span>
          )}
        </td>

        {/* Action */}
        <td className="px-4 py-3 text-center">
          {isTracked ? (
            <span className="text-xs text-slate-400 dark:text-slate-500">
              View in tracking table ↓
            </span>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); onAddToTracking?.(); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors bg-purple-600 text-white hover:bg-purple-700"
              title="Add to remediation tracking"
            >
              <Plus className="w-3 h-3" />
              Add to Tracking
            </button>
          )}
        </td>

        {/* Expand */}
        <td className="px-4 py-3 text-center cursor-pointer" onClick={onToggle}>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </td>
      </motion.tr>

      {/* Expanded Details */}
      {isExpanded && (
        <tr>
          <td colSpan={6} className="px-4 py-0">
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="pb-4"
            >
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4 mt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Identification */}
                  <div>
                    <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                      Identification
                    </h4>
                    <dl className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <dt className="text-slate-500 dark:text-slate-400">Solution ID</dt>
                        <dd className="font-mono text-slate-900 dark:text-slate-100">{issue.solutionId}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-500 dark:text-slate-400">Environment</dt>
                        <dd className="text-slate-900 dark:text-slate-100">{issue.sfEnvironment}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-500 dark:text-slate-400">Detected</dt>
                        <dd className="text-slate-900 dark:text-slate-100">{formatDateTime(issue.detectedAt)}</dd>
                      </div>
                    </dl>
                  </div>

                  {/* Detection Context */}
                  <div>
                    <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                      Detection Context
                    </h4>
                    <dl className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <dt className="text-slate-500 dark:text-slate-400">Use Case</dt>
                        <dd className="text-slate-900 dark:text-slate-100">{issue.useCase} – Solution Remediation</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-500 dark:text-slate-400">Detection Source</dt>
                        <dd className="text-slate-900 dark:text-slate-100">{issue.detectionSource}</dd>
                      </div>
                      <div className="flex justify-between items-center">
                        <dt className="text-slate-500 dark:text-slate-400">Tracking Status</dt>
                        <dd>
                          {isTracked ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                              <FileText className="w-3 h-3" />
                              In Tracking
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                              <AlertTriangle className="w-3 h-3" />
                              Not Tracked
                            </span>
                          )}
                        </dd>
                      </div>
                    </dl>
                    {!isTracked && (
                      <div className="mt-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); onAddToTracking?.(); }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors bg-purple-600 text-white hover:bg-purple-700"
                        >
                          <Plus className="w-3 h-3" />
                          Add to Remediation Tracking
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </td>
        </tr>
      )}
    </>
  );
}

// Service Problem Row Component (Remediation Tracking Table)
interface ServiceProblemRowProps {
  problem: ServiceProblem;
  delay?: number;
  onStartRemediation?: (serviceProblemId: string, solutionId: string, solutionName?: string) => void;
  onDelete?: (id: string) => void;
  isProcessing?: boolean;
}

function ServiceProblemRow({ problem, delay = 0, onStartRemediation, onDelete, isProcessing = false }: ServiceProblemRowProps) {
  const [showTimeline, setShowTimeline] = useState(false);
  const affectedResource = problem.affectedResource?.[0];
  const characteristics = problem.characteristic || [];
  const externalIds = problem.externalIdentifier || [];
  
  const timelineSteps = useMemo(() => {
    const raw = characteristics.find(c => c.name === 'remediationTimeline')?.value;
    if (!raw || typeof raw !== 'string') return null;
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed as Array<{action: string; success: boolean; duration_ms: number; message: string; job_id?: string; status?: string; started_at?: string}> : null;
    } catch { return null; }
  }, [characteristics]);
  
  // Extract remediationState from characteristic
  const remediationState = characteristics.find(c => c.name === 'remediationState')?.value as RemediationState | undefined || 'DETECTED';
  
  // Extract failure info
  const failureStage = characteristics.find(c => c.name === 'failureStage')?.value as string | undefined;
  const failureMessage = characteristics.find(c => c.name === 'failureMessage')?.value as string | undefined;
  
  // Extract Solution ID from externalIdentifier
  const solutionIdFromExt = externalIds.find(e => e.externalIdentifierType === 'SolutionId')?.id;
  
  // Fallback to characteristic, externalIdentifier, name, or description if affectedResource is missing
  const getSolutionInfo = () => {
    if (affectedResource?.name) {
      return { name: affectedResource.name, id: affectedResource.id, type: affectedResource['@referredType'] };
    }
    
    // Try to get solution name from various sources
    let solutionName = characteristics.find(c => c.name === 'solutionName')?.value as string | undefined;
    
    // Parse from problem.name field (format: "SolutionEmpty - Mobile Solution - MIG")
    if (!solutionName && problem.name) {
      const nameMatch = problem.name.match(/^[^-]+ - (.+)$/);
      solutionName = nameMatch?.[1] || problem.name;
    }
    
    // Try to get solution ID from externalIdentifier or characteristic
    const solutionId = solutionIdFromExt 
      || characteristics.find(c => c.name === 'solutionId')?.value as string | undefined;
    
    // Extract Salesforce-style solution ID from description (e.g., "...for solution a246D000000pYfbQAE")
    // Salesforce IDs: 15 or 18 chars, start with 'a' followed by alphanumeric
    const sfIdMatch = problem.description?.match(/\b(a[0-9A-Za-z]{14,17})\b/);
    const extractedId = solutionId || sfIdMatch?.[1];
    
    if (solutionName || extractedId) {
      return { name: solutionName || null, id: extractedId || null, type: 'Product' };
    }
    
    return { name: null, id: null, type: null };
  };
  
  const solutionInfo = getSolutionInfo();
  
  // Format date helper
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('en-US', { 
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
      });
    } catch {
      return dateStr;
    }
  };
  
  const statusColors: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    inProgress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    resolved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };

  const priorityColors: Record<number, string> = {
    1: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    2: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    3: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    4: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
    5: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-500',
  };

  // State colors based on LLD states
  const stateColors: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    DETECTED: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', icon: <Clock className="w-3 h-3" /> },
    VALIDATED: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', icon: <CheckCircle2 className="w-3 h-3" /> },
    DELETED: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', icon: <Trash2 className="w-3 h-3" /> },
    MIGRATION_STARTED: { bg: 'bg-violet-100 dark:bg-violet-900/30', text: 'text-violet-700 dark:text-violet-400', icon: <Loader2 className="w-3 h-3 animate-spin" /> },
    MIGRATION_CONFIRMED: { bg: 'bg-violet-100 dark:bg-violet-900/30', text: 'text-violet-700 dark:text-violet-400', icon: <CheckCircle2 className="w-3 h-3" /> },
    POST_UPDATED: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', icon: <CheckCircle2 className="w-3 h-3" /> },
    SKIPPED: { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-400', icon: <XCircle className="w-3 h-3" /> },
    FAILED: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', icon: <XCircle className="w-3 h-3" /> },
  };
  
  const stateStyle = stateColors[remediationState] || stateColors.DETECTED;

  const TIMELINE_STEP_ICONS: Record<string, string> = {
    VALIDATE: '1', DELETE: '2', MIGRATE: '3', POLL: '4', POST_UPDATE: '5',
  };

  return (
    <Fragment>
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay }}
      onClick={timelineSteps ? () => setShowTimeline(!showTimeline) : undefined}
      className={cn(
        'hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors',
        isProcessing && 'bg-violet-50 dark:bg-violet-900/20 ring-1 ring-violet-300 dark:ring-violet-700',
        timelineSteps && 'cursor-pointer'
      )}
    >
      {/* Solution */}
      <td className="px-4 py-3">
        <div className="min-w-0">
          <div className="font-medium text-slate-900 dark:text-slate-100 truncate max-w-xs">
            {solutionInfo.name || 'Unknown Solution'}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              {solutionInfo.id || '—'}
            </span>
            {timelineSteps && (
              <span className="text-[10px] text-violet-500 dark:text-violet-400 whitespace-nowrap">
                {showTimeline ? '▲' : '▼'} {timelineSteps.length} steps
              </span>
            )}
          </div>
        </div>
      </td>

      {/* Status */}
      <td className="px-4 py-3 text-center">
        <span className={cn(
          'inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize',
          statusColors[problem.status] || statusColors.pending
        )}>
          {problem.status}
        </span>
      </td>

      {/* Failure Info */}
      <td className="px-4 py-3">
        {(remediationState === 'FAILED' || remediationState === 'SKIPPED') && (failureStage || failureMessage || problem.statusChangeReason) ? (
          <div className="text-xs">
            {failureStage && (
              <span className="font-medium text-red-600 dark:text-red-400">{failureStage}: </span>
            )}
            <span className="text-slate-600 dark:text-slate-400">
              {failureMessage || problem.statusChangeReason || 'Unknown error'}
            </span>
          </div>
        ) : (
          <span className="text-slate-400 text-xs">—</span>
        )}
      </td>

      {/* Detected */}
      <td className="px-4 py-3">
        {problem.creationDate ? (
          <div className="text-xs text-slate-600 dark:text-slate-400">
            {formatDate(problem.creationDate)}
          </div>
        ) : (
          <span className="text-slate-400 text-xs">{'\u2014'}</span>
        )}
      </td>

      {/* Fixed */}
      <td className="px-4 py-3">
        {(problem.status === 'resolved' || remediationState === 'POST_UPDATED') ? (
          <div className="text-xs text-emerald-600 dark:text-emerald-400">
            {formatDate(problem.resolutionDate || problem.lastUpdate || problem.statusChangeDate || '')}
          </div>
        ) : (
          <span className="text-slate-400 text-xs">{'\u2014'}</span>
        )}
      </td>

      {/* Action */}
      <td className="px-4 py-3 text-center">
        <div className="flex items-center justify-center gap-1">
          {isProcessing ? (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
              <Loader2 className="w-3 h-3 animate-spin" />
              Processing...
            </span>
          ) : remediationState === 'DETECTED' || problem.status === 'pending' ? (
            <button
              onClick={() => onStartRemediation?.(problem.id || '', solutionInfo.id || '', solutionInfo.name || undefined)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-violet-600 text-white hover:bg-violet-700 transition-colors"
            >
              <Play className="w-3 h-3" />
              Start
            </button>
          ) : remediationState === 'POST_UPDATED' || problem.status === 'resolved' ? (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              <CheckCircle2 className="w-3 h-3" />
              Done
            </span>
          ) : remediationState === 'FAILED' || problem.status === 'rejected' ? (
            <button
              onClick={() => onStartRemediation?.(problem.id || '', solutionInfo.id || '', solutionInfo.name || undefined)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Retry
            </button>
          ) : remediationState === 'SKIPPED' ? (
            <span className="text-xs text-slate-400">Skipped</span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
              <Loader2 className="w-3 h-3 animate-spin" />
              In Progress
            </span>
          )}
          {onDelete && problem.id && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Delete service problem #${problem.id}?`)) {
                  onDelete(problem.id!);
                }
              }}
              className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </td>
    </motion.tr>
    {showTimeline && timelineSteps && (
      <tr className="bg-slate-50 dark:bg-slate-800/50">
        <td colSpan={6} className="px-4 py-3">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Remediation Steps</span>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              ({(timelineSteps.reduce((s, st) => s + st.duration_ms, 0) / 1000).toFixed(1)}s total)
            </span>
          </div>
          <div className="flex items-center gap-0.5">
            {timelineSteps.map((step, idx) => (
              <Fragment key={idx}>
                <div className="group relative flex flex-col items-center" title={`${step.action}: ${step.message} (${(step.duration_ms / 1000).toFixed(1)}s)`}>
                  <div className={cn(
                    'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2',
                    step.success
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-600 dark:text-emerald-300'
                      : 'bg-red-500/20 border-red-500/50 text-red-600 dark:text-red-300'
                  )}>
                    {TIMELINE_STEP_ICONS[step.action] || '?'}
                  </div>
                  <span className="text-[9px] text-slate-500 dark:text-slate-400 mt-0.5 whitespace-nowrap">{step.action}</span>
                  <span className="text-[9px] text-slate-400 dark:text-slate-500">{(step.duration_ms / 1000).toFixed(1)}s</span>
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block z-10">
                    <div className="bg-gray-900 dark:bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-xs shadow-xl max-w-[200px]">
                      <div className="font-medium text-gray-200 mb-1">{step.action}</div>
                      <div className={step.success ? 'text-emerald-400' : 'text-red-400'}>
                        {step.success ? 'Success' : 'Failed'}
                      </div>
                      <div className="text-gray-400 mt-1 break-words">{step.message}</div>
                      {step.started_at && <div className="text-gray-500 mt-1 text-[10px]">{new Date(step.started_at).toLocaleString()}</div>}
                      {step.job_id && <div className="text-violet-400 mt-1 font-mono text-[10px]">Job: {step.job_id}</div>}
                    </div>
                  </div>
                </div>
                {idx < timelineSteps.length - 1 && (
                  <div className={cn(
                    'flex-1 h-0.5 min-w-[12px] mt-[-14px]',
                    step.success ? 'bg-emerald-500/30' : 'bg-red-500/30'
                  )} />
                )}
              </Fragment>
            ))}
          </div>
        </td>
      </tr>
    )}
    </Fragment>
  );
}

// Fixability Badge
function FixabilityBadge({ isFixable }: { isFixable: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
        isFixable
          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
      )}
    >
      {isFixable ? (
        <>
          <CheckCircle2 className="w-3 h-3" />
          Yes
        </>
      ) : (
        <>
          <XCircle className="w-3 h-3" />
          No
        </>
      )}
    </span>
  );
}

// Remediation Badge
function RemediationBadge({ outcome }: { outcome: RemediationOutcome }) {
  const config: Record<RemediationOutcome, { label: string; className: string; icon?: React.ReactNode }> = {
    not_attempted: {
      label: 'Not Attempted',
      className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    },
    successful: {
      label: 'Successful',
      className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
      icon: <CheckCircle2 className="w-3 h-3" />,
    },
    failed: {
      label: 'Failed',
      className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      icon: <XCircle className="w-3 h-3" />,
    },
    skipped: {
      label: 'Skipped',
      className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      icon: <AlertTriangle className="w-3 h-3" />,
    },
  };

  const { label, className, icon } = config[outcome];

  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', className)}>
      {icon}
      {label}
    </span>
  );
}

// Loading State
function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <RefreshCw className="w-8 h-8 text-slate-400 animate-spin mb-4" />
      <p className="text-slate-500 dark:text-slate-400">Loading Solution Remediation data...</p>
    </div>
  );
}

// Error State
function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <AlertTriangle className="w-8 h-8 text-red-500 mb-4" />
      <p className="text-slate-900 dark:text-slate-100 font-medium mb-2">
        Failed to load data
      </p>
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg font-medium"
      >
        Retry
      </button>
    </div>
  );
}

// Helper Functions
function formatTimestamp(timestamp?: string): string {
  if (!timestamp) return 'Unknown';
  try {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Unknown';
  }
}

function formatDateTime(timestamp: string): string {
  try {
    return new Date(timestamp).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return timestamp;
  }
}

function formatRelativeTime(timestamp: string): string {
  try {
    const now = new Date();
    const date = new Date(timestamp);
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  } catch {
    return timestamp;
  }
}
