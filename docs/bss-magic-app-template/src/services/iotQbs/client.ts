/**
 * IoT QBS API Client
 *
 * Calls the Batch Orchestrator's IoT QBS endpoints via the Vite proxy.
 * Architecture: Frontend -> /api/orchestrator/iot-qbs/* -> ALB:8082 -> FastAPI
 */

import type {
  IoTQBSDetectResponse,
  IoTQBSSingleRemediateResponse,
  IoTQBSBatchRemediateResponse,
} from '../../types/iot-qbs';

const ORCHESTRATOR_BASE = '/api/orchestrator';
const API_KEY = 'bssmagic-d58d6761265b01accc13e8b21bae8282';

async function orchestratorFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${ORCHESTRATOR_BASE}${path}`;
  console.log(`[iot-qbs] ${options.method || 'GET'} ${url}`);

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`[iot-qbs] Error ${response.status}:`, text);
    throw new Error(`IoT QBS API error ${response.status}: ${text}`);
  }

  return response.json() as Promise<T>;
}

export async function detectIoTQBSOrchestrations(
  opts: { max_count?: number } = {},
): Promise<IoTQBSDetectResponse> {
  return orchestratorFetch<IoTQBSDetectResponse>('/iot-qbs/detect', {
    method: 'POST',
    body: JSON.stringify({ max_count: opts.max_count ?? 50 }),
  });
}

export async function remediateIoTQBSOrchestration(
  orchestrationProcessId: string,
  opts: { dry_run?: boolean } = {},
): Promise<IoTQBSSingleRemediateResponse> {
  return orchestratorFetch<IoTQBSSingleRemediateResponse>(
    `/iot-qbs/remediate/${encodeURIComponent(orchestrationProcessId)}`,
    {
      method: 'POST',
      body: JSON.stringify({ dry_run: opts.dry_run ?? false }),
    },
  );
}

export async function remediateIoTQBSBatch(
  opts: {
    orchestration_ids?: string[];
    max_count?: number;
    dry_run?: boolean;
  } = {},
): Promise<IoTQBSBatchRemediateResponse> {
  return orchestratorFetch<IoTQBSBatchRemediateResponse>('/iot-qbs/remediate', {
    method: 'POST',
    body: JSON.stringify({
      orchestration_ids: opts.orchestration_ids ?? [],
      max_count: opts.max_count,
      dry_run: opts.dry_run ?? false,
    }),
  });
}
