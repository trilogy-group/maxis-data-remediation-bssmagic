// Solution Empty (1147) Types
// User Story: Execute Controlled Re-Migration for Solution Empty (Use Case 1147)

/**
 * Fixability Reason Codes - Validation-Based
 */
export type ValidationReasonCode =
  | 'MACD_EXISTS'
  | 'POST_MIGRATION_ACTIVITY_DETECTED'
  | 'VALIDATION_FAILED'
  | 'UNEXPECTED_STATE';

/**
 * Fixability Reason Codes - Remediation-Based
 */
export type RemediationReasonCode =
  | 'REMIGRATION_FAILED'
  | 'DELETE_FAILED'
  | 'MIGRATION_FAILED'
  | 'POST_UPDATE_FAILED';

/**
 * All possible reason codes
 */
export type FixabilityReasonCode = ValidationReasonCode | RemediationReasonCode | 'ELIGIBLE';

/**
 * Remediation outcome status
 */
export type RemediationOutcome =
  | 'not_attempted'
  | 'successful'
  | 'failed'
  | 'skipped';

/**
 * State Engine States for Remediation Workflow (LLD Section 6.2.5)
 * 
 * Flow: DETECTED → VALIDATED → DELETED → MIGRATION_STARTED → MIGRATION_CONFIRMED → POST_UPDATED
 * 
 * Each solution transitions through these states deterministically.
 * Failures at any stage result in FAILED state with failureStage recorded.
 */
export type RemediationState =
  | 'DETECTED'              // Added to tracking, awaiting remediation start
  | 'VALIDATED'             // Eligibility confirmed via validate-remigration API
  | 'DELETED'               // SM artifacts deleted successfully
  | 'MIGRATION_STARTED'     // Migration triggered, jobId captured
  | 'MIGRATION_CONFIRMED'   // Migration completed (polling confirmed)
  | 'POST_UPDATED'          // Salesforce fields updated, workflow complete
  | 'SKIPPED'               // Validation failed (MACD exists) - not eligible
  | 'FAILED';               // Terminal failure, manual review required

/**
 * State transition record for audit trail
 */
export interface StateTransition {
  fromState: RemediationState;
  toState: RemediationState;
  timestamp: string;
  reason?: string;
  retryCount?: number;
}

/**
 * Batch execution configuration
 */
export interface BatchExecutionConfig {
  /** Number of solutions to process (10, 50, 100, 500) */
  batchSize: 10 | 50 | 100 | 500;
  /** Execute immediately or at scheduled time */
  executionMode: 'immediate' | 'scheduled';
  /** Scheduled execution time (ISO string) */
  scheduledTime?: string;
}

/**
 * Per-solution result in a batch execution
 */
export interface BatchSolutionResult {
  solutionId: string;
  solutionName: string | null;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  currentState: RemediationState;
  failureStage?: string;
  failureReason?: string;
  jobIds?: { action: string; jobId: string }[];
  stateHistory: StateTransition[];
  startTime: string;
  endTime?: string;
}

/**
 * Execution report for a batch run
 */
export interface ExecutionReport {
  /** Unique execution ID */
  executionId: string;
  /** Who triggered (user email or 'system') */
  triggeredBy: string;
  /** Execution start time */
  startTime: string;
  /** Execution end time */
  endTime?: string;
  /** Batch size requested */
  batchSizeRequested: number;
  /** Batch size actually processed */
  batchSizeProcessed: number;
  /** Summary counts */
  summary: {
    total: number;
    successful: number;
    failed: number;
    skipped: number;
  };
  /** Per-solution results */
  results: BatchSolutionResult[];
  /** Execution status */
  status: 'running' | 'completed' | 'failed';
}

/**
 * Fixability status for a solution
 */
export interface FixabilityStatus {
  /** Whether this solution can be auto-remediated */
  isFixable: boolean;
  /** Reason code for fixability determination */
  reasonCode: FixabilityReasonCode;
  /** Human-readable reason description */
  reasonDescription: string;
}

/**
 * Remediation attempt record
 */
export interface RemediationStatus {
  /** Last remediation attempt timestamp */
  lastAttempt: string | null;
  /** Outcome of the last remediation attempt */
  outcome: RemediationOutcome;
  /** Stage where failure occurred (if failed) */
  failureStage: string | null;
  /** Human-readable failure reason */
  failureReason: string | null;
  /** Job ID for tracking (if available) */
  jobId: string | null;
}

/**
 * A single Solution Empty issue
 */
