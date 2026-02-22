import { type NextRequest, NextResponse } from 'next/server';
import APP_CONFIG from '@/lib/app.config.json';

// API Key for authenticating with the BSS Magic Runtime
const BSSMAGIC_API_KEY = process.env.BSSMAGIC_API_KEY || 'bssmagic-d58d6761265b01accc13e8b21bae8282';

// Environment header for routing to sandbox runtime
const TMF_ENVIRONMENT = process.env.NEXT_PUBLIC_TMF_ENVIRONMENT;

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, Authorization',
};

type Config = {
  sources?: Record<string, { type: string; baseUrl: string }>;
  entities?: Record<string, { source: string; serverUrl?: string }>;
};

const CONFIG: Config = APP_CONFIG; // just so we get types

// Route parameters
// https://nextjs.org/docs/app/api-reference/file-conventions/route#parameters
type Params = { params: Promise<{ slug: string[] }> };

// Parameters that cause 500 errors on the runtime for specific entities
// Note: shoppingCart now supports status filtering after custom container deployment
const UNSUPPORTED_PARAMS: Record<string, string[]> = {
  // Add entities that need param filtering here
};

/**
 * Example mapping
 * Request: GET /api/tmf-api/billFormat?limit=10
 * - entities.billFormat.serverUrl: '/tmf-api/accountManagement/v5/'
 * - sources.default.baseUrl: 'https://example.com'
 * Upstream: https://example.com/tmf-api/accountManagement/v5/billFormat?limit=10
 */
function buildUpstreamUrl(req: NextRequest, slug: string[]): URL | null {
  for (const [i, segment] of slug.entries()) {
    const entity = CONFIG.entities?.[segment];
    if (!entity) continue;

    const source = CONFIG.sources?.[entity.source];
    if (!source) continue;

    // Build query string, filtering out unsupported params
    const searchParams = new URLSearchParams(req.nextUrl.search);
    const unsupportedForEntity = UNSUPPORTED_PARAMS[segment] || [];
    unsupportedForEntity.forEach(param => searchParams.delete(param));
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';

    const remainder = slug.slice(i).join('/');
    const basePath = entity.serverUrl ?? `/${segment}`;
    const normalized = basePath.endsWith('/') ? basePath : `${basePath}/`;
    const fullPath = entity.serverUrl
      ? `${normalized}${remainder}`
      : `/${remainder}`;

    return new URL(`${fullPath}${query}`, source.baseUrl);
  }

  return null;
}

const handler = async (req: NextRequest, { params }: Params) => {
  const { slug } = await params;

  const fullUrl = buildUpstreamUrl(req, slug);

  if (!fullUrl) {
    return NextResponse.json({ error: 'Entity not found in config' }, { status: 404, headers: corsHeaders });
  }

  // Read body for non-GET requests
  const body = req.method !== 'GET' && req.method !== 'HEAD' 
    ? await req.text() 
    : undefined;

  try {
    const res = await fetch(fullUrl.toString(), {
      method: req.method,
      body,
      headers: {
        'X-API-Key': BSSMAGIC_API_KEY,
        'Content-Type': 'application/json',
        // Add X-Environment header for sandbox routing (if configured)
        ...(TMF_ENVIRONMENT && { 'X-Environment': TMF_ENVIRONMENT }),
      },
    });

    const text = await res.text();
    const json = text ? JSON.parse(text) : null;

    return NextResponse.json(json, {
      status: res.status,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error('TMF API proxy error:', error);
    return NextResponse.json(
      { error: 'Proxy error', detail: String(error) },
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
export async function PUT(req: NextRequest, ctx: Params) {
  return await handler(req, ctx);
}
export async function PATCH(req: NextRequest, ctx: Params) {
  return await handler(req, ctx);
}
export async function DELETE(req: NextRequest, ctx: Params) {
  return await handler(req, ctx);
}
