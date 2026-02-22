import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const RUNTIME_URL = process.env.RUNTIME_URL || 'http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com';
const RUNTIME_API_KEY = process.env.RUNTIME_API_KEY || 'bssmagic-d58d6761265b01accc13e8b21bae8282';

export interface ServiceProblemRecord {
  id: string;
  name?: string;
  description?: string;
  category: string; // 'SolutionEmpty' | 'PartialDataMissing_Voice' | etc.
  status: string; // 'pending' | 'inProgress' | 'resolved' | 'rejected'
  priority?: number;
  reason?: string;
  statusChangeReason?: string;
  creationDate?: string;
  lastUpdate?: string;
  resolutionDate?: string;
  originatingSystem?: string;
  // Solution reference
  solutionId: string;
  solutionName?: string;
  // Additional metadata
  jobId?: string;
  resultMessage?: string;
}

/**
 * GET /api/service-problem
 * 
 * Fetches ServiceProblem records from the runtime.
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const category = url.searchParams.get('category');
    const status = url.searchParams.get('status');
    const limit = url.searchParams.get('limit') || '50';

    const queryParams = new URLSearchParams();
    queryParams.append('limit', limit);
    if (category) queryParams.append('category', category);
    if (status) queryParams.append('status', status);

    const runtimeUrl = `${RUNTIME_URL}/tmf-api/serviceProblemManagement/v5/serviceProblem?${queryParams.toString()}`;
    
    const res = await fetch(runtimeUrl, {
      headers: { 'X-API-Key': RUNTIME_API_KEY },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      if (res.status === 404) {
        return NextResponse.json({ data: [], count: 0 });
      }
      throw new Error(`Runtime returned ${res.status}`);
    }

    const data = await res.json();
    const problems = Array.isArray(data) ? data : [data];
    
    return NextResponse.json({ 
      data: problems, 
      count: problems.length 
    });
  } catch (error) {
    console.error('[service-problem] GET error:', error);
    return NextResponse.json({ 
      data: [], 
      count: 0, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

/**
 * POST /api/service-problem
 * 
 * Creates a new ServiceProblem record in the runtime.
 * Used for auto-creating problems when issues are detected.
 */
