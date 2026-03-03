/**
 * TypeScript interfaces for the Salesforce Apex REST API responses.
 *
 * API Base Path: /services/apexrest/api/v1/solution
 *
 * These types match the API spec in solution-empty-api specs.txt (v1.4)
 * and the Python dataclasses in 1147-gateway/app/services/apex_rest_client.py.
 */

// ============================================================
// GET /solution-information
// ============================================================

export interface BasketDetail {
  /** Basket record ID */
  basketId: string;
  /** Current basket stage (e.g., "Open", "Order Enrichment", "Submitted") */
  basketStage: string | null;
  /** ISO 8601 timestamp when basket was created */
  basketCreatedDate: string;
  /** Number of days since basket was created */
  basketAgeInDays: number;
}

export interface MACDDetails {
  /** Whether any MACD solution exists for this solution */
  macdBasketExists: boolean;
  /** Array of MACD Solution IDs if any exist */
  macdSolutionIds: string[];
  /** ISO 8601 timestamp of last MACD operation */
  lastMacdDate: string | null;
  /** Total number of MACD solutions */
  macdCount: number;
  /** Detailed basket information for granular MACD eligibility checks */
  basketDetails?: BasketDetail[];
}

export interface SMServiceStatus {
  /** Whether the solution exists in SM Service */
  existsInSmService: boolean;
  /** The SM Service ID for this solution */
  smServiceId: string | null;
  /** ISO 8601 timestamp of last sync with SM Service */
  lastSyncDate: string | null;
}

export interface AdditionalMetadata {
  /** Salesforce Account ID */
  accountId: string;
  /** Account name */
  accountName: string;
  /** Solution Definition ID for migration */
  solutionDefinitionId: string | null;
  /** Product family classification */
  productFamily: string | null;
}

export interface SolutionInfoResponse {
  success: boolean;
  message: string;
  solutionId: string | null;
  solutionName: string | null;
  externalIdentifier: string | null;
  createdBy: string | null;
  createdDate: string | null;
  migrationStatus: string | null;
  migrationDate: string | null;
  macdDetails: MACDDetails | null;
  smServiceStatus: SMServiceStatus | null;
  additionalMetadata: AdditionalMetadata | null;
}

// ============================================================
// DELETE /solution  &  POST /migrate/
// ============================================================

export interface ApexApiResponse {
  success: boolean;
  message: string;
  solutionId: string | null;
  jobId: string | null;
  status: string | null;
}

// ============================================================
// GET /get-migration-status
// ============================================================

/** Terminal migration statuses -- stop polling when one of these is reached */
export type MigrationTerminalStatus = 'COMPLETED' | 'FAILED';

/** All possible migration statuses */
export type MigrationStatus = 'PENDING' | 'IN_PROGRESS' | MigrationTerminalStatus;

export interface MigrationStatusResult {
  success: boolean;
  message: string;
  solutionId: string | null;
  /** PENDING | IN_PROGRESS | COMPLETED | FAILED */
  status: MigrationStatus | null;
  /** Number of subscriptions processed/being processed */
  subscriptionCount: number | null;
}

// ============================================================
// POST /update-post-migration-data/
// ============================================================

export interface UpdatePostMigrationError {
  target: string;
  message: string;
}

export interface UpdatePostMigrationResult {
  success: boolean;
  message: string;
  solutionId: string | null;
  /** "success" | "failed" | "skipped" */
  sfdcUpdateStatus: string | null;
  /** "success" | "failed" | "skipped" */
  smServiceUpdateStatus: string | null;
  /** List of SFDC field names that were successfully updated */
  updatedFields: string[] | null;
  /** Array of error objects if any updates failed */
  errors: UpdatePostMigrationError[] | null;
}

export interface UpdatePostMigrationParams {
  solutionId: string;
  migrationStatus: string;
  jobId?: string;
  sfdcUpdates?: Record<string, unknown>;
  smServiceData?: Record<string, unknown>;
}

// ============================================================
// Aggregated result for the full remediation workflow
// ============================================================

export interface RemediationStepResult {
  action: 'SOLUTION_INFO' | 'DELETE' | 'MIGRATE' | 'POLL_STATUS' | 'UPDATE';
  success: boolean;
  message: string;
  jobId?: string;
  status?: string;
  data?: Record<string, unknown>;
}

export interface FullRemediationResult {
  solutionId: string;
  success: boolean;
  failedAt: string | null;
  message: string;
  steps: RemediationStepResult[];
  /** Migration job ID (from MIGRATE step) */
  jobId?: string;
}

// ============================================================
// Unified Remediation API (POST /remediate/{solutionId})
// ============================================================

/** Single step detail from the unified remediation engine */
export interface UnifiedStepDetail {
  action: 'VALIDATE' | 'DELETE' | 'MIGRATE' | 'POLL' | 'POST_UPDATE';
  success: boolean;
  duration_ms: number;
  message: string;
  job_id?: string | null;
  status?: string | null;
}

/** Request body for POST /remediate/{solutionId} */
export interface UnifiedRemediateRequest {
  service_problem_id?: string;
  skip_validation?: boolean;
  sfdc_updates?: Record<string, unknown>;
}

/** Response from POST /remediate/{solutionId} */
export interface UnifiedRemediateResponse {
  solution_id: string;
  success: boolean;
  steps: UnifiedStepDetail[];
  total_duration_ms: number;
  failed_at: string | null;
  message: string;
  service_problem_updated: boolean;
}

// ============================================================
// Polling configuration
// ============================================================

export interface PollOptions {
  /** Seconds to wait before first poll (default: 10) */
  initialDelay?: number;
  /** Initial polling interval in seconds (default: 10) */
  pollInterval?: number;
  /** Maximum polling interval in seconds (default: 60) */
  maxInterval?: number;
  /** Exponential backoff multiplier (default: 2.0) */
  backoffFactor?: number;
  /** Maximum total polling duration in seconds (default: 1800 = 30min) */
  maxDuration?: number;
  /** Callback for status updates during polling */
  onStatusUpdate?: (status: MigrationStatus, elapsed: number, subscriptionCount: number | null) => void;
}
