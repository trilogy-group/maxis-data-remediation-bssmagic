import { NextRequest, NextResponse } from 'next/server';

/**
 * Fix Failed Migration Solution
 *
 * This endpoint triggers unified remediation via the Batch Orchestrator.
 * It executes the full 5-step remediation process:
 * 1. DETECT - Query TMF API for affected solutions
 * 2. ANALYZE - Identify missing/incorrect data
 * 3. PATCH - Update via TMF API REST FDW
 * 4. PERSIST - Write to CloudSense Heroku DB
 * 5. SYNC - Update Salesforce objects
 */
const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || 'http://localhost:8082';

export async function POST(req: NextRequest) {
  try {
    const { solutionId } = await req.json();

    if (!solutionId) {
      return NextResponse.json(
        { error: 'solutionId is required' },
        { status: 400 }
      );
    }

    console.log(`[fix-solution] Remediating solution ${solutionId} via Batch Orchestrator`);

    // Call Batch Orchestrator unified remediation endpoint
    const response = await fetch(`${ORCHESTRATOR_URL}/remediate/${solutionId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ dry_run: false }),
      // Longer timeout for remediation operations
      signal: AbortSignal.timeout(120000), // 2 minutes
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }));
      console.error('[fix-solution] Orchestrator error:', errorData);

      return NextResponse.json(
        {
          error: 'Failed to fix solution',
          message: errorData.error || errorData.detail || `Orchestrator returned ${response.status}`,
          orchestratorError: errorData
        },
        { status: response.status }
      );
    }

    const result = await response.json();

    console.log(`[fix-solution] Success: ${result.success}, steps completed: ${result.steps_completed || 0}/5`);

    return NextResponse.json({
      success: result.success,
      solutionId: result.solution_id,
      message: result.success
        ? `Solution remediation completed successfully. ${result.steps_completed || 5} steps executed.`
        : `Solution remediation failed: ${result.error || 'unknown error'}`,
      timestamp: new Date().toISOString(),
      stepsCompleted: result.steps_completed,
      details: result.details,
      error: result.error,
      orchestratorResponse: result
    });

  } catch (error) {
    console.error('[fix-solution] Error:', error);

    // Check if it's a connection error to the orchestrator
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return NextResponse.json(
        {
          error: 'Orchestrator connection failed',
          message: `Cannot connect to Batch Orchestrator at ${ORCHESTRATOR_URL}. Please ensure the orchestrator is running.`,
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
