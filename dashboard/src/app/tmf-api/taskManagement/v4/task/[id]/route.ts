import { NextRequest, NextResponse } from 'next/server';
import { getTask } from '@/lib/task-store';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const task = getTask(id);
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  return NextResponse.json(task);
}









