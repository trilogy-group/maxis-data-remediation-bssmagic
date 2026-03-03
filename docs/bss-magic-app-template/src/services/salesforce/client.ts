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
// OE Remediation API (Module 1867 - Batch Orchestrator)
// ============================================================

export interface OERemediateResponse {
  service_id: string;
  success: boolean;
  final_state: string;
  fields_patched: string[];
  error: string | null;
  duration_seconds: number;
}

export interface OEBatchResponse {
  job_id: string | null;
  message: string;
  results_count: number;
  summary: {
    total: number;
    remediated: number;
    not_impacted: number;
    skipped: number;
    failed: number;
    pending: number;
  } | null;
}

export interface OEDiscoverResponse {
  message: string;
  discovered: number;
  problems_created: number;
  skipped_duplicates?: number;
  errors: number;
}

/**
 * POST /oe/remediate/{serviceId}
 *
 * Remediate a single service through the 4-step OE flow:
 *   1. Fetch raw OE data from Salesforce
 *   2. Analyze + patch attachment JSON in memory
 *   3. Persist patched attachment
 *   4. Trigger SM Service sync
 */
export async function remediateOEService(
  serviceId: string,
  options: { dry_run?: boolean; service_problem_id?: string } = {},
): Promise<OERemediateResponse> {
  const url = `${ORCHESTRATOR_BASE}/oe/remediate/${encodeURIComponent(serviceId)}`;

  console.log(`[orchestrator] POST ${url}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': 'bssmagic-d58d6761265b01accc13e8b21bae8282',
    },
    body: JSON.stringify(options),
  });

  const data = await response.json() as OERemediateResponse;

  console.log(
    `[orchestrator] OE Response: ${response.status}, success=${data.success}, ` +
    `state=${data.final_state}, patched=${data.fields_patched?.length ?? 0}`
  );

  return data;
}

/**
 * POST /oe/remediate
 *
 * Batch OE remediation: discover pending services from ServiceProblem
 * and process them through the 4-step flow.
 */
export async function remediateOEBatch(
  options: { max_count?: number; dry_run?: boolean; job_name?: string } = {},
): Promise<OEBatchResponse> {
  const url = `${ORCHESTRATOR_BASE}/oe/remediate`;

  console.log(`[orchestrator] POST ${url} (batch)`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': 'bssmagic-d58d6761265b01accc13e8b21bae8282',
    },
    body: JSON.stringify(options),
  });

  return response.json() as Promise<OEBatchResponse>;
}

/**
 * POST /oe/discover
 *
 * Discover 1867-affected services and create ServiceProblem records.
 */
export async function discoverOEServices(
  options: { max_count?: number } = {},
): Promise<OEDiscoverResponse> {
  const url = `${ORCHESTRATOR_BASE}/oe/discover`;

  console.log(`[orchestrator] POST ${url}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': 'bssmagic-d58d6761265b01accc13e8b21bae8282',
    },
    body: JSON.stringify(options),
  });

  return response.json() as Promise<OEDiscoverResponse>;
}

// ============================================================
// OE Service Problems (Module 1867 - Tracking Table)
// ============================================================

export interface OEServiceProblem {
  id: string;
  status: 'pending' | 'inProgress' | 'resolved' | 'rejected';
  description: string;
  category: string;
  priority: string;
  creationDate?: string;
  resolutionDate?: string;
  characteristic?: Array<{ name: string; value: string }>;
  serviceId: string;
  serviceType: string;
  missingFields: string[];
  presentFields: Record<string, string>;
  remediationState: string;
  detectedAt: string;
  productDefinitionName?: string;
}

function parseCharacteristic(chars: Array<{ name: string; value: string }> | undefined, name: string): string {
  if (!chars) return '';
  const c = chars.find(ch => ch.name === name);
  return c?.value ?? '';
}

export async function fetchOEServiceProblems(): Promise<OEServiceProblem[]> {
  const params = new URLSearchParams({ category: 'PartialDataMissing', limit: '500' });
  const url = `/tmf-api/serviceProblemManagement/v5/serviceProblem?${params.toString()}`;

  console.log('[OE-1867] Fetching service problems from:', url);

  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': 'bssmagic-d58d6761265b01accc13e8b21bae8282',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch OE service problems: ${response.status}`);
  }

  const raw: Array<Record<string, unknown>> = await response.json();
  if (!Array.isArray(raw)) return [];

  return raw.map((sp) => {
    const chars = sp.characteristic as Array<{ name: string; value: string }> | undefined;
    const missingStr = parseCharacteristic(chars, 'missingFields');
    const presentStr = parseCharacteristic(chars, 'presentFields');
    const presentFields: Record<string, string> = {};
    if (presentStr) {
      presentStr.split(',').forEach(pair => {
        const [k, v] = pair.split('=');
        if (k && v !== undefined) presentFields[k.trim()] = v.trim();
      });
    }

    return {
      id: sp.id as string,
      status: (sp.status as OEServiceProblem['status']) || 'pending',
      description: (sp.description as string) || '',
      category: (sp.category as string) || '',
      priority: (sp.priority as string) || '',
      creationDate: sp.creationDate as string | undefined,
      resolutionDate: sp.resolutionDate as string | undefined,
      characteristic: chars,
      serviceId: parseCharacteristic(chars, 'serviceId'),
      serviceType: parseCharacteristic(chars, 'serviceType'),
      missingFields: missingStr ? missingStr.split(',').map(f => f.trim()) : [],
      presentFields,
      remediationState: parseCharacteristic(chars, 'remediationState'),
      detectedAt: parseCharacteristic(chars, 'detectedAt'),
      productDefinitionName: parseCharacteristic(chars, 'productDefinitionName') || undefined,
    };
  });
}

