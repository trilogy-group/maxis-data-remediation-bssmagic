/**
 * useBatchRemediation Hook
 * 
 * Handles controlled batch re-migration for Solution Empty (1147).
 * Delegates each solution's 5-step remediation to the Batch Orchestrator's
 * unified endpoint: POST /api/orchestrator/remediate/{solutionId}
 * 
 * Flow:
 * 1. For each solution, call the unified remediation API
 * 2. The server handles: VALIDATE → DELETE → MIGRATE → POLL → POST_UPDATE
 * 3. Frontend manages ServiceProblem state and generates execution report
 *
 * Architecture:
 *   Frontend → CloudFront → ALB:8082 → Batch Orchestrator → RemediationEngine
 *           → TMFClient → ALB:8000 → TMF Runtime → REST FDW → Salesforce
 */

import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { remediateSolution } from '@/services/salesforce/client';
import type {
  BatchExecutionConfig,
  ExecutionReport,
  BatchSolutionResult,
  RemediationState,
  StateTransition,
  SolutionEmptyIssue,
} from '../types/solution-empty';

// Configuration
const API_KEY = import.meta.env.VITE_BSSMAGIC_API_KEY || 'bssmagic-d58d6761265b01accc13e8b21bae8282';

// SP management path for fallback PATCH calls (when server doesn't update SP)
const TMF_API_PATH = '/tmf-api/serviceProblemManagement/v5/serviceProblem';

// Generate unique IDs
function generateExecutionId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `exec-${timestamp}-${random}`;
}

function generateServiceProblemId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  return `sp-${timestamp}-${random}`;
}

// State descriptions for UI (LLD-aligned)
export const STATE_DESCRIPTIONS: Record<RemediationState, string> = {
  DETECTED: 'Awaiting remediation start',
  VALIDATED: 'Eligibility confirmed',
  DELETED: 'SM artifacts deleted',
  MIGRATION_STARTED: 'Migration in progress...',
  MIGRATION_CONFIRMED: 'Migration confirmed',
  POST_UPDATED: 'Completed successfully',
  SKIPPED: 'Not eligible (MACD restriction)',
  FAILED: 'Failed - manual review required',
};

// State progress percentage for progress bar (LLD-aligned)
export const STATE_PROGRESS: Record<RemediationState, number> = {
  DETECTED: 0,
  VALIDATED: 20,
  DELETED: 40,
  MIGRATION_STARTED: 60,
  MIGRATION_CONFIRMED: 80,
  POST_UPDATED: 100,
  SKIPPED: 100,
  FAILED: 100,
};

interface UseBatchRemediationReturn {
  /** Start batch remediation */
  startBatch: (solutions: SolutionEmptyIssue[], config: BatchExecutionConfig) => Promise<ExecutionReport>;
  /** Current execution report (live updates) */
  currentReport: ExecutionReport | null;
  /** Is batch running */
  isRunning: boolean;
  /** Progress (0-100) */
  progress: number;
  /** Current solution being processed */
  currentSolution: string | null;
  /** Current state of current solution */
  currentState: RemediationState | null;
  /** Cancel batch (best effort) */
  cancelBatch: () => void;
}

