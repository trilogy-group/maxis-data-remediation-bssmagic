import { NextRequest, NextResponse } from 'next/server';
import { getAllTribal, getAllDetections, saveTribal, saveDetection } from '@/lib/server/knowledge-store';
import { executeSOQL } from '@/lib/server/salesforce';

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get('type') || 'all';

  if (type === 'tribal') return NextResponse.json(getAllTribal());
  if (type === 'detections') return NextResponse.json(getAllDetections());

  return NextResponse.json({
    tribal: getAllTribal(),
    detections: getAllDetections(),
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.action === 'save_tribal') {
      saveTribal(body.entry);
      return NextResponse.json({ status: 'saved', id: body.entry.id });
    }

    if (body.action === 'save_detection') {
      saveDetection(body.entry);
      return NextResponse.json({ status: 'saved', name: body.entry.name });
    }

    if (body.action === 'run_detection') {
      const det = getAllDetections().find(d => d.name === body.name);
      if (!det) return NextResponse.json({ error: 'Detection not found' }, { status: 404 });
      const query = `SELECT COUNT() FROM ${det.object_type} WHERE ${det.soql_condition}`;
      const result = await executeSOQL(query);
      return NextResponse.json({ detection: det.name, query, result });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
