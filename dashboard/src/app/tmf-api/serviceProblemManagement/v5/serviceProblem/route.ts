/**
 * TMF656 Service Problem Management API
 * 
 * POST /tmf-api/serviceProblemManagement/v5/serviceProblem
 * 
 * Creates a ServiceProblem and triggers remediation if category is 'SolutionEmpty'
 * (or 'SolutionSyncFailure' for backward compatibility) and extensionInfo contains
 * remediationAction='resync'.
 * 
 * This is the canonical API for Solution Empty remediation (Problem 1147).
 */
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const GATEWAY_1147_URL = process.env.GATEWAY_1147_URL || 'http://localhost:8081';
const SERVICE_PROBLEM_API = process.env.SERVICE_PROBLEM_API || 'http://localhost:3000/api/service-problem';
const RUNTIME_URL = process.env.RUNTIME_URL || 'http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com';

interface ServiceProblemRequest {
  '@type'?: string;
  category?: string;
  description?: string;
  priority?: string | number;
  status?: string;
  affectedResource?: Array<{
    id?: string;
    name?: string;
    '@referredType'?: string;
    '@type'?: string;
  }>;
  relatedEntity?: Array<{
    id?: string;
    name?: string;
    role?: string;
    '@referredType'?: string;
    '@type'?: string;
  }>;
  extensionInfo?: Array<{
    name?: string;
    value?: string;
  }>;
  characteristic?: Array<{
    name?: string;
    value?: string;
  }>;
}

interface TrackingRecord {
  description: string;
  time: string;
  user: string;
}

/**
 * Extract solutionId from affectedResource or relatedEntity
 */
function extractSolutionInfo(body: ServiceProblemRequest): { solutionId: string | null; solutionName: string | null } {
  // Try affectedResource first (as per TMF656)
  const fromAffectedResource = body.affectedResource?.find(r => 
    r['@referredType'] === 'Product' || r['@referredType'] === 'Solution'
  );
  if (fromAffectedResource?.id) {
    return { solutionId: fromAffectedResource.id, solutionName: fromAffectedResource.name || null };
  }

  // Fall back to relatedEntity
  const fromRelatedEntity = body.relatedEntity?.find(r => 
    r['@referredType'] === 'Product' || r.role === 'affectedProduct'
  );
  if (fromRelatedEntity?.id) {
    return { solutionId: fromRelatedEntity.id, solutionName: fromRelatedEntity.name || null };
  }

  return { solutionId: null, solutionName: null };
}

/**
 * Extract extension/characteristic value by name
 */
function getExtensionValue(body: ServiceProblemRequest, name: string): string | undefined {
  return body.extensionInfo?.find(e => e.name === name)?.value 
    || body.characteristic?.find(c => c.name === name)?.value;
}

/**
 * Persist ServiceProblem to runtime database
 */
async function persistServiceProblem(record: {
  id: string;
  solutionId: string;
  solutionName?: string;
  category: string;
  status: string;
  description?: string;
  priority?: number;
  jobId?: string;
  resultMessage?: string;
  trackingRecords?: TrackingRecord[];
}): Promise<boolean> {
  try {
    const res = await fetch(SERVICE_PROBLEM_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: record.id,
        solutionId: record.solutionId,
        solutionName: record.solutionName,
        category: record.category,
        status: record.status,
        description: record.description,
        priority: record.priority,
        jobId: record.jobId,
        resultMessage: record.resultMessage,
        statusChangeReason: record.resultMessage || `ServiceProblem ${record.status}`,
        reason: `${record.category} issue detected`,
        originatingSystem: 'BSS Magic - TMF656 API',
      }),
    });
    return res.ok;
  } catch (error) {
    console.error('[TMF656] Error persisting ServiceProblem:', error);
    return false;
  }
}

/**
 * Update ServiceProblem status (with optional solutionId to preserve in externalIdentifier)
 */
