import { type NextRequest, NextResponse } from 'next/server';

// 1147-Gateway URL - in container it's localhost:8081, but can be overridden
const GATEWAY_1147_URL = process.env.GATEWAY_1147_URL || 'http://localhost:8081';

type Params = { params: Promise<{ path: string[] }> };

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, Authorization',
};

/**
 * Proxy requests to 1147-Gateway
 * This allows client-side code to call /api/gateway-1147/... instead of localhost:8081
 */
async function handler(req: NextRequest, { params }: Params) {
  const { path } = await params;
  const pathString = path.join('/');
  
  // Build the full URL to the gateway
  // The 1147-gateway has routes at /api/1147/... but /health is at root
  const needsApiPrefix = pathString.startsWith('1147');
  const url = new URL(needsApiPrefix ? `/api/${pathString}` : `/${pathString}`, GATEWAY_1147_URL);
  
  // Forward query params
  req.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });

  try {
    const response = await fetch(url.toString(), {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: req.method !== 'GET' && req.method !== 'HEAD' ? await req.text() : undefined,
    });

    const data = await response.json();
    return NextResponse.json(data, { 
      status: response.status,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error('Error proxying to 1147-gateway:', error);
    return NextResponse.json(
      { error: 'Failed to connect to 1147-gateway', detail: String(error) },
      { status: 502, headers: corsHeaders }
    );
  }
}

// Handle CORS preflight requests
export async function OPTIONS() {
  return new NextResponse(null, { 
    status: 204,
    headers: corsHeaders,
  });
}

export async function GET(req: NextRequest, ctx: Params) {
  return handler(req, ctx);
}

export async function POST(req: NextRequest, ctx: Params) {
  return handler(req, ctx);
}

export async function PUT(req: NextRequest, ctx: Params) {
  return handler(req, ctx);
}

export async function PATCH(req: NextRequest, ctx: Params) {
  return handler(req, ctx);
}

export async function DELETE(req: NextRequest, ctx: Params) {
  return handler(req, ctx);
}
