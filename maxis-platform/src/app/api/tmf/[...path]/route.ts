import { NextRequest, NextResponse } from 'next/server';

const ALB_URL = process.env.ALB_URL || 'http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com';
const API_KEY = process.env.API_KEY || 'bssmagic-d58d6761265b01accc13e8b21bae8282';

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const targetPath = '/' + path.join('/');
  const url = new URL(targetPath, ALB_URL);
  request.nextUrl.searchParams.forEach((v, k) => url.searchParams.set(k, v));

  try {
    const res = await fetch(url.toString(), {
      headers: { 'X-API-Key': API_KEY },
      cache: 'no-store',
    });
    const data = await res.text();
    return new NextResponse(data, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('Content-Type') || 'application/json' },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const targetPath = '/' + path.join('/');
  const url = new URL(targetPath, ALB_URL);
  const body = await request.text();

  try {
    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' },
      body,
    });
    const data = await res.text();
    return new NextResponse(data, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('Content-Type') || 'application/json' },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const targetPath = '/' + path.join('/');
  const url = new URL(targetPath, ALB_URL);

  try {
    const res = await fetch(url.toString(), {
      method: 'DELETE',
      headers: { 'X-API-Key': API_KEY },
    });
    const data = await res.text();
    return new NextResponse(data, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('Content-Type') || 'application/json' },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
