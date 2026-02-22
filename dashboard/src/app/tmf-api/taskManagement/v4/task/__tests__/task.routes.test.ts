import { describe, expect, it, vi } from 'vitest';
import { POST } from '../route';
import { GET } from '../[id]/route';

describe('TMF Task routes (SolutionEmptyRemediationTask)', () => {
  it('returns 400 when relatedEntity solution id is missing', async () => {
    const req = {
      json: async () => ({ '@type': 'SolutionEmptyRemediationTask' }),
    } as any;

    const res = await POST(req);
    expect(res.status).toBe(400);
    const payload = await res.json();
    expect(payload.error).toMatch(/required/i);
  });

  it('creates a task and completes immediately in dryRun mode (done)', async () => {
    // Ensure the fire-and-forget branch doesn't do real network IO.
    const fetchSpy = vi.spyOn(globalThis, 'fetch' as any);

    const req = {
      json: async () => ({
        '@type': 'SolutionEmptyRemediationTask',
        name: 'Test - dryRun',
        relatedEntity: [{ id: 'a1Bxx0000000001', role: 'solution', '@referredType': 'Product' }],
        characteristic: [
          { name: 'mode', value: 'smart' },
          { name: 'dryRun', value: 'true' },
        ],
      }),
    } as any;

    const created = await POST(req);
    expect(created.status).toBe(201);
    const createdTask = await created.json();
    expect(createdTask.id).toBeTruthy();
    expect(createdTask.state).toBe('done');

    const res = await GET({} as any, { params: Promise.resolve({ id: createdTask.id }) } as any);
    expect(res.status).toBe(200);
    const latest = await res.json();
    expect(latest.state).toBe('done');

    // dryRun should not call the gateway
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});


