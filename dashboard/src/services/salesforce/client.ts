/**
 * Solution Management API Client
 *
 * Calls the BSS Magic Runtime TMF API which proxies to Salesforce Apex REST
 * APIs via PostgreSQL REST Foreign Data Wrapper.
 *
 * Architecture:
 *   Frontend → CloudFront → ALB → BSS Magic Runtime (TMF Server)
 *            → PostgreSQL → REST FDW → Salesforce Apex REST
 *
 * TMF API endpoints (map to Apex REST /services/apexrest/api/v1/solution/*):
 *   GET    /solutionInfo/{id}           → GET  /solution-information
 *   DELETE /solutionMigration/{id}      → DELETE /solution
 *   POST   /solutionMigration           → POST /migrate/
 *   GET    /migrationStatus/{id}        → GET  /get-migration-status
 *   POST   /solutionPostUpdate          → POST /update-post-migration-data/
 */

import type {
  SolutionInfoResponse,
  ApexApiResponse,
  MigrationStatusResult,
  MigrationStatus,
  UpdatePostMigrationResult,
  UpdatePostMigrationParams,
  PollOptions,
  UnifiedRemediateRequest,
  UnifiedRemediateResponse,
} from './types';

// ============================================================
// Base URL -- TMF API path (same for local dev and production)
// ============================================================

// Both local dev (Vite proxy) and production (CloudFront) route
// /tmf-api/* to the BSS Magic Runtime ALB.
const TMF_BASE = '/tmf-api/solutionManagement/v5';

// TMF API requires API key header
const API_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  'X-API-Key': 'bssmagic-d58d6761265b01accc13e8b21bae8282',
};

// ============================================================
// Terminal migration statuses
// ============================================================

const TERMINAL_STATUSES = new Set<string>(['COMPLETED', 'FAILED']);

// ============================================================
// Default polling configuration (matches API spec)
// ============================================================

const DEFAULT_INITIAL_DELAY = 10;    // seconds before first poll
const DEFAULT_POLL_INTERVAL = 10;    // initial interval (seconds)
const DEFAULT_MAX_INTERVAL = 60;     // max interval (seconds)
const DEFAULT_BACKOFF_FACTOR = 2.0;  // exponential backoff multiplier
const DEFAULT_MAX_DURATION = 1800;   // 30 minutes

// ============================================================
// Helper
// ============================================================

async function tmfFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${TMF_BASE}${path}`;

  console.log(`[tmf-client] ${options.method || 'GET'} ${url}`);

  const response = await fetch(url, {
    ...options,
    headers: {
      ...API_HEADERS,
      ...options.headers,
    },
  });

  // For DELETE operations, the response may be empty (204)
  if (response.status === 204) {
    return { success: true, message: 'Deleted successfully' } as unknown as T;
  }

  // Try to parse JSON
  const data = await response.json() as T;

  console.log(`[tmf-client] Response: ${response.status}`, data);

  return data;
}

function sleep(seconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

// ============================================================
// Endpoint Functions
// ============================================================

/**
 * GET /solutionInfo/{solutionId}
 *
 * Retrieve solution metadata including MACD details, migration status,
 * SM Service status, and account info via REST FDW → Salesforce.
 */
export async function getSolutionInformation(
  solutionId: string,
): Promise<SolutionInfoResponse> {
  return tmfFetch<SolutionInfoResponse>(
    `/solutionInfo/${encodeURIComponent(solutionId)}`,
  );
}

/**
 * DELETE /solutionMigration/{solutionId}
 *
 * Delete a solution from SM Service. Clears any partial or inconsistent
 * SM artifacts for clean re-migration. Always call before migrate.
 *
 * TMF Server translates this to SQL DELETE which the REST FDW
 * translates to: DELETE /services/apexrest/api/v1/solution/solution?solutionId=xxx
 */
export async function deleteSolution(
  solutionId: string,
): Promise<ApexApiResponse> {
  return tmfFetch<ApexApiResponse>(
    `/solutionMigration/${encodeURIComponent(solutionId)}`,
    { method: 'DELETE' },
  );
}

/**
 * POST /solutionMigration
 *
 * Initiate solution migration to SM Service. Returns a jobId for
 * status polling via getMigrationStatus().
 *
 * TMF Server translates this to SQL INSERT which the REST FDW
 * translates to: POST /services/apexrest/api/v1/solution/migrate/
 *
 * IMPORTANT: Always call deleteSolution() first!
 */
export async function migrateSolution(
  solutionId: string,
): Promise<ApexApiResponse> {
  return tmfFetch<ApexApiResponse>(
    '/solutionMigration',
    {
      method: 'POST',
      body: JSON.stringify({ solutionId }),
    },
  );
}

/**
 * GET /migrationStatus/{solutionId}
 *
 * Poll the current migration status. Status values:
 *   PENDING     - Not yet started (non-terminal)
 *   IN_PROGRESS - Currently processing (non-terminal)
 *   COMPLETED   - Successfully completed (terminal)
 *   FAILED      - Migration failed (terminal)
 */
export async function getMigrationStatus(
  solutionId: string,
): Promise<MigrationStatusResult> {
  return tmfFetch<MigrationStatusResult>(
    `/migrationStatus/${encodeURIComponent(solutionId)}`,
  );
}

/**
 * POST /solutionPostUpdate
 *
 * Update SFDC fields and SM Service data after a successful migration.
 * Should be called after migration is confirmed complete (COMPLETED status).
 *
 * TMF Server translates this to SQL INSERT which the REST FDW
 * translates to: POST /services/apexrest/api/v1/solution/update-post-migration-data/
 */
export async function updatePostMigrationData(
  params: UpdatePostMigrationParams,
): Promise<UpdatePostMigrationResult> {
  return tmfFetch<UpdatePostMigrationResult>(
    '/solutionPostUpdate',
    {
      method: 'POST',
      body: JSON.stringify(params),
    },
  );
}

// ============================================================
// Unified Remediation API (Batch Orchestrator)
// ============================================================

/**
 * Orchestrator base URL -- routes through CloudFront/ALB to port 8082
 */
const ORCHESTRATOR_BASE = '/api/orchestrator';

/**
 * POST /remediate/{solutionId}
 *
 * Single-call remediation via the Batch Orchestrator's RemediationEngine.
 * Executes the full 5-step flow server-side:
 *   VALIDATE → DELETE → MIGRATE → POLL → POST_UPDATE
 *
 * This replaces the multi-step browser-orchestrated flow with a single
 * HTTP call. The server handles polling, retries, and SFDC updates.
 *
 * Timeout: up to 5 minutes (CloudFront 300s). For long-running migrations,
 * fallback to the individual TMF API calls above.
 */
export async function remediateSolution(
  solutionId: string,
  request: UnifiedRemediateRequest = {},
): Promise<UnifiedRemediateResponse> {
  const url = `${ORCHESTRATOR_BASE}/remediate/${encodeURIComponent(solutionId)}`;

  console.log(`[orchestrator] POST ${url}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': 'bssmagic-d58d6761265b01accc13e8b21bae8282',
    },
    body: JSON.stringify(request),
  });

  const data = await response.json() as UnifiedRemediateResponse;

  console.log(
    `[orchestrator] Response: ${response.status}, success=${data.success}, ` +
    `steps=${data.steps?.length ?? 0}, duration=${data.total_duration_ms}ms`
  );

  return data;
}

