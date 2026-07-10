import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { orgQuery } from '@/lib/db';
import { touchProject } from '@/lib/projects';

interface RouteContext { params: Promise<{ id: string }>; }

export async function GET(request: NextRequest, ctx: RouteContext) {
  const { payload, response } = requireAuth(request);
  if (!payload) return response;
  const { id } = await ctx.params;
  try {
    const { rows } = await orgQuery(
      payload.orgId!,
      `SELECT * FROM project_targets WHERE project_id = $1 ORDER BY created_at DESC`,
      [id]
    );
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest, ctx: RouteContext) {
  const { payload, response } = requireAuth(request);
  if (!payload) return response;
  const { id } = await ctx.params;
  try {
    const body = await request.json();
    const rows = body.rows ?? [body];
    for (const r of rows) {
      await orgQuery(
        payload.orgId!,
        `INSERT INTO project_targets
           (project_id, metric, target_value, current_value, unit, period)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          id,
          r.metric,
          r.target_value ?? 0,
          r.current_value ?? 0,
          r.unit ?? '',
          r.period ?? 'monthly',
        ]
      );
    }
    await touchProject(payload.orgId!, id, payload.userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
