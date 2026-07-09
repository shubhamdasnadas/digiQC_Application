import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { orgQuery } from '@/lib/db';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/projects/[id]/eqcs
 * Filters via query string: rfi, status, checklist_id, user_id, team_id, q
 */
export async function GET(request: NextRequest, ctx: RouteContext) {
  const { payload, response } = requireAuth(request);
  if (!payload) return response;
  const { id } = await ctx.params;

  try {
    const { searchParams } = new URL(request.url);
    const rfi = searchParams.get('rfi');
    const status = searchParams.get('status');
    const checklistId = searchParams.get('checklist_id');
    const userId = searchParams.get('user_id');
    const q = searchParams.get('q')?.toLowerCase().trim();

    const where: string[] = ['e.project_id = $1'];
    const params: any[] = [id];

    if (rfi === '1') where.push('e.rfi_id IS NOT NULL');
    if (rfi === 'overdue') {
      where.push('e.rfi_id IS NOT NULL');
      where.push(`e.status NOT IN ('passed','failed')`);
    }
    if (status && status !== 'all') {
      params.push(status);
      where.push(`e.status = $${params.length}`);
    }
    if (checklistId) {
      params.push(checklistId);
      where.push(`e.checklist_id = $${params.length}`);
    }
    if (userId) {
      params.push(userId);
      where.push(`e.inspected_by = $${params.length}`);
    }
    if (q) {
      params.push(`%${q}%`);
      const i = params.length;
      where.push(`(LOWER(e.location) LIKE $${i} OR LOWER(COALESCE(c.name,'')) LIKE $${i})`);
    }

    const { rows } = await orgQuery(
      payload.orgId!,
      `SELECT e.*,
              c.name AS checklist_name
       FROM eqcs e
       LEFT JOIN checklists c ON c.id = e.checklist_id
       WHERE ${where.join(' AND ')}
       ORDER BY e.created_at DESC`,
      params
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
        `INSERT INTO eqcs
           (project_id, location, checklist_id, stage_index, total_stages,
            stage_result, approver_id, approver_log, status, inspected_by,
            inspected_at, rfi_id, notes, assigned_user_ids, assigned_team_ids)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [
          id,
          r.location ?? '',
          r.checklist_id ?? null,
          r.stage_index ?? 1,
          r.total_stages ?? 1,
          r.stage_result ?? 'pending',
          r.approver_id ?? null,
          r.approver_log ?? '',
          r.status ?? 'pending',
          r.inspected_by ?? payload.userId,
          r.inspected_at ?? new Date().toISOString(),
          r.rfi_id ?? null,
          r.notes ?? '',
          r.assigned_user_ids ?? [],
          r.assigned_team_ids ?? [],
        ]
      );

      // Reflect the assignment on the linked teams so the project's Teams tab
      // can show which checklist/user each team was just assigned.
      const teamIds: string[] = r.assigned_team_ids ?? [];
      if (teamIds.length > 0 && r.checklist_id) {
        const { rows: clRows } = await orgQuery(
          payload.orgId!,
          `SELECT name FROM checklists WHERE id = $1`,
          [r.checklist_id]
        );
        const checklistName = clRows[0]?.name ?? '';

        const userIds: string[] = r.assigned_user_ids ?? [];
        let userNames = '';
        if (userIds.length > 0) {
          const { rows: userRows } = await orgQuery(
            payload.orgId!,
            `SELECT name FROM members WHERE id = ANY($1::uuid[])`,
            [userIds]
          );
          userNames = userRows.map((u: { name: string }) => u.name).join(', ');
        }

        await orgQuery(
          payload.orgId!,
          `UPDATE project_teams
           SET assigned_checklist = $1, assigned_user = $2
           WHERE project_id = $3 AND team_id = ANY($4::uuid[])`,
          [checklistName, userNames, id, teamIds]
        );

        // A checklist only goes live once it has both a team and a user assigned.
        if (userIds.length > 0) {
          await orgQuery(
            payload.orgId!,
            `UPDATE checklists SET status = 'live' WHERE id = $1`,
            [r.checklist_id]
          );
        }
      }
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
