import { NextRequest, NextResponse } from 'next/server';

// In-memory storage - shared with parent route
// In production, this would connect to PostgreSQL
const schedules: Map<string, object> = new Map();
const workOrders: Map<string, object> = new Map();

// Re-export storage for parent route
export { schedules, workOrders };

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'workOrder';

  const store = type === 'schedule' ? schedules : workOrders;
  const item = store.get(id);

  if (!item) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(item);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'workOrder';

  const store = type === 'schedule' ? schedules : workOrders;
  const existing = store.get(id);

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const updated = { ...existing, ...body, id };
  store.set(id, updated);

  return NextResponse.json(updated);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'workOrder';

  const store = type === 'schedule' ? schedules : workOrders;
  
  if (!store.has(id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  store.delete(id);
  return new NextResponse(null, { status: 204 });
}