// ============================================================
// Polling Helper (legacy -- used by useBatchRemediation.ts)
// ============================================================

/**
 * Poll migration status with exponential backoff until terminal status.
 *
 * Polling strategy (per API spec):
 *   - Initial delay: 10s after calling /migrate/
 *   - Polling interval: exponential backoff (10s -> 20s -> 40s -> 60s max)
 *   - Terminal condition: COMPLETED or FAILED
 *   - Timeout: 30 minutes max
 *
 * @param solutionId - 18-character Salesforce Solution ID
 * @param opts - Polling configuration overrides
 * @returns Final MigrationStatusResult with terminal status
 * @throws Error if max duration exceeded
 */
export async function pollMigrationStatus(
  solutionId: string,
  opts?: PollOptions,
): Promise<MigrationStatusResult> {
  const initialDelay = opts?.initialDelay ?? DEFAULT_INITIAL_DELAY;
  const pollInterval = opts?.pollInterval ?? DEFAULT_POLL_INTERVAL;
  const maxInterval = opts?.maxInterval ?? DEFAULT_MAX_INTERVAL;
  const backoffFactor = opts?.backoffFactor ?? DEFAULT_BACKOFF_FACTOR;
  const maxDuration = opts?.maxDuration ?? DEFAULT_MAX_DURATION;
  const onStatusUpdate = opts?.onStatusUpdate;

  console.log(
    `[tmf-client] Starting migration polling for ${solutionId}, ` +
    `initialDelay=${initialDelay}s, maxDuration=${maxDuration}s`,
  );

  // Wait initial delay before first poll
  await sleep(initialDelay);

  let elapsed = initialDelay;
  let currentInterval = pollInterval;

  while (elapsed < maxDuration) {
    const result = await getMigrationStatus(solutionId);
    const currentStatus = result.status;

    console.log(
      `[tmf-client] Poll status=${currentStatus}, ` +
      `subscriptionCount=${result.subscriptionCount}, ` +
      `elapsed=${elapsed.toFixed(0)}s`,
    );

    // Notify caller of status update
    if (onStatusUpdate && currentStatus) {
      onStatusUpdate(currentStatus as MigrationStatus, elapsed, result.subscriptionCount);
    }

    // Check for terminal status
    if (currentStatus && TERMINAL_STATUSES.has(currentStatus)) {
      console.log(`[tmf-client] Migration reached terminal status: ${currentStatus}`);
      return result;
    }

    // Wait with exponential backoff
    const waitTime = Math.min(currentInterval, maxInterval);
    await sleep(waitTime);
    elapsed += waitTime;
    currentInterval *= backoffFactor;
  }

  // Timeout reached
  console.error(`[tmf-client] Migration polling timed out after ${maxDuration}s`);
  return {
    success: false,
    message: `Migration polling timed out after ${maxDuration}s`,
    solutionId,
    status: null,
    subscriptionCount: null,
  };
}
