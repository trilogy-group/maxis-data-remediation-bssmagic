import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createTask, updateTask, type TmfTask } from '@/lib/task-store';

const GATEWAY_1147_URL = process.env.GATEWAY_1147_URL || 'http://localhost:8081';

// Map module to ServiceProblem category
const MODULE_TO_CATEGORY: Record<string, string> = {
  '1147': 'SolutionEmpty',
  '1867': 'PartialDataMissing',
};

// Map task status to ServiceProblemStateType
const STATUS_TO_SERVICE_PROBLEM_STATUS: Record<string, string> = {
  'pending': 'pending',
  'inProgress': 'inProgress',
  'done': 'resolved',
  'terminatedWithError': 'rejected',
  'failed': 'rejected',
};

// Helper to persist result to AWS runtime as ServiceProblem (TMF656)
async function persistToServiceProblem(record: {
  id: string;
  solutionId: string;
  solutionName?: string;
  module: string;
  status: string;
  jobId?: string;
  resultMessage?: string;
}): Promise<void> {
  try {
    const serviceProblemStatus = STATUS_TO_SERVICE_PROBLEM_STATUS[record.status] || 'pending';
    const category = MODULE_TO_CATEGORY[record.module] || record.module;
    
    const res = await fetch('http://localhost:3000/api/service-problem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: record.solutionId, // Use solutionId as the ServiceProblem ID (one problem per solution)
        solutionId: record.solutionId,
        solutionName: record.solutionName,
        category,
        status: serviceProblemStatus,
        jobId: record.jobId,
        resultMessage: record.resultMessage,
        statusChangeReason: record.resultMessage || `Remediation ${record.status}`,
        reason: `${record.module} issue detected`,
      }),
    });
    if (!res.ok) {
      console.error('[TMF Task] Failed to persist ServiceProblem:', await res.text());
    } else {
      console.log('[TMF Task] Persisted ServiceProblem:', record.solutionId);
    }
  } catch (error) {
    console.error('[TMF Task] Error persisting ServiceProblem:', error);
  }
}

type CreateTaskBody = {
  '@type'?: string;
  name?: string;
  relatedEntity?: Array<{ id?: string; role?: string; '@referredType'?: string }>;
  characteristic?: Array<{ name?: string; value?: string }>;
};

function extractSolutionId(body: CreateTaskBody): string | null {
  const fromRelatedEntity =
    body.relatedEntity?.find((e) => (e.role || '').toLowerCase() === 'solution')?.id ??
    body.relatedEntity?.find((e) => (e['@referredType'] || '').toLowerCase() === 'product')?.id ??
    body.relatedEntity?.find((e) => !!e.id)?.id;

  return fromRelatedEntity ?? null;
}

function getCharacteristic(body: CreateTaskBody, name: string): string | undefined {
  return body.characteristic?.find((c) => c.name === name)?.value;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as CreateTaskBody;
  const solutionId = extractSolutionId(body);

  if (!solutionId) {
    return NextResponse.json(
      { error: 'relatedEntity[role=solution].id is required' },
      { status: 400 },
    );
  }

  const mode = getCharacteristic(body, 'mode') ?? 'smart';
  const dryRun = (getCharacteristic(body, 'dryRun') ?? 'false').toLowerCase() === 'true';

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const task: TmfTask = {
    id,
    href: `/tmf-api/taskManagement/v4/task/${id}`,
    '@type': body['@type'] ?? 'SolutionEmptyRemediationTask',
    name: body.name ?? '1147 Solution Empty - Remediate',
    state: 'acknowledged',
    creationDate: now,
    lastUpdate: now,
    relatedEntity: [
      { id: solutionId, role: 'solution', '@referredType': 'Product' },
    ],
    characteristic: [
      { name: 'mode', value: mode },
      { name: 'dryRun', value: dryRun ? 'true' : 'false' },
    ],
    note: [{ text: 'Task created; remediation not started yet', date: now }],
  };

  createTask(task);

  // Synchronous execution: do the remediation now and only return once the task is completed.
  // This matches the old "direct gateway call" behavior, but wrapped in TMF Task format.
  const startedAt = new Date().toISOString();
  updateTask(id, {
    state: 'inProgress',
    note: [{ text: `Started remediation (mode=${mode})`, date: startedAt }],
  });

  try {
    if (dryRun) {
      const latest = updateTask(id, {
        state: 'done',
        note: [{ text: 'Dry-run: no changes executed', date: new Date().toISOString() }],
      });
      return NextResponse.json(latest, { status: 201 });
    }

    // Gateway supports: /remediate (single action), /remediate-full (3-step: DELETE+MIGRATE+UPDATE)
    // mode=quick uses single DELETE action; mode=full uses remediate-full endpoint
    const action = getCharacteristic(body, 'action') ?? 'DELETE'; // Default action for single step
    const endpoint =
      mode === 'full'
        ? `${GATEWAY_1147_URL}/api/1147/remediate-full`
        : `${GATEWAY_1147_URL}/api/1147/remediate`;

    const requestBody = mode === 'full' 
      ? { solutionId }
      : { solutionId, action };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    const payload = await res.json().catch(() => null);

    if (!res.ok) {
      const errorMsg = `Gateway error (${res.status}): ${payload?.error || payload?.detail || res.statusText}`;
      const latest = updateTask(id, {
        state: 'terminatedWithError',
        note: [{ text: errorMsg, date: new Date().toISOString() }],
        characteristic: [
          ...(task.characteristic ?? []),
          { name: 'gatewayStatus', value: String(res.status) },
          { name: 'solutionId', value: solutionId },
        ],
      });
      
      // Persist failure to AWS runtime
      void persistToServiceProblem({
        id,
        solutionId,
        solutionName: body.name,
        module: '1147',
        status: 'terminatedWithError',
        jobId: payload?.jobId,
        resultMessage: errorMsg,
      });
      
      return NextResponse.json(latest, { status: 201 });
    }

    const success = payload?.success;
    const resultMsg = success
      ? 'Remediation completed successfully'
      : `Remediation failed${payload?.failedAt ? ` at step ${payload.failedAt}` : ''}`;
    
    const latest = updateTask(id, {
      state: success ? 'done' : 'terminatedWithError',
      note: [{ text: resultMsg, date: new Date().toISOString() }],
      characteristic: [
        ...(task.characteristic ?? []),
        { name: 'gatewayStatus', value: String(res.status) },
        { name: 'solutionId', value: solutionId },
      ],
    });
    
    // Persist result to AWS runtime
    void persistToServiceProblem({
      id,
      solutionId,
      solutionName: body.name,
      module: '1147',
      status: success ? 'done' : 'terminatedWithError',
      jobId: payload?.jobId,
      resultMessage: resultMsg,
    });
    
    return NextResponse.json(latest, { status: 201 });
  } catch (e) {
    const errorMsg = `Unhandled error calling gateway: ${e instanceof Error ? e.message : String(e)}`;
    const latest = updateTask(id, {
      state: 'terminatedWithError',
      note: [{ text: errorMsg, date: new Date().toISOString() }],
      characteristic: [
        ...(task.characteristic ?? []),
        { name: 'solutionId', value: solutionId },
      ],
    });
    
    // Persist failure to AWS runtime
    void persistToServiceProblem({
      id,
      solutionId,
      solutionName: body.name,
      module: '1147',
      status: 'terminatedWithError',
      resultMessage: errorMsg,
    });
    
    return NextResponse.json(latest, { status: 201 });
  }
}



