import { NextRequest, NextResponse } from 'next/server';

/**
 * Fix Failed Migration Solution
 * 
 * This endpoint triggers the 1147 Solution Empty remediation via the 1147 Gateway.
 * It executes the full 3-step remediation:
 * 1. DELETE - Remove existing partial data from Heroku
 * 2. MIGRATE - Re-push data from Salesforce to Heroku
 * 3. UPDATE - Update configuration metadata in Heroku
 */
const GATEWAY_1147_URL = process.env.GATEWAY_1147_URL || 'http://localhost:8081';

export async function POST(req: NextRequest) {
  try {
    const { solutionId } = await req.json();

    if (!solutionId) {
      return NextResponse.json(
        { error: 'solutionId is required' },
        { status: 400 }
      );
    }

    // Call 1147 Gateway for full remediation
    const response = await fetch(`${GATEWAY_1147_URL}/api/1147/remediate-full`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ solutionId }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }));
      return NextResponse.json(
        { 
          error: 'Failed to fix solution',
          message: errorData.error || errorData.detail || `Gateway returned ${response.status}`,
          gatewayError: errorData
        },
        { status: response.status }
      );
    }

    const result = await response.json();

    return NextResponse.json({
      success: result.success,
      solutionId: result.solutionId,
      message: result.success 
        ? 'Solution remediation completed successfully. All 3 steps (DELETE, MIGRATE, UPDATE) were executed.'
        : `Solution remediation failed at step: ${result.failedAt || 'unknown'}`,
      timestamp: new Date().toISOString(),
      steps: result.results?.map((r: any) => ({
        action: r.action,
        success: r.success,
        jobId: r.jobId,
        error: r.error
      })) || [],
      failedAt: result.failedAt,
      gatewayResponse: result
    });

  } catch (error) {
    console.error('Error fixing solution:', error);
    
    // Check if it's a connection error to the gateway
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return NextResponse.json(
        { 
          error: 'Gateway connection failed',
          message: `Cannot connect to 1147 Gateway at ${GATEWAY_1147_URL}. Please ensure the gateway is running.`,
          details: error.message
        },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to fix solution',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

