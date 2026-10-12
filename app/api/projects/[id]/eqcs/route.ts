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
    const location = searchParams.get('location');
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
    if (location) {
      params.push(location);
      where.push(`e.location = $${params.length}`);
    }
    if (q) {
      params.push(`%${q}%`);
      const i = params.length;
      where.push(`(LOWER(e.location) LIKE $${i} OR LOWER(COALESCE(c.name, lc.name, '')) LIKE $${i} OR LOWER(COALESCE(e.maker_team,'')) LIKE $${i} OR LOWER(COALESCE(e.inspector_name,'')) LIKE $${i})`);
    }

    const { rows } = await orgQuery(
      payload.orgId!,
      `SELECT e.*,
              COALESCE(c.name, lc.name) AS checklist_name,
              COALESCE(c.uom, lc.uom) AS checklist_uom,
              COALESCE(NULLIF(e.inspector_name, ''), m.name, u.name, 'Admin') AS inspector_display_name,
              m_app.name AS approver_name
       FROM eqcs e
       -- A checklist now lives in project_checklist, but EQCs created before
       -- the split still point at rows that were in library_checklists.
       LEFT JOIN project_checklist c ON c.id = e.checklist_id
       LEFT JOIN library_checklists lc ON lc.id = e.checklist_id
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
      const location = r.location ?? '';
      const checklistId = r.checklist_id ?? null;
      const inspectorName = r.inspector_name ?? payload.email?.split('@')[0] ?? 'Admin';
      const now = new Date().toISOString();
      const completedAt = r.completed_at ?? now;
      const syncedAt = r.synced_at ?? now;

      const incomingCheckpoints: any[] = Array.isArray(r.inspection_data) ? r.inspection_data : [];
      const incomingStage: any = r.stage_data && typeof r.stage_data === 'object' ? r.stage_data : null;
      const submittedStageIndex = Number(r.stage_index) || Number(incomingStage?.stage_index) || 1;
      const incomingTotal = Number(r.total_stages) || 1;

      // An existing entry that still has stages left is continued rather than
      // duplicated, so one row carries every stage of an inspection.
      const { rows: existingRows } = await orgQuery(
        payload.orgId!,
        `SELECT id, total_stages, inspection_data, stages_data
         FROM eqcs
         WHERE project_id = $1
           AND COALESCE(checklist_id::text, '') = COALESCE($2::text, '')
           AND location = $3
           AND stage_result = 'pending'
         ORDER BY created_at DESC
         LIMIT 1`,
        [id, checklistId, location]
      );
      const existing = existingRows[0] ?? null;

      const parseJsonArray = (value: unknown): any[] => {
        if (Array.isArray(value)) return value;
        if (typeof value === 'string') {
          try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        }
        return [];
      };

      // Merge checkpoint results, replacing anything already recorded for the
      // same checkpoint so re-inspecting a stage overwrites its answers.
      const replacedIds = new Set(
        incomingCheckpoints.map((c) => c?.checkpoint_id).filter(Boolean)
      );
      const mergedCheckpoints = [
        ...parseJsonArray(existing?.inspection_data).filter(
          (c) => !c?.checkpoint_id || !replacedIds.has(c.checkpoint_id)
        ),
        ...incomingCheckpoints,
      ];

      // Same for the per-stage summaries, keyed by stage index.
      const previousStages = parseJsonArray(existing?.stages_data);
      const mergedStages = incomingStage
        ? [
            ...previousStages.filter((s) => Number(s?.stage_index) !== submittedStageIndex),
            { ...incomingStage, stage_index: submittedStageIndex },
          ].sort((a, b) => Number(a.stage_index) - Number(b.stage_index))
        : previousStages;

      const totalStages = existing
        ? Math.max(Number(existing.total_stages) || 1, incomingTotal)
        : incomingTotal;
      const allStagesDone = submittedStageIndex >= totalStages;
      const anyFail = mergedCheckpoints.some((c) => c?.response === 'No');
      const stageResult = allStagesDone ? (anyFail ? 'fail' : 'pass') : 'pending';
      const status = allStagesDone ? (anyFail ? 'failed' : 'passed') : 'pending';
      // While stages remain, the entry reports the stage now in progress.
      const runningStageIndex = allStagesDone ? submittedStageIndex : submittedStageIndex + 1;
      // The inspection as a whole is complete once every stage has been reached.
      const isComplete = allStagesDone;

      if (existing) {
        await orgQuery(
          payload.orgId!,
          `UPDATE eqcs SET
             stage_index = $1, total_stages = $2, stage_result = $3, status = $4,
             completion_status = $5,
             inspection_data = $6::jsonb, stages_data = $7::jsonb,
             maker_team = $8, witness_types = $9, witness_photos = $10, drawing_photos = $11,
             geo_tag = $12, time_taken = $13, completed_at = $14, synced_at = $15,
             inspector_name = $16, inspector_team = $17,
             inspected_by = COALESCE($18, inspected_by), inspected_at = $14
           WHERE id = $19 AND project_id = $20`,
          [
            runningStageIndex,
            totalStages,
            stageResult,
            status,
            isComplete,
            JSON.stringify(mergedCheckpoints),
            JSON.stringify(mergedStages),
            r.maker_team ?? '',
            r.witness_types ?? [],
            r.witness_photos ?? [],
            r.drawing_photos ?? [],
            r.geo_tag ?? '',
            r.time_taken ?? '',
            completedAt,
            syncedAt,
            inspectorName,
            r.inspector_team ?? '',
            r.inspected_by ?? (payload.userId || null),
            existing.id,
            id,
          ]
        );
      } else {
        await orgQuery(
          payload.orgId!,
          `INSERT INTO eqcs
             (project_id, location, checklist_id, stage_index, total_stages,
              stage_result, completion_status, approver_id, approver_log, status, inspected_by,
              inspected_at, rfi_id, notes, assigned_user_ids, assigned_team_ids,
              maker_team, witness_types, witness_photos, drawing_photos,
              inspection_data, stages_data, geo_tag, time_taken, completed_at, synced_at,
              inspector_name, inspector_team)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28)`,
          [
            id,
            location,
            checklistId,
            runningStageIndex,
            totalStages,
            stageResult,
            isComplete,
            r.approver_id ?? null,
            r.approver_log ?? '',
            status,
            r.inspected_by ?? (payload.userId || null),
            r.inspected_at ?? now,
            r.rfi_id ?? null,
            r.notes ?? '',
            r.assigned_user_ids ?? [],
            r.assigned_team_ids ?? [],
            r.maker_team ?? '',
            r.witness_types ?? [],
            r.witness_photos ?? [],
            r.drawing_photos ?? [],
            JSON.stringify(mergedCheckpoints),
            JSON.stringify(mergedStages),
            r.geo_tag ?? '',
            r.time_taken ?? '',
            completedAt,
            syncedAt,
            inspectorName,
            r.inspector_team ?? '',
          ]
        );
      }

      // Reflect the assignment on the linked teams so the project's Teams tab
      // can show which checklist/user each team was just assigned.
      const teamIds: string[] = r.assigned_team_ids ?? [];
      if (teamIds.length > 0 && r.checklist_id) {
        const { rows: clRows } = await orgQuery(
          payload.orgId!,
          `SELECT COALESCE(
                    (SELECT name FROM project_checklist WHERE id = $1),
                    (SELECT name FROM library_checklists WHERE id = $1)
                  ) AS name`,
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
            `UPDATE project_checklist SET status = 'live', updated_at = NOW() WHERE id = $1`,
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

/**
 * DELETE /api/projects/[id]/eqcs?eqc_id=...
 */
export async function DELETE(request: NextRequest, ctx: RouteContext) {
  const { payload, response } = requireAuth(request);
  if (!payload) return response;
  const { id: projectId } = await ctx.params;

  try {
    const { searchParams } = new URL(request.url);
    const eqcId = searchParams.get('eqc_id') || searchParams.get('id');
    if (!eqcId) {
      return NextResponse.json({ error: 'Missing eqc_id parameter' }, { status: 400 });
    }

    await orgQuery(
      payload.orgId ?? null,
      `DELETE FROM eqcs WHERE id = $1 AND project_id = $2`,
      [eqcId, projectId]
    );

    if (payload.orgId) {
      await touchProject(payload.orgId, projectId, payload.userId);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