export interface SolutionEmptyIssue {
  /** Unique solution ID */
  solutionId: string;
  /** Solution name (if available) */
  solutionName: string | null;
  /** Salesforce environment/org */
  sfEnvironment: string;
  /** When this issue was detected */
  detectedAt: string;
  /** Use case identifier */
  useCase: '1147';
  /** Detection source */
  detectionSource: 'BSS Magic – Solution Validator';
  /** Fixability determination */
  fixability: FixabilityStatus;
  /** Remediation status */
  remediation: RemediationStatus;
  /** Associated ServiceProblem ID (if tracked) */
  serviceProblemId?: string;
}

/**
 * Summary metrics for the header (matches Health Dashboard)
 */
export interface SolutionEmptySummary {
  /** Currently active (unresolved) issues */
  activeCount: number;
  /** Detected in last 24 hours */
  detected24h: number;
  /** Detected in last 7 days */
  detected7d: number;
  /** Detected in last 30 days */
  detected30d: number;
  /** Resolved in last 24 hours */
  resolved24h: number;
  /** Resolved in last 7 days */
  resolved7d: number;
  /** Resolved in last 30 days */
  resolved30d: number;
}

/**
 * TMF656 ServiceProblem record
 */
export interface ServiceProblem {
  /** Unique ID */
  id?: string;
  /** Problem name (e.g., "SolutionEmpty - Mobile Solution - MIG") */
  name?: string;
  /** Problem description */
  description: string;
  /** Category (e.g., 'SolutionEmpty') */
  category: string;
  /** Priority (1-5) */
  priority: number;
  /** Current status */
  status: 'pending' | 'inProgress' | 'resolved' | 'rejected';
  /** Affected resources */
  affectedResource?: Array<{
    '@referredType'?: string;
    '@type'?: string;
    name?: string;
    id?: string;
  }>;
  /** Created timestamp */
  creationDate?: string;
  /** Last update timestamp */
  lastUpdate?: string;
  /** Status change date (when fix started) */
  statusChangeDate?: string;
  /** Status change reason */
  statusChangeReason?: string;
  /** Resolution date */
  resolutionDate?: string;
  /** Tracking records */
  trackingRecord?: Array<{
    description: string;
    time: string;
    user?: string;
  }>;
  /** Extension info */
  extensionInfo?: Array<{
    name: string;
    value: string;
  }>;
  /** Characteristics (e.g., solutionName, jobId) */
  characteristic?: Array<{
    '@type'?: string;
    name: string;
    value: string | number | boolean;
  }>;
  /** External identifiers (e.g., SolutionId, BatchJobId) */
  externalIdentifier?: Array<{
    id: string;
    externalIdentifierType?: string;
    owner?: string;
    '@type'?: string;
  }>;
}

/**
 * Complete data for the Solution Empty drill-down
 */
export interface SolutionEmptyData {
  /** Summary metrics */
  summary: SolutionEmptySummary;
  /** List of currently detected issues (from Product API) */
  issues: SolutionEmptyIssue[];
  /** List of service problems (from ServiceProblem API) */
  serviceProblems: ServiceProblem[];
  /** Timestamp of last data update */
  lastUpdated: string;
}

/**
 * Fixability reason descriptions
 */
export const FIXABILITY_REASONS: Record<FixabilityReasonCode, string> = {
  // Validation-based - Not Fixable
  MACD_EXISTS: 'MACD basket with active/recent orders exists. Eligibility checked at remediation time.',
  POST_MIGRATION_ACTIVITY_DETECTED: 'Post-migration user activity detected. Cannot safely auto-remediate.',
  VALIDATION_FAILED: 'Validation API returned ineligible. Manual review required.',
  UNEXPECTED_STATE: 'Solution is in an unexpected or unsafe state. Manual review required.',
  
  // Remediation-based - Not Fixable
  REMIGRATION_FAILED: 'Previous re-migration attempt failed. Manual intervention required.',
  DELETE_FAILED: 'Previous delete operation failed. Manual intervention required.',
  MIGRATION_FAILED: 'Previous migration attempt failed. Manual intervention required.',
  POST_UPDATE_FAILED: 'Post-update validation failed. Manual intervention required.',
  
  // Eligible
  ELIGIBLE: 'All validation checks passed. Safe for auto-remediation.',
};

/**
 * Failure stage descriptions
 */
export const FAILURE_STAGES: Record<string, string> = {
  validation: 'Pre-remediation Validation',
  deletion: 'Solution Deletion',
  remigration: 'Re-migration Execution',
  post_validation: 'Post-remediation Validation',
  cleanup: 'Cleanup Operations',
};
