import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { orgQuery } from '@/lib/db';
import { listLibraryChecklists, getLibraryChecklistDetail } from '@/lib/checklistLibrary';
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
        (SELECT COUNT(*)::int FROM checklist_stages cs WHERE cs.checklist_id = c.id) AS stage_count,
        (SELECT COUNT(*)::int FROM checkpoints cp JOIN checklist_stages cs ON cp.stage_id = cs.id WHERE cs.checklist_id = c.id) AS checkpoint_count
      FROM checklists c
      LEFT JOIN projects p ON c.project_id = p.id
    `;
    const params: any[] = [];

    if (projectId) {
      params.push(projectId);
      queryText += ` WHERE c.project_id = $1`;
    }

    queryText += ` ORDER BY c.created_at DESC`;

    const { rows } = await orgQuery(payload.orgId!, queryText, params);

    if (projectId) {
      return NextResponse.json(rows);
    }

    const libraryChecklists = await listLibraryChecklists();
    const existingIds = new Set(rows.map((r: any) => r.id));
    const uniqueLibrary = libraryChecklists.filter(lc => !existingIds.has(lc.id));

    return NextResponse.json([...rows, ...uniqueLibrary]);
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
      const uom = row.uom && String(row.uom).trim() ? String(row.uom).trim() : null;
      const status = row.status || 'draft';

      let checklistId: string;

      // 1. Check if matching checklist already exists
      let existingRows: any[] = [];
      if (projectId && refNum) {
        const res = await orgQuery(payload.orgId!,
          `SELECT id FROM checklists WHERE project_id = $1 AND reference_number = $2`,
          [projectId, refNum]
        );
        existingRows = res.rows;
      } else if (projectId) {
        const res = await orgQuery(payload.orgId!,
          `SELECT id FROM checklists WHERE project_id = $1 AND name = $2`,
          [projectId, row.name.trim()]
        );
        existingRows = res.rows;
      }

      if (existingRows.length > 0) {
        checklistId = existingRows[0].id;
        await orgQuery(payload.orgId!,
          `UPDATE checklists SET name = $1, uom = COALESCE($2, uom), reference_number = COALESCE($3, reference_number), updated_at = NOW() WHERE id = $4`,
          [row.name.trim(), uom, refNum, checklistId]
        );
      } else {
        const { rows: clRows } = await orgQuery(payload.orgId!,
          `INSERT INTO checklists (project_id, name, reference_number, uom, status)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          [projectId, row.name.trim(), refNum, uom, status]
        );
        checklistId = clRows[0].id;
      }

      if (projectId) touchedProjectIds.add(projectId);

      // If cloning from the shared library, copy over its stages/checkpoints
      if (row.library_checklist_id) {
        const detail = await getLibraryChecklistDetail(row.library_checklist_id);
        if (detail) {
          for (const stage of detail.stages) {
            const { rows: stageRows } = await orgQuery(payload.orgId!,
              `INSERT INTO checklist_stages (checklist_id, sr_no, name, witness_required, drawing_required)
               VALUES ($1, $2, $3, $4, $5)
               RETURNING id`,
              [checklistId, stage.sr_no || 1, stage.name, stage.witness_required || false, stage.drawing_required || false]
            );
            const stageId = stageRows[0].id;

            const stageCheckpoints = detail.checkpoints.filter(cp => cp.stage_id === stage.id);
            for (const cp of stageCheckpoints) {
              await orgQuery(payload.orgId!,
                `INSERT INTO checkpoints (stage_id, sr_no, question, input_type, drawing_required, witness_required, photo_required, remark_required)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [
                  stageId,
                  cp.sr_no || 1,
                  cp.question,
                  cp.input_type || 'yes_no',
                  cp.drawing_required || false,
                  cp.witness_required || false,
                  (cp as any).photo_required || false,
                  (cp as any).remark_required || false,
                ]
              );
            }
          }
        }
      }

      // 2. Handle Stage if specified (e.g. on excel import or combined create)
      if (row.stage_name && String(row.stage_name).trim()) {
        const stageName = String(row.stage_name).trim();
        const { rows: existingStages } = await orgQuery(payload.orgId!,
          `SELECT id FROM checklist_stages WHERE checklist_id = $1 AND name = $2`,
          [checklistId, stageName]
        );

        let stageId: string;
        if (existingStages.length > 0) {
          stageId = existingStages[0].id;
        } else {
          const { rows: countRows } = await orgQuery(payload.orgId!,
            `SELECT count(*) AS count FROM checklist_stages WHERE checklist_id = $1`, [checklistId]);
          const nextSrNo = parseInt(countRows[0].count) + 1;

          const { rows: stageRows } = await orgQuery(payload.orgId!,
            `INSERT INTO checklist_stages (checklist_id, sr_no, name, witness_required, drawing_required)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id`,
            [checklistId, nextSrNo, stageName, !!row.witness_required, !!row.drawing_required]
          );
          stageId = stageRows[0].id;
        }

        // 3. Handle Checkpoint if specified
        const cpQuestion = row.checkpoint || row.question;
        if (cpQuestion && String(cpQuestion).trim()) {
          const { rows: cpCount } = await orgQuery(payload.orgId!,
            `SELECT count(*) AS count FROM checkpoints WHERE stage_id = $1`, [stageId]);
          const nextSrNo = parseInt(cpCount[0].count) + 1;

          await orgQuery(payload.orgId!,
            `INSERT INTO checkpoints (stage_id, question, input_type, drawing_required, witness_required, photo_required, remark_required, sr_no)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              stageId,
              String(cpQuestion).trim(),
              row.input_type || 'yes_no',
              !!row.drawing_required,
              !!row.witness_required,
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
