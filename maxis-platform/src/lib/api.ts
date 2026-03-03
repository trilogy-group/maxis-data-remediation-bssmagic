const BASE = '/platform';
const PROXY_BASE = `${BASE}/api/tmf`;
const ORCHESTRATOR_URL = process.env.NEXT_PUBLIC_ORCHESTRATOR_URL || 'http://localhost:8082';

export interface TMFResource {
  name: string;
  mapped: boolean;
  basePath: string | null;
}

export interface MetadataSource {
  name: string;
  resources: { name: string }[];
}

export interface RuntimeMetadata {
  sources: MetadataSource[];
  resources: TMFResource[];
}

export async function fetchMetadata(): Promise<RuntimeMetadata> {
  const res = await fetch(`${PROXY_BASE}/metadata`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Metadata fetch failed: ${res.status}`);
  return res.json();
}

export async function queryTMF(basePath: string, params?: Record<string, string>): Promise<unknown[]> {
  const proxyPath = `${PROXY_BASE}${basePath}`;
  const url = new URL(proxyPath, window.location.origin);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) throw new Error(`TMF query failed: ${res.status}`);
  return res.json();
}

export async function queryTMFSingle(basePath: string, id: string): Promise<unknown> {
  const res = await fetch(`${PROXY_BASE}${basePath}/${id}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`TMF query failed: ${res.status}`);
  return res.json();
}

export async function healthCheck(basePath: string): Promise<{ ok: boolean; ms: number; error?: string }> {
  const start = Date.now();
  try {
    const res = await fetch(`${PROXY_BASE}${basePath}?limit=1`, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
    return { ok: res.ok, ms: Date.now() - start, error: res.ok ? undefined : `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, ms: Date.now() - start, error: (e as Error).message };
  }
}

export async function triggerRemediation(solutionId: string, dryRun = false) {
  const res = await fetch(`${ORCHESTRATOR_URL}/remediate/${solutionId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dry_run: dryRun }),
  });
  return res.json();
}

export async function getOrchestratorStatus() {
  const res = await fetch(`${ORCHESTRATOR_URL}/status`);
  return res.json();
}

export { BASE, ORCHESTRATOR_URL };
