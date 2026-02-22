import { type NextRequest, NextResponse } from 'next/server';

// CloudSense JS Gateway URL - in container it's localhost:8080
const GATEWAY_CLOUDSENSE_URL = process.env.GATEWAY_CLOUDSENSE_URL || 'http://localhost:8080';

type Params = { params: Promise<{ path: string[] }> };

/**
 * Proxy requests to CloudSense JS Gateway (Playwright-based)
 * This allows client-side code to call /api/gateway-cloudsense/... 
 */
async function handler(req: NextRequest, { params }: Params) {
  const { path } = await params;
  const pathString = path.join('/');
  
  // Build the full URL to the gateway
  // Note: some routes like /health don't have /api/ prefix
  const apiRoutes = ['configurations', 'oe', 'verify-oe'];
  const needsApiPrefix = apiRoutes.some(route => pathString.startsWith(route));
  const url = new URL(needsApiPrefix ? `/api/${pathString}` : `/${pathString}`, GATEWAY_CLOUDSENSE_URL);
  
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
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error proxying to CloudSense JS Gateway:', error);
    return NextResponse.json(
      { error: 'Failed to connect to CloudSense JS Gateway', detail: String(error) },
      { status: 502 }
    );
  }
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
