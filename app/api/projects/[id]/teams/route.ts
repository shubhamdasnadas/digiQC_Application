import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { orgQuery } from '@/lib/db';

interface RouteContext { params: Promise<{ id: string }>; }

/**
 * GET /api/projects/[id]/teams
 * Returns the teams assigned to the project.
 */
export async function GET(request: NextRequest, ctx: RouteContext) {
  const { payload, response } = requireAuth(request);
  if (!payload) return response;
  const { id } = await ctx.params;
  try {
    const { rows } = await orgQuery(
      payload.orgId!,
      `SELECT pt.id, pt.project_id, pt.team_id, pt.added_at,
              pt.assigned_checklist, pt.assigned_user,
              t.name AS team_name, t.type AS team_type,
              t.team_lead_name, t.spoc_name
       FROM project_teams pt
       JOIN teams t ON t.id = pt.team_id
       WHERE pt.project_id = $1
       ORDER BY pt.added_at`,
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
      if (!r.team_id) continue;
      await orgQuery(
        payload.orgId!,
        `INSERT INTO project_teams (project_id, team_id)
         VALUES ($1,$2)
         ON CONFLICT (project_id, team_id) DO NOTHING`,
        [id, r.team_id]
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, ctx: RouteContext) {
  const { payload, response } = requireAuth(request);
  if (!payload) return response;
  const { id } = await ctx.params;
  try {
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('team_id');
    if (!teamId) return NextResponse.json({ error: 'Missing team_id' }, { status: 400 });
    await orgQuery(
      payload.orgId!,
      `DELETE FROM project_teams WHERE project_id = $1 AND team_id = $2`,
      [id, teamId]
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
