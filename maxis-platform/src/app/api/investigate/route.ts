import { NextRequest } from 'next/server';
import { runInvestigation } from '@/lib/server/claude-investigator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const entityIds = (body.entity_ids || '').split(',').map((s: string) => s.trim()).filter(Boolean);
    const description = body.description || '';
    const depth = body.depth || 'standard';

    if (!entityIds.length && !description) {
      return new Response(JSON.stringify({ error: 'Provide entity_ids or description' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of runInvestigation({ entityIds, description, depth })) {
            const data = `data: ${JSON.stringify(event)}\n\n`;
            controller.enqueue(encoder.encode(data));
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        } catch (e) {
          const err = `data: ${JSON.stringify({ type: 'error', message: (e as Error).message })}\n\n`;
          controller.enqueue(encoder.encode(err));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