// ============================================================
// OE Batch Check API (Module 1867 - Detection Only)
// ============================================================

export interface OECheckResult {
  service_id: string;
  service_name: string | null;
  has_issues: boolean;
  missing_fields: string[];
  present_fields: Record<string, string>;
  error: string | null;
  service_problem_id: string | null;
}

export interface OEBatchCheckResponse {
  status: 'started' | 'already_running' | 'completed';
  service_type: string;
  total_candidates: number;
  checked: number;
}

export interface OECheckProgress {
  running: boolean;
  service_type: string;
  total: number;
  checked: number;
  with_issues: number;
  no_issues: number;
  errors: number;
  problems_created: number;
  started_at?: string;
  finished_at?: string;
}

/**
 * POST /oe/batch-check -- returns immediately, runs in background.
 * Poll progress via fetchCheckProgress().
 */
export async function batchCheckOEServices(
  options: { service_type?: string; max_count?: number; dry_run?: boolean } = {},
): Promise<OEBatchCheckResponse> {
  const url = `${ORCHESTRATOR_BASE}/oe/batch-check`;

  console.log(`[orchestrator] POST ${url} (batch-check)`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': 'bssmagic-d58d6761265b01accc13e8b21bae8282',
    },
    body: JSON.stringify(options),
  });

  if (!response.ok) {
    throw new Error(`Batch check failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<OEBatchCheckResponse>;
}

/**
 * GET /oe/batch-check/progress?service_type=Voice
 * Poll live progress of a running batch check.
 */
export async function fetchCheckProgress(
  serviceType: string = 'Voice',
): Promise<OECheckProgress> {
  const url = `${ORCHESTRATOR_BASE}/oe/batch-check/progress?service_type=${encodeURIComponent(serviceType)}&_t=${Date.now()}`;

  const response = await fetch(url, {
    headers: {
      'X-API-Key': 'bssmagic-d58d6761265b01accc13e8b21bae8282',
      'Cache-Control': 'no-cache',
    },
  });

  if (!response.ok) {
    throw new Error(`Progress fetch failed: ${response.status}`);
  }

  return response.json() as Promise<OECheckProgress>;
}

// ============================================================
// Orchestrator Config API (parallel batch processing)
// ============================================================

export interface BatchConfig {
  batch_parallel: boolean;
  batch_concurrency: number;
  batch_progress_interval: number;
}

/**
 * GET /config - Fetch current parallel batch processing configuration
 */
export async function getOrchestratorConfig(): Promise<BatchConfig> {
  const url = `${ORCHESTRATOR_BASE}/config`;
  const response = await fetch(url, {
    headers: { 'X-API-Key': 'bssmagic-d58d6761265b01accc13e8b21bae8282' },
  });
  if (!response.ok) throw new Error(`Config fetch failed: ${response.status}`);
  return response.json() as Promise<BatchConfig>;
}

/**
 * PATCH /config - Update parallel batch processing configuration at runtime
 */
export async function updateOrchestratorConfig(
  patch: Partial<BatchConfig>,
): Promise<BatchConfig> {
  const url = `${ORCHESTRATOR_BASE}/config`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': 'bssmagic-d58d6761265b01accc13e8b21bae8282',
    },
    body: JSON.stringify(patch),
  });
  if (!response.ok) throw new Error(`Config update failed: ${response.status}`);
  return response.json() as Promise<BatchConfig>;
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

// ============================================================
// OE Rules Configuration API
// ============================================================

export interface OERulesConfig {
  service_types: Record<string, {
    oe_schema_name: string;
    pd_name_patterns: string[];
    mandatory_fields: Array<{
      field_name: string;
      oe_attribute_name: string;
      aliases: string[];
      source_type: 'STATIC' | 'FIELD_LOOKUP' | 'RELATIONSHIP_LOOKUP';
      static_value?: string;
      value_path?: string;
      label_path?: string;
    }>;
  }>;
}

export interface AvailableFields {
  serviceFields: string[];
  allFields: string[];
  source: string;
}

export async function fetchOERulesConfig(): Promise<OERulesConfig> {
  const url = `${ORCHESTRATOR_BASE}/oe/config`;
  const response = await fetch(url, {
    headers: {
      'X-API-Key': 'bssmagic-d58d6761265b01accc13e8b21bae8282',
      'Cache-Control': 'no-cache',
    },
  });
  if (!response.ok) throw new Error(`Config fetch failed: ${response.status}`);
  return response.json() as Promise<OERulesConfig>;
}

export async function saveOERulesConfig(config: OERulesConfig): Promise<{ status: string; service_types: number; total_fields: number }> {
  const url = `${ORCHESTRATOR_BASE}/oe/config`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': 'bssmagic-d58d6761265b01accc13e8b21bae8282',
    },
    body: JSON.stringify(config),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Config save failed: ${response.status} ${text}`);
  }
  return response.json();
}

export async function fetchAvailableFields(): Promise<AvailableFields> {
  const url = `${ORCHESTRATOR_BASE}/oe/config/available-fields`;
  const response = await fetch(url, {
    headers: {
      'X-API-Key': 'bssmagic-d58d6761265b01accc13e8b21bae8282',
      'Cache-Control': 'no-cache',
    },
  });
  if (!response.ok) throw new Error(`Fields fetch failed: ${response.status}`);
  return response.json() as Promise<AvailableFields>;
}
