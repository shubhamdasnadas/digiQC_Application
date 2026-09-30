import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { orgQuery } from '@/lib/db';
import { touchProject } from '@/lib/projects';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/projects/[id]/eqcs
 * Filters via query string: rfi, status, checklist_id, user_id, maker_team, stage_status, q
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
    const makerTeam = searchParams.get('maker_team');
    const stageStatus = searchParams.get('stage_status');
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
    if (checklistId && checklistId !== 'all') {
      params.push(checklistId);
      where.push(`e.checklist_id = $${params.length}`);
    }
    if (userId && userId !== 'all') {
      params.push(userId);
      where.push(`(e.inspected_by = $${params.length} OR LOWER(COALESCE(e.inspector_name, '')) = LOWER($${params.length}))`);
    }
    if (makerTeam && makerTeam !== 'all') {
      params.push(makerTeam);
      where.push(`LOWER(COALESCE(e.maker_team, '')) = LOWER($${params.length})`);
    }
    if (stageStatus && stageStatus !== 'all') {
      params.push(stageStatus);
      where.push(`e.stage_result = $${params.length}`);
    }
    if (q) {
      params.push(`%${q}%`);
      const i = params.length;
      where.push(`(LOWER(e.location) LIKE $${i} OR LOWER(COALESCE(c.name,'')) LIKE $${i} OR LOWER(COALESCE(e.maker_team,'')) LIKE $${i} OR LOWER(COALESCE(e.inspector_name,'')) LIKE $${i})`);
    }

    const { rows } = await orgQuery(
      payload.orgId!,
      `SELECT e.*,
              c.name AS checklist_name,
              c.uom AS checklist_uom,
              COALESCE(NULLIF(e.inspector_name, ''), m.name, u.name, 'Admin') AS inspector_display_name,
              m_app.name AS approver_name
       FROM eqcs e
       LEFT JOIN library_checklists c ON c.id = e.checklist_id
       LEFT JOIN members m ON m.id = e.inspected_by
       LEFT JOIN users u ON u.id = e.inspected_by
       LEFT JOIN members m_app ON m_app.id = e.approver_id
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
      const stageResult = r.stage_result ?? 'pass';
      const status = r.status ?? (stageResult === 'fail' ? 'failed' : 'passed');
      const inspectedAt = r.inspected_at ?? new Date().toISOString();
      const completedAt = r.completed_at ?? new Date().toISOString();
      const syncedAt = r.synced_at ?? new Date().toISOString();
      const inspectorName = r.inspector_name ?? payload.email?.split('@')[0] ?? 'Admin';

      await orgQuery(
        payload.orgId!,
        `INSERT INTO eqcs
           (project_id, location, checklist_id, stage_index, total_stages,
            stage_result, approver_id, approver_log, status, inspected_by,
            inspected_at, rfi_id, notes, assigned_user_ids, assigned_team_ids,
            maker_team, witness_types, witness_photos, drawing_photos,
            inspection_data, geo_tag, time_taken, completed_at, synced_at,
            inspector_name, inspector_team)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)`,
        [
          id,
          r.location ?? '',
          r.checklist_id ?? null,
          r.stage_index ?? 1,
          r.total_stages ?? 1,
          stageResult,
          r.approver_id ?? null,
          r.approver_log ?? '',
          status,
          r.inspected_by ?? (payload.userId || null),
          inspectedAt,
          r.rfi_id ?? null,
          r.notes ?? '',
          r.assigned_user_ids ?? [],
          r.assigned_team_ids ?? [],
          r.maker_team ?? '',
          r.witness_types ?? [],
          r.witness_photos ?? [],
          r.drawing_photos ?? [],
          JSON.stringify(r.inspection_data ?? []),
          r.geo_tag ?? '19.0760° N, 72.8777° E',
          r.time_taken ?? '12 mins',
          completedAt,
          syncedAt,
          inspectorName,
          r.inspector_team ?? '',
        ]
      );

      // Reflect the assignment on the linked teams so the project's Teams tab
      // can show which checklist/user each team was just assigned.
      const teamIds: string[] = r.assigned_team_ids ?? [];
      if (teamIds.length > 0 && r.checklist_id) {
        const { rows: clRows } = await orgQuery(
          payload.orgId!,
          `SELECT name FROM library_checklists WHERE id = $1`,
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
            `UPDATE library_checklists SET status = 'live' WHERE id = $1`,
            [r.checklist_id]
          );
        }
      }
    }
    await touchProject(payload.orgId!, id, payload.userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