export async function POST(req: NextRequest) {
  try {
    const record = (await req.json()) as ServiceProblemRecord;

    if (!record.id || !record.solutionId || !record.category) {
      return NextResponse.json(
        { error: 'Missing required fields: id, solutionId, category' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    
    // Persist to runtime via REST API
    const fullRecord: ServiceProblemRecord = {
      ...record,
      creationDate: record.creationDate || now,
      lastUpdate: now,
      status: record.status || 'pending',
      originatingSystem: record.originatingSystem || 'BSS Magic Dashboard',
    };

    const success = await persistToRuntime(fullRecord);
    
    if (success) {
      return NextResponse.json({ 
        success: true, 
        method: 'INSERT',
        id: record.id,
        record: fullRecord 
      });
    }

    return NextResponse.json({ 
      success: false, 
      error: 'Failed to insert ServiceProblem to runtime',
      record: fullRecord 
    }, { status: 500 });
  } catch (error) {
    console.error('[service-problem] POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/service-problem
 * 
 * Updates an existing ServiceProblem record.
 * Used for updating status during remediation.
 */
export async function PATCH(req: NextRequest) {
  try {
    const { id, ...updates } = (await req.json()) as Partial<ServiceProblemRecord> & { id: string };

    if (!id) {
      return NextResponse.json({ error: 'Missing required field: id' }, { status: 400 });
    }

    // Update in runtime via REST API
    const success = await updateInRuntime(id, updates);
    
    if (success) {
      return NextResponse.json({ success: true, method: 'UPDATE', id });
    }

    return NextResponse.json({ 
      success: false, 
      error: 'Failed to update ServiceProblem in runtime' 
    }, { status: 500 });
  } catch (error) {
    console.error('[service-problem] PATCH error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

function buildServiceProblemInsertSql(record: ServiceProblemRecord): string {
  const escapedName = (record.name || `${record.category} - ${record.solutionName || record.solutionId}`).replace(/'/g, "''");
  const escapedDesc = (record.description || `Detected ${record.category} issue for solution ${record.solutionId}`).replace(/'/g, "''");
  const escapedSolutionName = (record.solutionName || 'Unknown').replace(/'/g, "''");
  const escapedResult = record.resultMessage ? record.resultMessage.replace(/'/g, "''") : null;
  const escapedReason = record.reason ? record.reason.replace(/'/g, "''") : 'Auto-detected by BSS Magic';
  const escapedStatusReason = record.statusChangeReason ? record.statusChangeReason.replace(/'/g, "''") : 'Issue detected';

  return `
    INSERT INTO tmf."serviceProblem" (
      "id", "href", "@type", "@baseType",
      "name", "description", "category", "status",
      "priority", "reason", "statusChangeReason", "statusChangeDate",
      "creationDate", "lastUpdate", "originatingSystem",
      "affectedNumberOfServices", "impactImportanceFactor",
      "externalIdentifier", "characteristic"
    ) VALUES (
      '${record.id}',
      '/tmf-api/serviceProblemManagement/v5/serviceProblem/${record.id}',
      'ServiceProblem',
      'Entity',
      '${escapedName}',
      '${escapedDesc}',
      '${record.category}',
      '${record.status || 'pending'}'::tmf."ServiceProblemStateType",
      ${record.priority || 1},
      '${escapedReason}',
      '${escapedStatusReason}',
      '${record.lastUpdate || new Date().toISOString()}'::timestamp with time zone,
      '${record.creationDate || new Date().toISOString()}'::timestamp with time zone,
      '${record.lastUpdate || new Date().toISOString()}'::timestamp with time zone,
      '${record.originatingSystem || 'BSS Magic Dashboard'}',
      1,
      'High',
      ARRAY[ROW(
        '${record.solutionId}',
        'SolutionId',
        'CloudSense',
        'ExternalIdentifier',
        NULL,
        NULL
      )::tmf."ExternalIdentifier"]::tmf."ExternalIdentifier"[],
      ARRAY[
        ROW(
          NULL::tmf."Characteristic", NULL::tmf."BooleanArrayCharacteristic", NULL::tmf."BooleanCharacteristic",
          NULL::tmf."FloatArrayCharacteristic", NULL::tmf."FloatCharacteristic", NULL::tmf."IntegerArrayCharacteristic",
          NULL::tmf."IntegerCharacteristic", NULL::tmf."NumberArrayCharacteristic", NULL::tmf."NumberCharacteristic",
          NULL::tmf."ObjectArrayCharacteristic", NULL::tmf."ObjectCharacteristic", NULL::tmf."StringArrayCharacteristic",
          ROW('${escapedSolutionName}'::text, NULL::text, 'solutionName'::text, 'string'::text, NULL::tmf."CharacteristicRelationship"[], 'StringCharacteristic'::text, NULL::text, NULL::text)::tmf."StringCharacteristic",
          NULL::tmf."CdrCharacteristic", NULL::tmf."MapAnyCharacteristicValue"
        )::tmf."OneOfCharacteristic"
        ${record.jobId ? `,ROW(
          NULL::tmf."Characteristic", NULL::tmf."BooleanArrayCharacteristic", NULL::tmf."BooleanCharacteristic",
          NULL::tmf."FloatArrayCharacteristic", NULL::tmf."FloatCharacteristic", NULL::tmf."IntegerArrayCharacteristic",
          NULL::tmf."IntegerCharacteristic", NULL::tmf."NumberArrayCharacteristic", NULL::tmf."NumberCharacteristic",
          NULL::tmf."ObjectArrayCharacteristic", NULL::tmf."ObjectCharacteristic", NULL::tmf."StringArrayCharacteristic",
          ROW('${record.jobId}'::text, NULL::text, 'jobId'::text, 'string'::text, NULL::tmf."CharacteristicRelationship"[], 'StringCharacteristic'::text, NULL::text, NULL::text)::tmf."StringCharacteristic",
          NULL::tmf."CdrCharacteristic", NULL::tmf."MapAnyCharacteristicValue"
        )::tmf."OneOfCharacteristic"` : ''}
        ${escapedResult ? `,ROW(
          NULL::tmf."Characteristic", NULL::tmf."BooleanArrayCharacteristic", NULL::tmf."BooleanCharacteristic",
          NULL::tmf."FloatArrayCharacteristic", NULL::tmf."FloatCharacteristic", NULL::tmf."IntegerArrayCharacteristic",
          NULL::tmf."IntegerCharacteristic", NULL::tmf."NumberArrayCharacteristic", NULL::tmf."NumberCharacteristic",
          NULL::tmf."ObjectArrayCharacteristic", NULL::tmf."ObjectCharacteristic", NULL::tmf."StringArrayCharacteristic",
          ROW('${escapedResult}'::text, NULL::text, 'resultMessage'::text, 'string'::text, NULL::tmf."CharacteristicRelationship"[], 'StringCharacteristic'::text, NULL::text, NULL::text)::tmf."StringCharacteristic",
          NULL::tmf."CdrCharacteristic", NULL::tmf."MapAnyCharacteristicValue"
        )::tmf."OneOfCharacteristic"` : ''}
      ]::tmf."OneOfCharacteristic"[]
    )
    ON CONFLICT ("id") DO UPDATE SET
      "status" = EXCLUDED."status",
      "lastUpdate" = EXCLUDED."lastUpdate",
      "statusChangeDate" = EXCLUDED."statusChangeDate",
      "statusChangeReason" = EXCLUDED."statusChangeReason",
      "characteristic" = EXCLUDED."characteristic";
  `.trim().replace(/\n\s+/g, ' ');
}

function buildServiceProblemUpdateSql(id: string, updates: Partial<ServiceProblemRecord> & { statusChangeDate?: string }): string {
  const setClauses: string[] = [];
  
  if (updates.status) {
    setClauses.push(`"status" = '${updates.status}'::tmf."ServiceProblemStateType"`);
  }
  if (updates.lastUpdate) {
    setClauses.push(`"lastUpdate" = '${updates.lastUpdate}'::timestamp with time zone`);
  }
  if (updates.statusChangeDate) {
    setClauses.push(`"statusChangeDate" = '${updates.statusChangeDate}'::timestamp with time zone`);
  }
  if (updates.statusChangeReason) {
    setClauses.push(`"statusChangeReason" = '${updates.statusChangeReason.replace(/'/g, "''")}'`);
  }
  if (updates.resolutionDate) {
    setClauses.push(`"resolutionDate" = '${updates.resolutionDate}'::timestamp with time zone`);
  }
  if (updates.description) {
    setClauses.push(`"description" = '${updates.description.replace(/'/g, "''")}'`);
  }

  return `UPDATE tmf."serviceProblem" SET ${setClauses.join(', ')} WHERE "id" = '${id}'`;
}

/**
 * Persist ServiceProblem to runtime via REST API
 * This is more reliable than executing SQL via AWS CLI
 */
async function persistToRuntime(record: ServiceProblemRecord): Promise<boolean> {
  try {
    const now = new Date().toISOString();
    const payload = {
      '@type': 'ServiceProblem',
      '@baseType': 'Entity',
      id: record.id,
      name: record.name || `${record.category} - ${record.solutionName || record.solutionId}`,
      description: record.description || `Detected ${record.category} issue for solution ${record.solutionId}`,
      category: record.category,
      status: record.status || 'pending',
      priority: record.priority || 1,
      reason: record.reason || 'Auto-detected by BSS Magic',
      statusChangeReason: record.statusChangeReason || 'Issue detected',
      creationDate: record.creationDate || now,
      lastUpdate: record.lastUpdate || now,
      originatingSystem: record.originatingSystem || 'BSS Magic Dashboard',
      // Store affected resource for display in UI table
      affectedResource: [{
        '@type': 'ResourceRef',
        '@referredType': 'Product',
        id: record.solutionId,
        name: record.solutionName || record.solutionId,
      }],
      // Store solutionId in externalIdentifier
      externalIdentifier: [{
        id: record.solutionId,
        externalIdentifierType: 'SolutionId',
        owner: 'CloudSense',
        '@type': 'ExternalIdentifier',
      }],
      // Store solutionName AND solutionId in characteristic for fallback
      characteristic: [
        { name: 'solutionName', value: record.solutionName || record.solutionId, '@type': 'StringCharacteristic' },
        { name: 'solutionId', value: record.solutionId, '@type': 'StringCharacteristic' },
        ...(record.jobId ? [{ name: 'jobId', value: record.jobId, '@type': 'StringCharacteristic' }] : []),
        ...(record.resultMessage ? [{ name: 'resultMessage', value: record.resultMessage, '@type': 'StringCharacteristic' }] : []),
      ],
    };

    console.log(`[service-problem] POSTing to runtime: ${RUNTIME_URL}/tmf-api/serviceProblemManagement/v5/serviceProblem`);
    
    const res = await fetch(`${RUNTIME_URL}/tmf-api/serviceProblemManagement/v5/serviceProblem`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': RUNTIME_API_KEY,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });

    if (res.ok) {
      console.log(`[service-problem] Successfully persisted ServiceProblem ${record.id} to runtime`);
      return true;
    }

    const errorText = await res.text();
    console.error(`[service-problem] Failed to persist to runtime: ${res.status} - ${errorText}`);
    return false;
  } catch (error) {
    console.error('[service-problem] Error persisting to runtime:', error);
    return false;
  }
}

/**
 * Update ServiceProblem status in runtime via PATCH
 */
async function updateInRuntime(id: string, updates: Partial<ServiceProblemRecord> & { 
  jobId?: string; 
  jobIds?: Array<{ action: string; jobId: string }>;
  solutionId?: string;
}): Promise<boolean> {
  try {
    const now = new Date().toISOString();
    
    // Build characteristic array - store ALL job IDs with their action types
    const characteristics: Array<{ name: string; value: string; '@type': string }> = [];
    
    // If we have multiple jobIds (from remediate-full), store each with action prefix
    if (updates.jobIds && updates.jobIds.length > 0) {
      for (const job of updates.jobIds) {
        characteristics.push({ 
          name: `${job.action.toLowerCase()}JobId`, 
          value: job.jobId, 
          '@type': 'StringCharacteristic' 
        });
      }
      // Also store the last one as the primary jobId for backward compatibility
      characteristics.push({ 
        name: 'jobId', 
        value: updates.jobIds[updates.jobIds.length - 1].jobId, 
        '@type': 'StringCharacteristic' 
      });
    } else if (updates.jobId) {
      // Single jobId (backward compatibility)
      characteristics.push({ name: 'jobId', value: updates.jobId, '@type': 'StringCharacteristic' });
    }
    
    // Build externalIdentifier array - MUST include BOTH solutionId AND jobIds
    const externalIdentifiers: Array<{ id: string; externalIdentifierType: string; owner: string; '@type': string }> = [];
    
    // Always include solutionId if provided
    if (updates.solutionId) {
      externalIdentifiers.push({ 
        id: updates.solutionId, 
        externalIdentifierType: 'SolutionId', 
        owner: 'CloudSense', 
        '@type': 'ExternalIdentifier' 
      });
    }
    
    // Add ALL jobIds if provided (from remediate-full: DELETE, MIGRATE, UPDATE)
    if (updates.jobIds && updates.jobIds.length > 0) {
      for (const job of updates.jobIds) {
        externalIdentifiers.push({ 
          id: job.jobId, 
          externalIdentifierType: `${job.action}BatchJobId`, 
          owner: 'Salesforce', 
          '@type': 'ExternalIdentifier' 
        });
      }
    } else if (updates.jobId) {
      // Single jobId (backward compatibility)
      externalIdentifiers.push({ 
        id: updates.jobId, 
        externalIdentifierType: 'BatchJobId', 
        owner: 'Salesforce', 
        '@type': 'ExternalIdentifier' 
      });
    }

    const payload = {
      status: updates.status,
      statusChangeReason: updates.statusChangeReason,
      description: updates.description,
      lastUpdate: now,
      ...(updates.status === 'resolved' ? { resolutionDate: now } : {}),
      ...(characteristics.length > 0 ? { characteristic: characteristics } : {}),
      ...(externalIdentifiers.length > 0 ? { externalIdentifier: externalIdentifiers } : {}),
    };

    console.log(`[service-problem] PATCHing to runtime: ${RUNTIME_URL}/tmf-api/serviceProblemManagement/v5/serviceProblem/${id}`);
    if (updates.solutionId) {
      console.log(`[service-problem] Including solutionId: ${updates.solutionId}`);
    }
    if (updates.jobIds) {
      console.log(`[service-problem] Including ${updates.jobIds.length} jobIds:`, updates.jobIds);
    } else if (updates.jobId) {
      console.log(`[service-problem] Including jobId: ${updates.jobId}`);
    }
    
    const res = await fetch(`${RUNTIME_URL}/tmf-api/serviceProblemManagement/v5/serviceProblem/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': RUNTIME_API_KEY,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });

    if (res.ok) {
      console.log(`[service-problem] Successfully updated ServiceProblem ${id} in runtime`);
      return true;
    }

    const errorText = await res.text();
    console.error(`[service-problem] Failed to update in runtime: ${res.status} - ${errorText}`);
    return false;
  } catch (error) {
    console.error('[service-problem] Error updating in runtime:', error);
    return false;
  }
}

// Legacy SQL execution (kept as fallback)
async function executeSql(sql: string): Promise<boolean> {
  console.log('[service-problem] executeSql called (legacy - using REST API instead)');
  return true; // Skip SQL execution, use REST API
}

/**
 * DELETE /api/service-problem
 * 
 * Deletes ServiceProblem records. 
 * - With ?id=xxx - deletes specific record
 * - With ?category=xxx - deletes all records in category
 * - With ?all=true - deletes ALL records (use with caution)
 */
export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    const category = url.searchParams.get('category');
    const deleteAll = url.searchParams.get('all') === 'true';

    if (!id && !category && !deleteAll) {
      return NextResponse.json(
        { error: 'Must specify id, category, or all=true' },
        { status: 400 }
      );
    }

    // First, get the records to delete
    let queryUrl = `${RUNTIME_URL}/tmf-api/serviceProblemManagement/v5/serviceProblem?limit=100`;
    if (category) queryUrl += `&category=${category}`;

    const listRes = await fetch(queryUrl, {
      headers: { 'X-API-Key': RUNTIME_API_KEY },
      signal: AbortSignal.timeout(10000),
    });

    if (!listRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch records to delete' }, { status: 500 });
    }

    const records = await listRes.json();
    const recordsArray = Array.isArray(records) ? records : [records];

    // Filter by id if specified
    const toDelete = id 
      ? recordsArray.filter((r: { id?: string }) => r.id === id)
      : recordsArray;

    // Delete each record
    let deleted = 0;
    let failed = 0;
    
    for (const record of toDelete) {
      if (!record.id) {
        // Records without ID can't be deleted via API - skip
        failed++;
        continue;
      }

      try {
        const deleteRes = await fetch(
          `${RUNTIME_URL}/tmf-api/serviceProblemManagement/v5/serviceProblem/${record.id}`,
          {
            method: 'DELETE',
            headers: { 'X-API-Key': RUNTIME_API_KEY },
            signal: AbortSignal.timeout(5000),
          }
        );

        if (deleteRes.ok || deleteRes.status === 204) {
          deleted++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    return NextResponse.json({
      success: true,
      deleted,
      failed,
      total: toDelete.length,
      note: failed > 0 ? `${failed} records without ID could not be deleted via API` : undefined,
    });
  } catch (error) {
    console.error('[service-problem] DELETE error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}