import { NextRequest, NextResponse } from 'next/server';

// WorkOrder API routes - proxies to TMF Runtime (sandbox environment)
// TMF Runtime exposes WorkOrderSchedule/WorkOrder via PostgreSQL views

const ALB_URL = process.env.ALB_URL || 'http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com';
const API_KEY = process.env.BSSMAGIC_API_KEY || 'bssmagic-d58d6761265b01accc13e8b21bae8282';
const TMF_BASE = `${ALB_URL}/tmf-api/workOrderManagement/v5`;

// Helper to forward requests to TMF Runtime
async function tmfFetch(endpoint: string, options?: RequestInit) {
  const url = `${TMF_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'X-API-Key': API_KEY,
      'X-Environment': 'sandbox',
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  return response;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'workOrder';
  const category = searchParams.get('category');
  const limit = searchParams.get('limit') || '100';

  // Build query params for TMF API
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (limit) params.set('limit', limit);
  
  const endpoint = type === 'schedule' ? '/workOrderSchedule' : '/workOrder';
  const queryString = params.toString() ? `?${params.toString()}` : '';
  
  try {
    const response = await tmfFetch(`${endpoint}${queryString}`);
    
    if (!response.ok) {
      // If TMF Runtime fails, return empty array
      console.error(`TMF Runtime error: ${response.status}`);
      return NextResponse.json([]);
    }
    
    const data = await response.json();
    // TMF Runtime may return single object or array - normalize to array
    const results = Array.isArray(data) ? data : (data?.id ? [data] : []);
    return NextResponse.json(results);
  } catch (error) {
    console.error('TMF Runtime fetch error:', error);
    return NextResponse.json([]);
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'workOrder';

  const endpoint = type === 'schedule' ? '/workOrderSchedule' : '/workOrder';
  
  try {
    const response = await tmfFetch(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`TMF Runtime POST error: ${response.status}`, errorText);
      return NextResponse.json(
        { error: 'Failed to create', details: errorText },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('TMF Runtime POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create', details: String(error) },
      { status: 500 }
    );
  }
}