export function useBatchRemediation(): UseBatchRemediationReturn {
  const queryClient = useQueryClient();
  const [currentReport, setCurrentReport] = useState<ExecutionReport | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentSolution, setCurrentSolution] = useState<string | null>(null);
  const [currentState, setCurrentState] = useState<RemediationState | null>(null);
  const [cancelled, setCancelled] = useState(false);

  // Helper to create state transition
  const createTransition = (from: RemediationState, to: RemediationState, reason?: string): StateTransition => ({
    fromState: from,
    toState: to,
    timestamp: new Date().toISOString(),
    reason,
  });

  // Map unified API step actions to UI remediation states
  const stepToState: Record<string, RemediationState> = {
    VALIDATE: 'VALIDATED',
    DELETE: 'DELETED',
    MIGRATE: 'MIGRATION_STARTED',
    POLL: 'MIGRATION_CONFIRMED',
    POST_UPDATE: 'POST_UPDATED',
  };

  // Process a single solution via the unified remediation API
  // Server-side: VALIDATE → DELETE → MIGRATE → POLL → POST_UPDATE
  const processSolution = useCallback(async (
    solution: SolutionEmptyIssue,
    headers: Record<string, string>,
    serviceProblemId?: string
  ): Promise<BatchSolutionResult> => {
    const startTime = new Date().toISOString();
    const stateHistory: StateTransition[] = [];
    let currentState: RemediationState = 'DETECTED';
    const spId = serviceProblemId || generateServiceProblemId();

    const pushTransition = (newState: RemediationState, reason?: string) => {
      stateHistory.push(createTransition(currentState, newState, reason));
      currentState = newState;
      setCurrentState(newState);
    };

    try {
      console.log(`[batch] Calling unified remediation for ${solution.solutionId}`);
      pushTransition('VALIDATED', 'Calling unified remediation API');

      const response = await remediateSolution(solution.solutionId, {
        service_problem_id: spId,
      });

      // Map each server step to a UI state transition
      for (const step of response.steps) {
        const uiState = stepToState[step.action];
        if (uiState) {
          pushTransition(uiState, step.message);
        }
      }

      // Handle SKIPPED (failed at VALIDATE with skip reason)
      if (response.failed_at === 'VALIDATE' && response.message?.includes('MACD')) {
        return {
          solutionId: solution.solutionId,
          solutionName: solution.solutionName,
          status: 'SKIPPED',
          currentState: 'SKIPPED',
          failureStage: 'validate',
          failureReason: response.message,
          stateHistory,
          startTime,
          endTime: new Date().toISOString(),
        };
      }

      if (!response.success) {
        pushTransition('FAILED', response.message);

        // Update SP to rejected if the server didn't already do it
        if (!response.service_problem_updated) {
          try {
            await fetch(`${TMF_API_PATH}/${spId}`, {
              method: 'PATCH',
              headers,
              body: JSON.stringify({
                status: 'rejected',
                statusChangeReason: response.message?.replace(/'/g, '') || 'Remediation failed',
              }),
            });
          } catch { /* non-fatal */ }
        }

        return {
          solutionId: solution.solutionId,
          solutionName: solution.solutionName,
          status: 'FAILED',
          currentState: 'FAILED',
          failureStage: response.failed_at?.toLowerCase() || 'unknown',
          failureReason: response.message,
          stateHistory,
          startTime,
          endTime: new Date().toISOString(),
        };
      }

      // Success -- extract jobIds from steps
      const jobIds: { action: string; jobId: string }[] = [];
      for (const step of response.steps) {
        if (step.job_id) {
          jobIds.push({ action: step.action, jobId: step.job_id });
        }
      }

      // Update SP to resolved if the server didn't already do it
      if (!response.service_problem_updated) {
        try {
          await fetch(`${TMF_API_PATH}/${spId}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({
              status: 'resolved',
              statusChangeReason: 'Remediation completed successfully',
              resolutionDate: new Date().toISOString(),
              characteristic: [
                { '@type': 'StringCharacteristic', name: 'remediationState', value: 'POST_UPDATED' },
                { '@type': 'StringCharacteristic', name: 'totalDurationMs', value: String(response.total_duration_ms) },
              ],
            }),
          });
        } catch { /* non-fatal */ }
      }

      return {
        solutionId: solution.solutionId,
        solutionName: solution.solutionName,
        status: 'SUCCESS',
        currentState: 'POST_UPDATED',
        jobIds,
        stateHistory,
        startTime,
        endTime: new Date().toISOString(),
      };
    } catch (e) {
      pushTransition('FAILED', String(e));
      return {
        solutionId: solution.solutionId,
        solutionName: solution.solutionName,
        status: 'FAILED',
        currentState: 'FAILED',
        failureStage: 'api_call',
        failureReason: String(e),
        stateHistory,
        startTime,
        endTime: new Date().toISOString(),
      };
    }
  }, []);

  // Start batch remediation
  const startBatch = useCallback(async (
    solutions: SolutionEmptyIssue[],
    config: BatchExecutionConfig
  ): Promise<ExecutionReport> => {
    setCancelled(false);
    setIsRunning(true);
    setProgress(0);

    const executionId = generateExecutionId();
    const startTime = new Date().toISOString();
    const isProduction = import.meta.env.PROD;

    // Headers for API calls
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (isProduction) {
      headers['X-API-Key'] = API_KEY;
    }

    // Filter to only fixable solutions and limit to batch size
    const eligibleSolutions = solutions
      .filter(s => s.fixability.isFixable)
      .slice(0, config.batchSize);

    // Initialize report
    const report: ExecutionReport = {
      executionId,
      triggeredBy: 'user',
      startTime,
      batchSizeRequested: config.batchSize,
      batchSizeProcessed: 0,
      summary: {
        total: eligibleSolutions.length,
        successful: 0,
        failed: 0,
        skipped: 0,
      },
      results: [],
      status: 'running',
    };

    setCurrentReport(report);

    console.group('%c🚀 Batch Remediation Started', 'color: #6366f1; font-weight: bold; font-size: 14px');
    console.log('%cExecution ID:', 'color: #059669; font-weight: bold', executionId);
    console.log('%cBatch Size:', 'color: #dc2626; font-weight: bold', eligibleSolutions.length);
    console.log('%cSolutions:', 'color: #0891b2; font-weight: bold', eligibleSolutions.map(s => s.solutionId));
    console.groupEnd();

    // Process each solution
    for (let i = 0; i < eligibleSolutions.length; i++) {
      if (cancelled) {
        console.log('%c⚠️ Batch cancelled by user', 'color: #f59e0b; font-weight: bold');
        break;
      }

      const solution = eligibleSolutions[i];
      setCurrentSolution(solution.solutionId);
      setProgress(Math.round((i / eligibleSolutions.length) * 100));

      console.log(`%c[${i + 1}/${eligibleSolutions.length}] Processing ${solution.solutionId}`, 'color: #7c3aed; font-weight: bold');

      // Pass serviceProblemId if available (from existing ServiceProblem)
      const result = await processSolution(solution, headers, solution.serviceProblemId);
      report.results.push(result);
      report.batchSizeProcessed++;

      // Update summary
      switch (result.status) {
        case 'SUCCESS':
          report.summary.successful++;
          break;
        case 'FAILED':
          report.summary.failed++;
          break;
        case 'SKIPPED':
          report.summary.skipped++;
          break;
      }

      // Update report state
      setCurrentReport({ ...report });
    }

    // Finalize report
    report.endTime = new Date().toISOString();
    report.status = 'completed';
    setCurrentReport(report);
    setProgress(100);
    setIsRunning(false);
    setCurrentSolution(null);
    setCurrentState(null);

    // Invalidate queries to refresh data
    queryClient.invalidateQueries({ queryKey: ['solutionEmpty'] });
    queryClient.invalidateQueries({ queryKey: ['serviceProblem'] });

    console.group('%c📊 Batch Remediation Completed', 'color: #6366f1; font-weight: bold; font-size: 14px');
    console.log('%cExecution ID:', 'color: #059669; font-weight: bold', executionId);
    console.log('%cTotal Processed:', 'color: #0891b2; font-weight: bold', report.batchSizeProcessed);
    console.log('%cSuccessful:', 'color: #059669; font-weight: bold', report.summary.successful);
    console.log('%cFailed:', 'color: #dc2626; font-weight: bold', report.summary.failed);
    console.log('%cSkipped:', 'color: #f59e0b; font-weight: bold', report.summary.skipped);
    console.groupEnd();

    return report;
  }, [cancelled, processSolution, queryClient]);

  const cancelBatch = useCallback(() => {
    setCancelled(true);
  }, []);

  return {
    startBatch,
    currentReport,
    isRunning,
    progress,
    currentSolution,
    currentState,
    cancelBatch,
  };
}
