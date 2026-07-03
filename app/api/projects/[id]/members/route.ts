import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { orgQuery } from '@/lib/db';

interface RouteContext { params: Promise<{ id: string }>; }

/**
 * GET /api/projects/[id]/members
 * Returns the project's members (joined with name/email from public.users).
 */
export async function GET(request: NextRequest, ctx: RouteContext) {
  const { payload, response } = requireAuth(request);
  if (!payload) return response;
  const { id } = await ctx.params;
  try {
    const { rows } = await orgQuery(
      payload.orgId!,
      `SELECT pm.id, pm.project_id, pm.user_id, pm.role, pm.added_at,
              u.name AS user_name, u.email AS user_email, u.avatar_url AS user_avatar
       FROM project_members pm
       JOIN public.users u ON u.id = pm.user_id
       WHERE pm.project_id = $1
       ORDER BY pm.added_at`,
      [id]
    );
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

/**
 * POST /api/projects/[id]/members
 * Body: { user_id, role }
 * Idempotent — ON CONFLICT updates the role.
 */
export async function POST(request: NextRequest, ctx: RouteContext) {
  const { payload, response } = requireAuth(request);
  if (!payload) return response;
  const { id } = await ctx.params;
  try {
    const body = await request.json();
    const rows = body.rows ?? [body];
    for (const r of rows) {
      if (!r.user_id) continue;
      await orgQuery(
        payload.orgId!,
        `INSERT INTO project_members (project_id, user_id, role)
         VALUES ($1,$2,$3)
         ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
        [id, r.user_id, r.role ?? 'member']
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

/**
 * DELETE /api/projects/[id]/members?user_id=...
 */
export async function DELETE(request: NextRequest, ctx: RouteContext) {
  const { payload, response } = requireAuth(request);
  if (!payload) return response;
  const { id } = await ctx.params;
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    if (!userId) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
    await orgQuery(
      payload.orgId!,
      `DELETE FROM project_members WHERE project_id = $1 AND user_id = $2`,
      [id, userId]
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