async function updateServiceProblemStatus(id: string, status: string, resultMessage?: string, solutionId?: string): Promise<boolean> {
  try {
    const res = await fetch(SERVICE_PROBLEM_API, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        status,
        statusChangeReason: resultMessage,
        description: resultMessage,
        ...(solutionId ? { solutionId } : {}),
      }),
    });
    return res.ok;
  } catch (error) {
    console.error('[TMF656] Error updating ServiceProblem:', error);
    return false;
  }
}

/**
 * Update ServiceProblem with status, jobId, and solutionId
 */
async function updateServiceProblemWithJobId(
  id: string, 
  status: string, 
  resultMessage?: string, 
  jobId?: string,
  solutionId?: string
): Promise<boolean> {
  try {
    const payload: Record<string, unknown> = {
      id,
      status,
      statusChangeReason: resultMessage,
      description: resultMessage,
    };
    
    // Include solutionId if available (to preserve it in externalIdentifier)
    if (solutionId) {
      payload.solutionId = solutionId;
      console.log(`[TMF656] Persisting solutionId ${solutionId} for ServiceProblem ${id}`);
    }
    
    // Include jobId if available
    if (jobId) {
      payload.jobId = jobId;
      console.log(`[TMF656] Persisting jobId ${jobId} for ServiceProblem ${id}`);
    }
    
    const res = await fetch(SERVICE_PROBLEM_API, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch (error) {
    console.error('[TMF656] Error updating ServiceProblem with jobId:', error);
    return false;
  }
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as ServiceProblemRequest;
  const now = new Date().toISOString();
  const id = `sp-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

  // Extract solution info
  const { solutionId, solutionName } = extractSolutionInfo(body);
  
  if (!solutionId) {
    return NextResponse.json({
      error: 'Missing required field',
      message: 'affectedResource[].id or relatedEntity[].id with @referredType=Product is required',
    }, { status: 400 });
  }

  // Extract remediation action
  const remediationAction = getExtensionValue(body, 'remediationAction');
  const category = body.category || 'SolutionEmpty';
  const priority = typeof body.priority === 'number' ? body.priority : 
                   body.priority === 'high' ? 1 : body.priority === 'medium' ? 2 : 3;

  // Create initial ServiceProblem
  const serviceProblem = {
    id,
    href: `/tmf-api/serviceProblemManagement/v5/serviceProblem/${id}`,
    '@type': 'ServiceProblem',
    '@baseType': 'Entity',
    category,
    description: body.description || `Solution ${solutionName || solutionId} requires remediation`,
    priority,
    status: 'pending',  // Valid ServiceProblemStateType enum value
    statusChangeDate: now,
    creationDate: now,
    lastUpdate: now,
    originatingSystem: 'BSS Magic Dashboard',
    affectedResource: body.affectedResource || [{
      id: solutionId,
      name: solutionName,
      '@referredType': 'Product',
      '@type': 'ResourceRef',
    }],
    extensionInfo: body.extensionInfo || [{
      name: 'remediationAction',
      value: remediationAction || 'resync',
    }],
    trackingRecord: [
      { description: 'ServiceProblem created', time: now, user: 'API Client' },
    ],
  };

  // Persist initial ServiceProblem
  await persistServiceProblem({
    id,
    solutionId,
    solutionName: solutionName || undefined,
    category,
    status: 'pending',
    description: serviceProblem.description,
    priority,
  });

  // Check if this should trigger remediation
  const shouldRemediate = 
    category === 'SolutionSyncFailure' || 
    category === 'SolutionEmpty' ||
    remediationAction === 'resync';

  if (!shouldRemediate) {
    // Just create the ServiceProblem without triggering remediation
    return NextResponse.json(serviceProblem, { status: 201 });
  }

  // ====== TRIGGER REMEDIATION ======
  
  // Update status to inProgress
  serviceProblem.status = 'inProgress';
  serviceProblem.lastUpdate = new Date().toISOString();
  serviceProblem.trackingRecord.push({
    description: 'Remediation triggered - calling 1147-gateway',
    time: new Date().toISOString(),
    user: 'BSS Magic',
  });

  await updateServiceProblemStatus(id, 'inProgress', 'Remediation in progress', solutionId);

  try {
    // Call 1147-gateway for full remediation (DELETE → MIGRATE → UPDATE)
    const gatewayResponse = await fetch(`${GATEWAY_1147_URL}/api/1147/remediate-full`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ solutionId }),
    });

    const gatewayResult = await gatewayResponse.json().catch(() => null);
    const resolvedAt = new Date().toISOString();

    if (gatewayResponse.ok && gatewayResult?.success) {
      // SUCCESS
      serviceProblem.status = 'resolved';
      serviceProblem.statusChangeDate = resolvedAt;
      serviceProblem.lastUpdate = resolvedAt;
      (serviceProblem as any).resolutionDate = resolvedAt;
      
      // Add tracking records for each step
      if (gatewayResult.results) {
        for (const step of gatewayResult.results) {
          serviceProblem.trackingRecord.push({
            description: `${step.action}: ${step.success ? 'completed' : 'failed'}${step.jobId ? ` (jobId: ${step.jobId})` : ''}`,
            time: resolvedAt,
            user: 'BSS Magic',
          });
        }
      }
      
      serviceProblem.trackingRecord.push({
        description: 'Remediation completed successfully',
        time: resolvedAt,
        user: 'BSS Magic',
      });

      // Add jobId to extensionInfo if available
      const jobId = gatewayResult.results?.find((r: any) => r.jobId)?.jobId;
      if (jobId) {
        serviceProblem.extensionInfo.push({
          name: 'SMServiceJobId',
          value: jobId,
        });
      }

      // Update ServiceProblem with status, jobId, and solutionId
      await updateServiceProblemWithJobId(id, 'resolved', 'Remediation completed successfully', jobId, solutionId);
      
      return NextResponse.json(serviceProblem, { status: 201 });

    } else {
      // FAILED
      const errorMsg = gatewayResult?.failedAt 
        ? `Remediation failed at step: ${gatewayResult.failedAt}`
        : `Gateway error: ${gatewayResponse.status}`;
      
      serviceProblem.status = 'rejected';
      serviceProblem.statusChangeDate = resolvedAt;
      serviceProblem.lastUpdate = resolvedAt;
      serviceProblem.trackingRecord.push({
        description: errorMsg,
        time: resolvedAt,
        user: 'BSS Magic',
      });

      // Add error message
      (serviceProblem as any).errorMessage = [{
        code: String(gatewayResponse.status),
        message: errorMsg,
        timestamp: resolvedAt,
      }];

      await updateServiceProblemStatus(id, 'rejected', errorMsg, solutionId);

      return NextResponse.json(serviceProblem, { status: 201 });
    }

  } catch (error) {
    // CONNECTION ERROR
    const errorMsg = `Cannot connect to 1147-gateway at ${GATEWAY_1147_URL}: ${error instanceof Error ? error.message : String(error)}`;
    const errorTime = new Date().toISOString();

    serviceProblem.status = 'rejected';
    serviceProblem.statusChangeDate = errorTime;
    serviceProblem.lastUpdate = errorTime;
    serviceProblem.trackingRecord.push({
      description: errorMsg,
      time: errorTime,
      user: 'BSS Magic',
    });

    (serviceProblem as any).errorMessage = [{
      code: 'CONNECTION_ERROR',
      message: errorMsg,
      timestamp: errorTime,
    }];

    await updateServiceProblemStatus(id, 'rejected', errorMsg, solutionId);

    return NextResponse.json(serviceProblem, { status: 201 });
  }
}

/**
 * GET /tmf-api/serviceProblemManagement/v5/serviceProblem
 * 
 * Proxy to the runtime ServiceProblem API
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const queryString = url.search;
  
  try {
    const res = await fetch(`${SERVICE_PROBLEM_API}${queryString}`, {
      headers: { 'Content-Type': 'application/json' },
    });
    
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to fetch ServiceProblem records',
      message: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

