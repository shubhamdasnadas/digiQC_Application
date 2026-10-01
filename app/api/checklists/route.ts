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
        COALESCE(u.name, m.name, c.updated_by, 'Admin') AS updated_by,
        CASE WHEN p.id IS NOT NULL
          THEN json_build_object('id', p.id, 'name', p.name)
          ELSE NULL
        END AS project,
        (SELECT COUNT(*)::int FROM library_stages ls WHERE ls.library_checklist_id = c.id) AS stage_count,
        (SELECT COUNT(*)::int FROM library_checkpoints lcp JOIN library_stages ls ON lcp.library_stage_id = ls.id WHERE ls.library_checklist_id = c.id) AS checkpoint_count
      FROM library_checklists c
      LEFT JOIN projects p ON c.project_id = p.id
      LEFT JOIN users u ON c.updated_by::text = u.id::text
      LEFT JOIN members m ON c.updated_by::text = m.id::text
    `;
    const params: any[] = [];

    if (projectId) {
      params.push(projectId);
      queryText += ` WHERE c.project_id = $1`;
    }

    queryText += ` ORDER BY c.created_at DESC, c.updated_at DESC`;

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

      // Check if matching checklist already exists
      let existingRows: any[] = [];
      if (projectId) {
        if (refNum) {
          const res = await orgQuery(payload.orgId!,
            `SELECT id, name, reference_number, uom FROM library_checklists WHERE project_id = $1 AND reference_number = $2`,
            [projectId, refNum]
          );
          existingRows = res.rows;
        }
        if (existingRows.length === 0) {
          const res = await orgQuery(payload.orgId!,
            `SELECT id, name, reference_number, uom FROM library_checklists WHERE project_id = $1 AND name = $2`,
            [projectId, row.name.trim()]
          );
          existingRows = res.rows;
        }
      } else {
        // Global / Library checklist (project_id IS NULL)
        if (refNum) {
          const res = await orgQuery(payload.orgId!,
            `SELECT id, name, reference_number, uom FROM library_checklists WHERE project_id IS NULL AND reference_number = $1`,
            [refNum]
          );
          existingRows = res.rows;
        }
        if (existingRows.length === 0) {
          const res = await orgQuery(payload.orgId!,
            `SELECT id, name, reference_number, uom FROM library_checklists WHERE project_id IS NULL AND name = $1`,
            [row.name.trim()]
          );
          existingRows = res.rows;
        }
      }

      if (existingRows.length > 0) {
        checklistId = existingRows[0].id;
        const updatedRefNum = refNum || (existingRows[0]?.reference_number ?? '');
        const updatedUom = uom || (existingRows[0]?.uom ?? '');
        await orgQuery(payload.orgId!,
          `UPDATE library_checklists
           SET name = $1,
               uom = $2,
               reference_number = $3,
               updated_by = $4,
               updated_at = NOW(),
               created_at = COALESCE(created_at, NOW())
           WHERE id = $5`,
          [row.name.trim(), updatedUom, updatedRefNum, payload.userId || null, checklistId]
        );
      } else {
        const { rows: clRows } = await orgQuery(payload.orgId!,
          `INSERT INTO library_checklists (project_id, name, reference_number, uom, status, updated_by, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
           RETURNING id`,
          [projectId, row.name.trim(), refNum || '', uom, status, payload.userId || null]
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
      const stageName = row.stage_name && String(row.stage_name).trim() ? String(row.stage_name).trim() : (row.checkpoint || row.question ? 'Single Stage' : null);
      if (stageName) {
        const { rows: existingStages } = await orgQuery(payload.orgId!,
          `SELECT id FROM library_stages WHERE library_checklist_id = $1 AND name = $2`,
          [checklistId, stageName]
        );

        let stageId: string;
        if (existingStages.length > 0) {
          stageId = existingStages[0].id;
        } else {
          const { rows: countRows } = await orgQuery(payload.orgId!,
            `SELECT COALESCE(MAX(sr_no), 0) + 1 AS next_sr_no FROM library_stages WHERE library_checklist_id = $1`, [checklistId]);
          const nextSrNo = parseInt(countRows[0].next_sr_no);

          const { rows: stageRows } = await orgQuery(payload.orgId!,
            `INSERT INTO library_stages (library_checklist_id, sr_no, name, witness_required, drawing_required, created_at)
             VALUES ($1, $2, $3, $4, $5, NOW())
             RETURNING id`,
            [checklistId, nextSrNo, stageName, !!row.witness_required, !!row.drawing_required]
          );
          stageId = stageRows[0].id;
        }

        // Handle Checkpoint if specified
        const cpQuestion = row.checkpoint || row.question;
        if (cpQuestion && String(cpQuestion).trim()) {
          const qText = String(cpQuestion).trim();
          const { rows: existingCp } = await orgQuery(payload.orgId!,
            `SELECT id FROM library_checkpoints
             WHERE library_stage_id = $1 AND (TRIM(question) = TRIM($2) OR LOWER(TRIM(question)) = LOWER(TRIM($2)))`,
            [stageId, qText]
          );

          if (existingCp.length > 0) {
            await orgQuery(payload.orgId!,
              `UPDATE library_checkpoints
               SET question = $1, input_type = $2, photo_required = $3, remark_required = $4
               WHERE id = $5`,
              [qText, row.input_type || 'yes_no', !!row.photo_required, !!row.remark_required, existingCp[0].id]
            );
          } else {
            const { rows: cpCount } = await orgQuery(payload.orgId!,
              `SELECT COALESCE(MAX(sr_no), 0) + 1 AS next_sr_no FROM library_checkpoints WHERE library_stage_id = $1`, [stageId]);
            const nextSrNo = parseInt(cpCount[0].next_sr_no);

            await orgQuery(payload.orgId!,
              `INSERT INTO library_checkpoints (library_stage_id, question, input_type, photo_required, remark_required, sr_no, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
              [
                stageId,
                qText,
                row.input_type || 'yes_no',
                !!row.photo_required,
                !!row.remark_required,
                nextSrNo
              ]
            );
          }
        }
      }
    }

    await Promise.all(Array.from(touchedProjectIds).map((pid) => touchProject(payload.orgId!, pid, payload.userId)));
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
