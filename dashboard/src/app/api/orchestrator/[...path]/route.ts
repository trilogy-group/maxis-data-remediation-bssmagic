import { type NextRequest, NextResponse } from 'next/server';

/**
 * Batch Orchestrator Proxy Route
 *
 * Proxies requests to the Batch Orchestrator service (port 8082)
 * Handles unified remediation endpoints and scheduler operations
 *
 * Example routes:
 * - POST /api/orchestrator/remediate/{solutionId}
 * - POST /api/orchestrator/remediate (bulk)
 * - POST /api/orchestrator/scheduler/start
 * - GET /api/orchestrator/status
 */

// Batch Orchestrator base URL - in container it's localhost:8082
const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || 'http://localhost:8082';

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, Authorization',
};

// Route parameters
type Params = { params: Promise<{ path: string[] }> };

const handler = async (req: NextRequest, { params }: Params) => {
  const { path } = await params;

  // Build the full URL to the orchestrator
  const pathString = path.join('/');
  const searchParams = req.nextUrl.search;
  const upstreamUrl = `${ORCHESTRATOR_URL}/${pathString}${searchParams}`;

  console.log(`[orchestrator-proxy] ${req.method} ${upstreamUrl}`);

  // Read body for non-GET requests
  const body = req.method !== 'GET' && req.method !== 'HEAD'
    ? await req.text()
    : undefined;

  try {
    const res = await fetch(upstreamUrl, {
      method: req.method,
      body,
      headers: {
        'Content-Type': 'application/json',
        // Forward any authorization headers
        ...(req.headers.get('authorization') && {
          'Authorization': req.headers.get('authorization')!,
        }),
      },
      // Longer timeout for remediation operations
      signal: AbortSignal.timeout(120000), // 2 minutes
    });

    const text = await res.text();
    const json = text ? JSON.parse(text) : null;

    console.log(`[orchestrator-proxy] Response: ${res.status}`);

    return NextResponse.json(json, {
      status: res.status,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error('[orchestrator-proxy] Error:', error);
    return NextResponse.json(
      { error: 'Orchestrator proxy error', detail: String(error) },
      { status: 502, headers: corsHeaders }
    );
  }
};

// Handle CORS preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function GET(req: NextRequest, ctx: Params) {
  return await handler(req, ctx);
}

export async function POST(req: NextRequest, ctx: Params) {
  return await handler(req, ctx);
}

export async function PATCH(req: NextRequest, ctx: Params) {
  return await handler(req, ctx);
}

export async function PUT(req: NextRequest, ctx: Params) {
  return await handler(req, ctx);
}

export async function DELETE(req: NextRequest, ctx: Params) {
  return await handler(req, ctx);
}
