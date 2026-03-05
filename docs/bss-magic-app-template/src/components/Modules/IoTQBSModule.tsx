/**
 * Module 3: IoT QBS Remediator
 *
 * Two-table layout following the 1147/1867 module pattern:
 *   1. Detection table  - held IoT orchestrations from Salesforce
 *   2. Remediation table - results of remediation attempts
 */

import { useState, useCallback } from 'react';
import { Search, RefreshCw, Play, Zap, ChevronDown, ChevronRight, CheckCircle2, XCircle, AlertTriangle, Clock, Shield, ShieldAlert } from 'lucide-react';
import { Spinner, CardLoader } from '../Dashboard/Loader';
import { useIoTQBSDetect, useIoTQBSRemediateSingle } from '../../services/iotQbs/hooks';
import type {
  IoTQBSOrchestrationSummary,
  IoTQBSResult,
  IoTQBSRemediationState,
} from '../../types/iot-qbs';
import { QBS_STATE_DESCRIPTIONS, QBS_STATE_PROGRESS } from '../../types/iot-qbs';

// ---------------------------------------------------------------------------
// State badge helper
// ---------------------------------------------------------------------------

function StateBadge({ state }: { state: IoTQBSRemediationState }) {
  const colors: Record<string, string> = {
    RELEASED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    FAILED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    SAFE_TO_PATCH: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    PATCHING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    REVALIDATING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    RELEASING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    LOADING_DATA: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    VALIDATING: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    RECEIVED: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  };

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[state] ?? colors.RECEIVED}`}>
      {state}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Detection Row (expandable)
// ---------------------------------------------------------------------------

function DetectionRow({
  orch,
  isRemediating,
  onRemediate,
  onDryRun,
}: {
  orch: IoTQBSOrchestrationSummary;
  isRemediating: boolean;
  onRemediate: (id: string) => void;
  onDryRun: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const created = orch.created_date
    ? new Date(orch.created_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '-';

  return (
    <>
      <tr
        className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-3 py-3">
          {expanded ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
        </td>
        <td className="px-3 py-3 text-sm font-mono text-gray-900 dark:text-gray-100">
          {orch.orchestration_process_id.slice(-8)}
        </td>
        <td className="px-3 py-3 text-sm text-gray-700 dark:text-gray-300 max-w-[180px] truncate">
          {orch.name || '-'}
        </td>
        <td className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400">{created}</td>
        <td className="px-3 py-3 text-sm text-center">{orch.pc_count}</td>
        <td className="px-3 py-3 text-sm text-center">{orch.service_count}</td>
        <td className="px-3 py-3 text-sm text-center">
          {orch.mismatch_count > 0 ? (
            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold">
              <AlertTriangle className="h-3.5 w-3.5" />
              {orch.mismatch_count}
            </span>
          ) : (
            <span className="text-green-600 dark:text-green-400">0</span>
          )}
        </td>
        <td className="px-3 py-3 text-sm text-center">
          {orch.is_safe ? (
            <Shield className="h-4 w-4 text-green-500 mx-auto" />
          ) : (
            <ShieldAlert className="h-4 w-4 text-red-500 mx-auto" />
          )}
        </td>
        <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={() => onDryRun(orch.orchestration_process_id)}
              disabled={isRemediating}
              className="px-2.5 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
            >
              Dry Run
            </button>
            <button
              onClick={() => onRemediate(orch.orchestration_process_id)}
              disabled={isRemediating || !orch.is_safe}
              className="px-2.5 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
            >
              {isRemediating && <Spinner size="sm" className="text-white" />}
              Remediate
            </button>
          </div>
        </td>
      </tr>

      {expanded && (
        <tr className="bg-gray-50/50 dark:bg-gray-800/30">
          <td colSpan={9} className="px-6 py-4">
            <div className="text-xs space-y-1 text-gray-600 dark:text-gray-400">
              <div><span className="font-medium">Orchestration ID:</span> {orch.orchestration_process_id}</div>
              <div><span className="font-medium">Order ID:</span> {orch.order_id || '-'}</div>
              <div><span className="font-medium">Product Configurations:</span> {orch.pc_count}</div>
              <div><span className="font-medium">Services:</span> {orch.service_count} ({orch.mismatch_count} mismatched)</div>
              <div><span className="font-medium">Safe to patch:</span> {orch.is_safe ? 'Yes' : 'No -- review safety check'}</div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Remediation Result Row (expandable)
// ---------------------------------------------------------------------------

function ResultRow({ result }: { result: IoTQBSResult }) {
  const [expanded, setExpanded] = useState(false);

  const isSuccess = result.final_state === 'RELEASED';

  return (
    <>
      <tr
        className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-3 py-3">
          {expanded ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
        </td>
        <td className="px-3 py-3 text-sm font-mono text-gray-900 dark:text-gray-100">
          {result.orchestration_process_id.slice(-8)}
        </td>
        <td className="px-3 py-3">
          <StateBadge state={result.final_state} />
        </td>
        <td className="px-3 py-3 text-sm text-center">{result.mismatch_count}</td>
        <td className="px-3 py-3 text-sm text-center">{result.patched_services.length}</td>
        <td className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400">
          {result.duration_seconds.toFixed(1)}s
        </td>
        <td className="px-3 py-3">
          {isSuccess ? (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          ) : (
            <XCircle className="h-4 w-4 text-red-500" />
          )}
        </td>
      </tr>

      {expanded && (
        <tr className="bg-gray-50/50 dark:bg-gray-800/30">
          <td colSpan={7} className="px-6 py-4">
            <div className="space-y-3">
              {/* State Timeline */}
              <div>
                <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">State Timeline</div>
                <div className="flex flex-wrap gap-1">
                  {result.state_history.map(([from, to, reason], i) => (
                    <div key={i} className="text-xs bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-2 py-1">
                      <span className="font-mono text-gray-500">{to}</span>
                      {reason && <span className="text-gray-400 ml-1">- {reason.slice(0, 60)}</span>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Findings */}
              {result.findings.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Mismatches Found ({result.findings.length})
                  </div>
                  <div className="grid gap-1">
                    {result.findings.slice(0, 10).map((f) => (
                      <div key={f.service_id} className="text-xs text-gray-600 dark:text-gray-400 font-mono">
                        SVC {f.service_id.slice(-8)} | SIM ...{f.sim_serial_number?.slice(-6) ?? '?'} | {f.current_pc_id?.slice(-4)} -&gt; {f.correct_pc_id?.slice(-4)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Error */}
              {result.error && (
                <div className="text-xs text-red-600 dark:text-red-400">
                  <span className="font-semibold">Error:</span> {result.error}
                </div>
              )}

              {/* Safety Check */}
              {result.safety_check && !result.safety_check.is_safe && (
                <div className="text-xs text-amber-600 dark:text-amber-400">
                  <span className="font-semibold">Safety Issues:</span>{' '}
                  {result.safety_check.orphan_sims.length > 0 && `${result.safety_check.orphan_sims.length} orphan SIMs. `}
                  {result.safety_check.duplicate_sims.length > 0 && `${result.safety_check.duplicate_sims.length} duplicate SIMs. `}
                  {result.safety_check.empty_oe_pcs.length > 0 && `${result.safety_check.empty_oe_pcs.length} empty OE PCs. `}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Main Module Component
// ---------------------------------------------------------------------------

export function IoTQBSModule() {
  const [detectedOrchestrations, setDetectedOrchestrations] = useState<IoTQBSOrchestrationSummary[]>([]);
  const [remediationResults, setRemediationResults] = useState<IoTQBSResult[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [lastDetected, setLastDetected] = useState<string | null>(null);
  const [activeRemediationId, setActiveRemediationId] = useState<string | null>(null);

  const detectMutation = useIoTQBSDetect();
  const remediateMutation = useIoTQBSRemediateSingle();

  const handleDetect = useCallback(() => {
    detectMutation.mutate({ max_count: 50 }, {
      onSuccess: (data) => {
        setDetectedOrchestrations(data.orchestrations);
        setLastDetected(new Date().toLocaleTimeString());
      },
    });
  }, [detectMutation]);

  const handleRemediate = useCallback((orchId: string) => {
    setActiveRemediationId(orchId);
    remediateMutation.mutate(
      { orchestrationProcessId: orchId, dry_run: false },
      {
        onSuccess: (resp) => {
          setRemediationResults((prev) => [resp.result, ...prev]);
          setActiveRemediationId(null);
        },
        onError: () => setActiveRemediationId(null),
      },
    );
  }, [remediateMutation]);

  const handleDryRun = useCallback((orchId: string) => {
    setActiveRemediationId(orchId);
    remediateMutation.mutate(
      { orchestrationProcessId: orchId, dry_run: true },
      {
        onSuccess: (resp) => {
          setRemediationResults((prev) => [resp.result, ...prev]);
          setActiveRemediationId(null);
        },
        onError: () => setActiveRemediationId(null),
      },
    );
  }, [remediateMutation]);

  // Stats
  const totalDetected = detectedOrchestrations.length;
  const safeToPatch = detectedOrchestrations.filter((o) => o.is_safe && o.mismatch_count > 0).length;
  const totalMismatches = detectedOrchestrations.reduce((s, o) => s + o.mismatch_count, 0);
  const released = remediationResults.filter((r) => r.final_state === 'RELEASED').length;
  const failed = remediationResults.filter((r) => r.final_state === 'FAILED').length;

  // Search filter
  const filteredOrchestrations = detectedOrchestrations.filter((o) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      o.orchestration_process_id.toLowerCase().includes(term) ||
      o.name.toLowerCase().includes(term) ||
      o.order_id.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
            <Zap className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              IoT QBS Mismatch Remediator
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Detect and fix Service-to-PC linkage mismatches in held IoT orders
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastDetected && (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Clock className="h-3 w-3" /> Last scan: {lastDetected}
            </span>
          )}
          <button
            onClick={handleDetect}
            disabled={detectMutation.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {detectMutation.isPending ? (
              <Spinner size="sm" className="text-white" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {detectMutation.isPending ? 'Scanning...' : 'Detect Orchestrations'}
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{totalDetected}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Held Orchestrations</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{totalMismatches}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Total Mismatches</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{safeToPatch}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Safe to Patch</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">{released}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Released</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">{failed}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Failed</div>
        </div>
      </div>

      {/* Detection Error */}
      {detectMutation.isError && (
        <div className="rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/10 p-4">
          <div className="flex items-start gap-3">
            <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900 dark:text-red-100">Detection Failed</h3>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                {detectMutation.error?.message || 'Unknown error'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Detection Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Detected Orchestrations ({filteredOrchestrations.length})
          </h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="h-4 w-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-indigo-500 w-48"
              />
            </div>
          </div>
        </div>

        {detectMutation.isPending && !detectedOrchestrations.length ? (
          <CardLoader message="Scanning Salesforce for held IoT orchestrations..." />
        ) : filteredOrchestrations.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
            {totalDetected === 0
              ? 'No orchestrations detected yet. Click "Detect Orchestrations" to scan.'
              : 'No orchestrations match your search.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <th className="px-3 py-2 w-8"></th>
                  <th className="px-3 py-2">Orch ID</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Created</th>
                  <th className="px-3 py-2 text-center">PCs</th>
                  <th className="px-3 py-2 text-center">SVCs</th>
                  <th className="px-3 py-2 text-center">Mismatches</th>
                  <th className="px-3 py-2 text-center">Safe</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrchestrations.map((orch) => (
                  <DetectionRow
                    key={orch.orchestration_process_id}
                    orch={orch}
                    isRemediating={activeRemediationId === orch.orchestration_process_id}
                    onRemediate={handleRemediate}
                    onDryRun={handleDryRun}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Remediation Results Table */}
      {remediationResults.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Remediation Results ({remediationResults.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <th className="px-3 py-2 w-8"></th>
                  <th className="px-3 py-2">Orch ID</th>
                  <th className="px-3 py-2">State</th>
                  <th className="px-3 py-2 text-center">Mismatches</th>
                  <th className="px-3 py-2 text-center">Patched</th>
                  <th className="px-3 py-2">Duration</th>
                  <th className="px-3 py-2">Result</th>
                </tr>
              </thead>
              <tbody>
                {remediationResults.map((result, idx) => (
                  <ResultRow key={`${result.orchestration_process_id}-${idx}`} result={result} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
