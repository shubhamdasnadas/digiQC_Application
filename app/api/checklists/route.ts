import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { orgQuery } from '@/lib/db';
import { getLibraryChecklistDetail } from '@/lib/checklistLibrary';
import { ensureChecklistSchema } from '@/lib/checklistSchema';
import { touchProject } from '@/lib/projects';

export async function GET(request: NextRequest) {
  const { payload, response } = requireAuth(request);
  if (!payload) return response;

  await ensureChecklistSchema(payload.orgId!);

  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');

    let queryText = `
      SELECT c.*,
        CASE WHEN p.id IS NOT NULL
          THEN json_build_object('id', p.id, 'name', p.name)
          ELSE NULL
        END AS project,
        (SELECT COUNT(*)::int FROM library_stages ls WHERE ls.library_checklist_id = c.id) AS stage_count,
        (SELECT COUNT(*)::int FROM library_checkpoints lcp JOIN library_stages ls ON lcp.library_stage_id = ls.id WHERE ls.library_checklist_id = c.id) AS checkpoint_count
      FROM library_checklists c
      LEFT JOIN projects p ON c.project_id = p.id
    `;
    const params: any[] = [];

    if (projectId) {
      params.push(projectId);
      queryText += ` WHERE c.project_id = $1`;
    }

    queryText += ` ORDER BY c.created_at DESC`;

    const { rows } = await orgQuery(payload.orgId!, queryText, params);
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { payload, response } = requireAuth(request);
  if (!payload) return response;

  await ensureChecklistSchema(payload.orgId!);

  try {
    const body = await request.json();
    const rows = body.rows ?? [body];
    const touchedProjectIds = new Set<string>();

    for (const row of rows) {
      if (!row.name || !String(row.name).trim()) continue;

      const projectId = row.project_id && String(row.project_id).trim() ? row.project_id : null;
      const refNum = row.reference_number && String(row.reference_number).trim() ? String(row.reference_number).trim() : null;
      const uom = row.uom && String(row.uom).trim() ? String(row.uom).trim() : '';
      const status = row.status || 'draft';

      let checklistId: string;

      // Check if matching checklist already exists for this project
      let existingRows: any[] = [];
      if (projectId && refNum) {
        const res = await orgQuery(payload.orgId!,
          `SELECT id FROM library_checklists WHERE project_id = $1 AND reference_number = $2`,
          [projectId, refNum]
        );
        existingRows = res.rows;
      } else if (projectId) {
        const res = await orgQuery(payload.orgId!,
          `SELECT id FROM library_checklists WHERE project_id = $1 AND name = $2`,
          [projectId, row.name.trim()]
        );
        existingRows = res.rows;
      }

      if (existingRows.length > 0) {
        checklistId = existingRows[0].id;
        await orgQuery(payload.orgId!,
          `UPDATE library_checklists SET name = $1, uom = COALESCE($2, uom), reference_number = COALESCE($3, reference_number), updated_at = NOW() WHERE id = $4`,
          [row.name.trim(), uom, refNum, checklistId]
        );
      } else {
        const { rows: clRows } = await orgQuery(payload.orgId!,
          `INSERT INTO library_checklists (project_id, name, reference_number, uom, status)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          [projectId, row.name.trim(), refNum, uom, status]
        );
        checklistId = clRows[0].id;
      }

      if (projectId) touchedProjectIds.add(projectId);

      // If cloning from a template/library checklist, copy over its stages & checkpoints
      const templateId = row.library_checklist_id || row.template_id;
      if (templateId) {
        const detail = await getLibraryChecklistDetail(templateId);
        if (detail) {
          const { rows: currStages } = await orgQuery(payload.orgId!,
            `SELECT count(*)::int AS count FROM library_stages WHERE library_checklist_id = $1`,
            [checklistId]
          );
          if (parseInt(currStages[0]?.count || '0') === 0) {
            for (const stage of detail.stages) {
              const { rows: stageRows } = await orgQuery(payload.orgId!,
                `INSERT INTO library_stages (library_checklist_id, sr_no, name, witness_required, drawing_required)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING id`,
                [checklistId, stage.sr_no || 1, stage.name, stage.witness_required || false, stage.drawing_required || false]
              );
              const stageId = stageRows[0].id;

              const stageCheckpoints = detail.checkpoints.filter(cp => (cp as any).stage_id === stage.id || (cp as any).library_stage_id === stage.id);
              for (const cp of stageCheckpoints) {
                await orgQuery(payload.orgId!,
                  `INSERT INTO library_checkpoints (library_stage_id, sr_no, question, input_type, photo_required, remark_required)
                   VALUES ($1, $2, $3, $4, $5, $6)`,
                  [
                    stageId,
                    cp.sr_no || 1,
                    cp.question,
                    cp.input_type || 'yes_no',
                    (cp as any).photo_required || false,
                    (cp as any).remark_required || false,
                  ]
                );
              }
            }
          }
        }
      }

      // Handle Stage if specified (e.g. on excel import)
      if (row.stage_name && String(row.stage_name).trim()) {
        const stageName = String(row.stage_name).trim();
        const { rows: existingStages } = await orgQuery(payload.orgId!,
          `SELECT id FROM library_stages WHERE library_checklist_id = $1 AND name = $2`,
          [checklistId, stageName]
        );

        let stageId: string;
        if (existingStages.length > 0) {
          stageId = existingStages[0].id;
        } else {
          const { rows: countRows } = await orgQuery(payload.orgId!,
            `SELECT count(*) AS count FROM library_stages WHERE library_checklist_id = $1`, [checklistId]);
          const nextSrNo = parseInt(countRows[0].count) + 1;

          const { rows: stageRows } = await orgQuery(payload.orgId!,
            `INSERT INTO library_stages (library_checklist_id, sr_no, name, witness_required, drawing_required)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id`,
            [checklistId, nextSrNo, stageName, !!row.witness_required, !!row.drawing_required]
          );
          stageId = stageRows[0].id;
        }

        // Handle Checkpoint if specified
        const cpQuestion = row.checkpoint || row.question;
        if (cpQuestion && String(cpQuestion).trim()) {
          const { rows: cpCount } = await orgQuery(payload.orgId!,
            `SELECT count(*) AS count FROM library_checkpoints WHERE library_stage_id = $1`, [stageId]);
          const nextSrNo = parseInt(cpCount[0].count) + 1;

          await orgQuery(payload.orgId!,
            `INSERT INTO library_checkpoints (library_stage_id, question, input_type, photo_required, remark_required, sr_no)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              stageId,
              String(cpQuestion).trim(),
              row.input_type || 'yes_no',
              !!row.photo_required,
              !!row.remark_required,
              nextSrNo
            ]
          );
        }
      }
    }

    await Promise.all(Array.from(touchedProjectIds).map((pid) => touchProject(payload.orgId!, pid, payload.userId)));
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
