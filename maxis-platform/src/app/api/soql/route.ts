import { NextRequest, NextResponse } from 'next/server';
import { executeSOQL, describeObject, listObjects } from '@/lib/server/salesforce';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.type === 'list_objects') {
      const result = await listObjects(body.search);
      return NextResponse.json({ objects: result, count: result.length });
    }

    if (body.type === 'describe') {
      if (!body.object_name) return NextResponse.json({ error: 'Missing object_name' }, { status: 400 });
      const result = await describeObject(body.object_name);
      return NextResponse.json(result);
    }

    if (!body.query) {
      return NextResponse.json({ error: 'Missing "query" field. Use type: "list_objects" | "describe" | provide a "query"' }, { status: 400 });
    }

    const result = await executeSOQL(body.query);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
