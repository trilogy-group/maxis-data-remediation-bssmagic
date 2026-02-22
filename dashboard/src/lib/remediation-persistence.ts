/**
 * Helper to persist remediation task results to the AWS runtime's PostgreSQL database.
 * Since the TMF server doesn't support POST for custom tables, we insert directly via SQL.
 */

const RUNTIME_URL = process.env.RUNTIME_URL || 'http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com';
const RUNTIME_API_KEY = process.env.RUNTIME_API_KEY || 'bssmagic-d58d6761265b01accc13e8b21bae8282';

export interface RemediationTaskRecord {
  id: string;
  solutionId: string;
  solutionName?: string;
  module: string;
  status: 'acknowledged' | 'inProgress' | 'done' | 'terminatedWithError';
  jobId?: string;
  resultMessage?: string;
}

/**
 * Persist a remediation task to the AWS runtime's remediationTask table.
 * 
 * Strategy:
 * 1. Try PATCH first (if record exists from a previous run)
 * 2. If 404, the record doesn't exist - we'll need to insert via SQL proxy
 * 
 * For now, we use a fire-and-forget approach since the TMF server doesn't support POST.
 * The record is inserted via the /api/remediation-persist endpoint.
 */
export async function persistRemediationTask(record: RemediationTaskRecord): Promise<boolean> {
  try {
    // Try to update via PATCH first (works if record exists)
    const patchUrl = `${RUNTIME_URL}/tmf-api/productInventory/v5/remediationTask/${record.id}`;
    const patchRes = await fetch(patchUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': RUNTIME_API_KEY,
      },
      body: JSON.stringify({
        solutionId: record.solutionId,
        solutionName: record.solutionName || 'Unknown',
        module: record.module,
        status: record.status,
        jobId: record.jobId || null,
        resultMessage: record.resultMessage || null,
        updatedAt: new Date().toISOString(),
      }),
    });

    if (patchRes.ok) {
      console.log(`[remediation-persistence] PATCH successful for ${record.id}`);
      return true;
    }

    if (patchRes.status === 404) {
      // Record doesn't exist - need to insert
      // We'll use the local proxy endpoint that handles SQL insert
      const insertRes = await fetch('/api/remediation-persist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record),
      });

      if (insertRes.ok) {
        console.log(`[remediation-persistence] INSERT successful for ${record.id}`);
        return true;
      }
      
      console.error(`[remediation-persistence] INSERT failed:`, await insertRes.text());
      return false;
    }

    console.error(`[remediation-persistence] PATCH failed (${patchRes.status}):`, await patchRes.text());
    return false;
  } catch (error) {
    console.error(`[remediation-persistence] Error:`, error);
    return false;
  }
}

/**
 * Build SQL INSERT statement for a remediation task record.
 * Used by the proxy endpoint to insert directly into PostgreSQL.
 */
export function buildInsertSQL(record: RemediationTaskRecord): string {
  const now = new Date().toISOString();
  return `
    INSERT INTO tmf."remediationTask" (
      "id", "href", "@type", "@baseType", "@schemaLocation",
      "solutionId", "solutionName", "module", "status", "jobId",
      "createdAt", "updatedAt", "resultMessage"
    ) VALUES (
      '${record.id}',
      '/tmf-api/productInventory/v5/remediationTask/${record.id}',
      'RemediationTask',
      'Task',
      NULL,
      '${record.solutionId}',
      '${(record.solutionName || 'Unknown').replace(/'/g, "''")}',
      '${record.module}',
      '${record.status}',
      ${record.jobId ? `'${record.jobId}'` : 'NULL'},
      '${now}',
      '${now}',
      ${record.resultMessage ? `'${record.resultMessage.replace(/'/g, "''")}'` : 'NULL'}
    )
    ON CONFLICT ("id") DO UPDATE SET
      "status" = EXCLUDED."status",
      "jobId" = EXCLUDED."jobId",
      "updatedAt" = EXCLUDED."updatedAt",
      "resultMessage" = EXCLUDED."resultMessage";
  `;
}







