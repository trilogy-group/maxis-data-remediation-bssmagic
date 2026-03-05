/**
 * IoT QBS Module Types
 *
 * Mirrors the Python Pydantic models from batch-orchestrator/app/models/schemas.py.
 * Used by the IoTQBSModule for detection, validation, and remediation tracking.
 */

export type IoTQBSRemediationState =
  | 'RECEIVED'
  | 'LOADING_DATA'
  | 'VALIDATING'
  | 'SAFE_TO_PATCH'
  | 'PATCHING'
  | 'REVALIDATING'
  | 'RELEASING'
  | 'RELEASED'
  | 'FAILED';

export const QBS_STATE_DESCRIPTIONS: Record<IoTQBSRemediationState, string> = {
  RECEIVED: 'Detected, awaiting processing',
  LOADING_DATA: 'Loading order data from Salesforce',
  VALIDATING: 'Building truth table, checking safety',
  SAFE_TO_PATCH: 'Validated, ready to patch',
  PATCHING: 'Applying service corrections',
  REVALIDATING: 'Verifying corrections applied',
  RELEASING: 'Releasing orchestration from hold',
  RELEASED: 'Completed successfully',
  FAILED: 'Failed - review required',
};

export const QBS_STATE_PROGRESS: Record<IoTQBSRemediationState, number> = {
  RECEIVED: 0,
  LOADING_DATA: 15,
  VALIDATING: 30,
  SAFE_TO_PATCH: 45,
  PATCHING: 60,
  REVALIDATING: 75,
  RELEASING: 90,
  RELEASED: 100,
  FAILED: 100,
};

export interface ValidationFinding {
  service_id: string;
  sim_serial_number: string | null;
  current_pc_id: string | null;
  correct_pc_id: string | null;
  rule: number;
  field_mismatches: Record<string, { expected: string; source: string }>;
}

export interface IoTQBSSafetyCheck {
  orphan_sims: string[];
  duplicate_sims: string[];
  empty_oe_pcs: string[];
  is_safe: boolean;
}

export interface IoTQBSDiscoveredOrchestration {
  orchestration_process_id: string;
  name: string;
  order_id: string;
  created_date: string;
}

export interface IoTQBSOrchestrationSummary extends IoTQBSDiscoveredOrchestration {
  pc_count: number;
  service_count: number;
  mismatch_count: number;
  is_safe: boolean;
  findings: ValidationFinding[];
}

export interface IoTQBSValidateResponse {
  orchestration_process_id: string;
  pc_count: number;
  service_count: number;
  mismatch_count: number;
  is_safe: boolean;
  findings: ValidationFinding[];
  safety_check: IoTQBSSafetyCheck | null;
}

export interface IoTQBSResult {
  orchestration_process_id: string;
  order_id: string | null;
  final_state: IoTQBSRemediationState;
  findings: ValidationFinding[];
  safety_check: IoTQBSSafetyCheck | null;
  patched_services: string[];
  state_history: [string, string, string][];
  failure_stage: string | null;
  error: string | null;
  duration_seconds: number;
  service_count: number;
  pc_count: number;
  mismatch_count: number;
}

export interface IoTQBSBatchSummary {
  total: number;
  released: number;
  failed: number;
  pending: number;
}

export interface IoTQBSDetectResponse {
  orchestrations: IoTQBSDiscoveredOrchestration[];
  total_found: number;
}

export interface IoTQBSSingleRemediateResponse {
  success: boolean;
  result: IoTQBSResult;
  message: string;
}

export interface IoTQBSBatchRemediateResponse {
  message: string;
  results: IoTQBSResult[];
  summary: IoTQBSBatchSummary;
}
