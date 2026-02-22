/**
 * Task API Proxy (TMF653-like)
 * 
 * Queries Salesforce AsyncApexJob via 1147-gateway and returns TMF653-like Task objects.
 * Uses the 1147-gateway's Salesforce authentication (no separate token needed).
 * 
 * GET /api/task?id=707MS00000B84L3YAJ - Get specific job
 * GET /api/task?limit=10 - List recent jobs
 */
import { NextRequest, NextResponse } from 'next/server';

// 1147-gateway URL - runs on same ECS container, use localhost
const GATEWAY_URL = process.env.GATEWAY_1147_URL || 'http://localhost:8081';
const GATEWAY_API_KEY = process.env.GATEWAY_API_KEY || 'bssmagic-1147-key';

interface AsyncApexJob {
  Id: string;
  ApexClass?: { Name: string };
  Status: string;
  JobType: string;
  NumberOfErrors: number;
  JobItemsProcessed: number;
  TotalJobItems: number;
  CreatedDate: string;
  CompletedDate?: string;
  ExtendedStatus?: string;
  CreatedById?: string;
  ParentJobId?: string;
  MethodName?: string;
}

interface Task {
  id: string;
  href: string;
  name: string;
  description: string;
  category: string;
  status: string;
  statusChangeReason?: string;
  startDate: string;
  completionDate?: string;
  '@type': string;
  '@baseType': string;
  '@schemaLocation': string;
}

function mapStatusToTMF(sfStatus: string): string {
  switch (sfStatus) {
    case 'Queued':
    case 'Holding':
    case 'Preparing':
      return 'pending';
    case 'Processing':
      return 'inProgress';
    case 'Completed':
      return 'completed';
    case 'Aborted':
      return 'cancelled';
    case 'Failed':
      return 'failed';
    default:
      return 'pending';
  }
}

function mapJobToTask(job: AsyncApexJob): Task {
  const description = `Items: ${job.JobItemsProcessed || 0}/${job.TotalJobItems || 0}${
    job.NumberOfErrors > 0 ? ` (${job.NumberOfErrors} errors)` : ''
  }`;

  return {
    id: job.Id,
    href: `/api/task/${job.Id}`,
    name: job.ApexClass?.Name || 'Unknown Apex Class',
    description,
    category: job.JobType,
    status: mapStatusToTMF(job.Status),
    statusChangeReason: job.ExtendedStatus || undefined,
    startDate: job.CreatedDate,
    completionDate: job.CompletedDate || undefined,
    '@type': 'Task',
    '@baseType': 'Entity',
    '@schemaLocation': 'https://tmf-open-api.org/TMF653-TaskManagement/v4.0.0',
  };
}

async function querySalesforce(soql: string): Promise<AsyncApexJob[]> {
  // Query via 1147-gateway's /api/soql/query endpoint (uses its Salesforce auth)
  try {
    const res = await fetch(`${GATEWAY_URL}/api/soql/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': GATEWAY_API_KEY,
      },
      body: JSON.stringify({ query: soql }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.records) {
        return data.records;
      }
    }
    
    console.log('[task-proxy] Gateway response not OK:', res.status);
    return [];
  } catch (error) {
    console.error('[task-proxy] Error calling gateway:', error);
    return [];
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  const limit = parseInt(url.searchParams.get('limit') || '10', 10);

  try {
    let soql: string;
    
    if (id) {
      // Get specific job
      soql = `SELECT Id, ApexClass.Name, Status, JobType, NumberOfErrors, JobItemsProcessed, TotalJobItems, CreatedDate, CompletedDate, ExtendedStatus FROM AsyncApexJob WHERE Id = '${id}'`;
    } else {
      // List recent batch jobs
      soql = `SELECT Id, ApexClass.Name, Status, JobType, NumberOfErrors, JobItemsProcessed, TotalJobItems, CreatedDate, CompletedDate, ExtendedStatus FROM AsyncApexJob WHERE JobType IN ('BatchApex', 'ScheduledApex', 'Queueable') ORDER BY CreatedDate DESC LIMIT ${limit}`;
    }

    const jobs = await querySalesforce(soql);
    const tasks = jobs.map(mapJobToTask);

    if (id) {
      return NextResponse.json(tasks[0] || null);
    }
    
    return NextResponse.json(tasks);
  } catch (error) {
    console.error('[task-proxy] Error:', error);
    return NextResponse.json({
      error: 'Failed to fetch tasks',
      message: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}


