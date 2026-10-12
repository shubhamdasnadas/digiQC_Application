import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getSchemaClient, orgQuery } from '@/lib/db';
import { CHECKLIST_TABLES, resolveChecklistScope, type ChecklistScope } from '@/lib/checklistLibrary';
import { ensureChecklistSchema } from '@/lib/checklistSchema';
import { touchProject } from '@/lib/projects';

/** One checkpoint as sent by the Add Checklist form. */
interface IncomingCheckpoint {
  question?: string;
  name?: string;
  input_type?: string;
  photo_required?: boolean;
  remark_required?: boolean;
}

/** One stage (with its checkpoints) as sent by the Add Checklist form. */
interface IncomingStage {
  name?: string;
  witness_required?: boolean;
  drawing_required?: boolean;
  checkpoints?: IncomingCheckpoint[];
}

export async function GET(request: NextRequest) {
  const { payload, response } = requireAuth(request);
  if (!payload) return response;

  await ensureChecklistSchema(payload.orgId!);

  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');
    const isExport = searchParams.get('export') === 'true';

    if (isExport) {
      const exportQuery = `
        SELECT
          c.name AS "Checklist Name",
          COALESCE(c.reference_number, '') AS "REFERENCE NUMBER",
          COALESCE(ps.name, 'Single Stage') AS "Stage Name",
          COALESCE(pcp.question, '') AS "Checkpoint",
          CASE
            WHEN pcp.input_type = 'yes_no' THEN 'Y/N'
            WHEN pcp.input_type = 'text' THEN 'TEXT'
            WHEN pcp.input_type = 'numeric' THEN 'NUMERIC'
            WHEN pcp.input_type = 'options' THEN 'OPTIONS'
            WHEN pcp.input_type = 'date' THEN 'DATE'
            ELSE 'Y/N'
          END AS "Type",
          CASE WHEN pcp.photo_required IS TRUE THEN 'TRUE' ELSE 'FALSE' END AS "Photo",
          CASE WHEN pcp.remark_required IS TRUE THEN 'TRUE' ELSE 'FALSE' END AS "Remark",
          COALESCE(c.uom, '') AS "UOM",
          COALESCE(c.status, 'draft') AS "Status",
          COALESCE(u.name, m.name, c.updated_by::text, 'Admin') AS "Updated By",
          COALESCE(c.updated_at, c.created_at) AS "Updated At"
        FROM project_checklist c
        LEFT JOIN projects p ON c.project_id = p.id
        LEFT JOIN project_stage ps ON ps.project_checklist_id = c.id
        LEFT JOIN project_checkpoints pcp ON pcp.project_stage_id = ps.id
        LEFT JOIN users u ON c.updated_by::text = u.id::text
        LEFT JOIN members m ON c.updated_by::text = m.id::text
        ${projectId ? 'WHERE c.project_id = $1' : ''}
        ORDER BY c.created_at DESC, ps.sr_no ASC, pcp.sr_no ASC
      `;
      const { rows: exportRows } = await orgQuery(
        payload.orgId!,
        exportQuery,
        projectId ? [projectId] : []
      );
      return NextResponse.json(exportRows);
    }

    // Project checklists only. Library checklists are reached through
    // /api/checklists/library, which filters on project_id IS NULL.
    let queryText = `
      SELECT c.*,
        COALESCE(u.name, m.name, c.updated_by::text, 'Admin') AS updated_by,
        CASE WHEN p.id IS NOT NULL
          THEN json_build_object('id', p.id, 'name', p.name)
          ELSE NULL
        END AS project,
        (SELECT COUNT(*)::int FROM project_stage ps WHERE ps.project_checklist_id = c.id) AS stage_count,
        (SELECT COUNT(*)::int FROM project_checkpoints pcp JOIN project_stage ps ON pcp.project_stage_id = ps.id WHERE ps.project_checklist_id = c.id) AS checkpoint_count
      FROM project_checklist c
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

/**
 * Writes a checklist together with its stages and checkpoints in one
 * transaction, so a half-built tree is never left behind.
 * Returns the new checklist's id.
 */
async function createChecklistTree(
  orgId: string,
  values: {
    projectId: string;
    name: string;
    referenceNumber: string;
    uom: string;
    status: string;
    userId: string | null;
    stages: IncomingStage[];
  }
): Promise<string> {
  const client = await getSchemaClient(orgId);
  try {
    await client.query('BEGIN');

    const { rows: clRows } = await client.query(
      `INSERT INTO public.project_checklist
         (project_id, name, reference_number, uom, status, updated_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING id`,
      [values.projectId, values.name, values.referenceNumber, values.uom, values.status, values.userId]
    );
    const checklistId: string = clRows[0].id;

    for (let i = 0; i < values.stages.length; i++) {
      const stage = values.stages[i];
      const stageName = String(stage?.name ?? '').trim();
      if (!stageName) continue;

      const { rows: stageRows } = await client.query(
        `INSERT INTO public.project_stage
           (project_checklist_id, sr_no, "index", name, witness_required, drawing_required, created_at)
         VALUES ($1, $2, $2, $3, $4, $5, NOW())
         RETURNING id`,
        [checklistId, i + 1, stageName, !!stage.witness_required, !!stage.drawing_required]
      );
      const stageId: string = stageRows[0].id;

      const checkpoints = Array.isArray(stage.checkpoints) ? stage.checkpoints : [];
      for (let j = 0; j < checkpoints.length; j++) {
        const cp = checkpoints[j];
        const question = String(cp?.question ?? cp?.name ?? '').trim();
        if (!question) continue;

        await client.query(
          `INSERT INTO public.project_checkpoints
             (project_stage_id, sr_no, question, input_type, photo_required, remark_required, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
          [stageId, j + 1, question, cp.input_type || 'yes_no', !!cp.photo_required, !!cp.remark_required]
        );
      }
    }

    await client.query('COMMIT');
    return checklistId;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Copies a checklist's stages and checkpoints into a freshly created project
 * checklist. The source may live in either store, so it is resolved rather
 * than assumed — copying a project checklist must find its project_stage rows,
 * not silently look in the library.
 */
async function copyChildrenFrom(orgId: string, sourceId: string, targetChecklistId: string) {
  const source = await resolveChecklistScope(sourceId);
  if (!source) return;

  const t = CHECKLIST_TABLES[source.scope];

  const { rows: stages } = await orgQuery(orgId,
    `SELECT id, COALESCE("index", sr_no, 1) AS index, sr_no, name, witness_required, drawing_required
     FROM ${t.stage} WHERE ${t.checklistFk} = $1
     ORDER BY COALESCE("index", sr_no, 1) ASC, created_at ASC`,
    [sourceId]
  );

  for (const stage of stages) {
    const stageIdx = stage.index || stage.sr_no || 1;
    const { rows: stageRows } = await orgQuery(orgId,
      `INSERT INTO project_stage (project_checklist_id, sr_no, "index", name, witness_required, drawing_required)
       VALUES ($1, $2, $2, $3, $4, $5)
       RETURNING id`,
      [targetChecklistId, stageIdx, stage.name, stage.witness_required || false, stage.drawing_required || false]
    );
    const newStageId = stageRows[0].id;

    const { rows: checkpoints } = await orgQuery(orgId,
      `SELECT id, sr_no, question, input_type, photo_required, remark_required
       FROM ${t.checkpoint} WHERE ${t.stageFk} = $1 ORDER BY sr_no ASC`,
      [stage.id]
    );

    for (let j = 0; j < checkpoints.length; j++) {
      const cp = checkpoints[j];
      await orgQuery(orgId,
        `INSERT INTO project_checkpoints (project_stage_id, sr_no, question, input_type, photo_required, remark_required)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [newStageId, j + 1, cp.question, cp.input_type || 'yes_no', !!cp.photo_required, !!cp.remark_required]
      );
    }
  }
}

/**
 * Copies a library template's stages and checkpoints into a project checklist.
 * A library checklist is read-only shared data, so its rows are read from
 * library_* and written into project_*.
 */
async function copyLibraryTemplate(orgId: string, templateId: string, targetChecklistId: string) {
  const { rows: stages } = await orgQuery(orgId,
    `SELECT id, COALESCE("index", sr_no, 1) AS index, sr_no, name, witness_required, drawing_required
     FROM library_stages WHERE library_checklist_id = $1
     ORDER BY COALESCE("index", sr_no, 1) ASC, created_at ASC`,
    [templateId]
  );

  for (const stage of stages) {
    const stageIdx = stage.index || stage.sr_no || 1;
    const { rows: stageRows } = await orgQuery(orgId,
      `INSERT INTO project_stage (project_checklist_id, sr_no, "index", name, witness_required, drawing_required)
       VALUES ($1, $2, $2, $3, $4, $5)
       RETURNING id`,
      [targetChecklistId, stageIdx, stage.name, stage.witness_required || false, stage.drawing_required || false]
    );
    const newStageId = stageRows[0].id;

    const { rows: checkpoints } = await orgQuery(orgId,
      `SELECT id, sr_no, question, input_type, photo_required, remark_required
       FROM library_checkpoints WHERE library_stage_id = $1 ORDER BY sr_no ASC`,
      [stage.id]
    );

    for (let j = 0; j < checkpoints.length; j++) {
      const cp = checkpoints[j];
      await orgQuery(orgId,
        `INSERT INTO project_checkpoints (project_stage_id, sr_no, question, input_type, photo_required, remark_required)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [newStageId, j + 1, cp.question, cp.input_type || 'yes_no', !!cp.photo_required, !!cp.remark_required]
      );
    }
  }
}

export async function POST(request: NextRequest) {
  const { payload, response } = requireAuth(request);
  if (!payload) return response;

  await ensureChecklistSchema(payload.orgId!);

  try {
    const body = await request.json();

    // --- Nested create: one checklist with its stages and checkpoints ---------
    // Sent by the Add Checklist forms. Distinguished from the flat Excel-import
    // payload by carrying a `stages` array.
    if (Array.isArray(body.stages)) {
      const name = String(body.name ?? '').trim();
      if (!name) {
        return NextResponse.json({ error: 'Checklist name is required.' }, { status: 400 });
      }
      const projectId = body.project_id && String(body.project_id).trim() ? String(body.project_id) : null;
      if (!projectId) {
        return NextResponse.json({ error: 'A project is required to create a checklist.' }, { status: 400 });
      }

      const checklistId = await createChecklistTree(payload.orgId!, {
        projectId,
        name,
        referenceNumber: String(body.reference_number ?? '').trim(),
        uom: String(body.uom ?? '').trim(),
        status: body.status || 'draft',
        userId: payload.userId || null,
        stages: body.stages,
      });

      await touchProject(payload.orgId!, projectId, payload.userId);
      return NextResponse.json({ success: true, id: checklistId });
    }

    // --- Flat rows: the Excel import path ------------------------------------
    const rows = body.rows ?? [body];
    const touchedProjectIds = new Set<string>();

    for (const row of rows) {
      if (!row.name || !String(row.name).trim()) continue;

      const projectId = row.project_id && String(row.project_id).trim() ? String(row.project_id) : null;
      const refNum = row.reference_number && String(row.reference_number).trim() ? String(row.reference_number).trim() : null;
      const uom = row.uom && String(row.uom).trim() ? String(row.uom).trim() : '';
      const status = row.status || 'draft';

      // Which store this row belongs in. A row with a project is a project
      // checklist; without one it is a shared library checklist.
      const scope: ChecklistScope = projectId ? 'project' : 'library';
      const t = CHECKLIST_TABLES[scope];

      let checklistId: string;

      // Check if a matching checklist already exists
      let existingRows: any[] = [];
      const matchOn = projectId ? 'project_id = $1' : 'project_id IS NULL';
      if (refNum) {
        const res = await orgQuery(payload.orgId!,
          `SELECT id, name, reference_number, uom FROM ${t.checklist}
           WHERE ${matchOn} AND reference_number = $${projectId ? 2 : 1}`,
          projectId ? [projectId, refNum] : [refNum]
        );
        existingRows = res.rows;
      }
      if (existingRows.length === 0) {
        const res = await orgQuery(payload.orgId!,
          `SELECT id, name, reference_number, uom FROM ${t.checklist}
           WHERE ${matchOn} AND name = $${projectId ? 2 : 1}`,
          projectId ? [projectId, row.name.trim()] : [row.name.trim()]
        );
        existingRows = res.rows;
      }

      if (existingRows.length > 0) {
        checklistId = existingRows[0].id;
        const updatedRefNum = refNum || (existingRows[0]?.reference_number ?? '');
        const updatedUom = uom || (existingRows[0]?.uom ?? '');
        await orgQuery(payload.orgId!,
          `UPDATE ${t.checklist}
           SET name = $1,
               uom = $2,
               reference_number = $3,
               updated_by = $4,
               updated_at = NOW(),
               created_at = COALESCE(created_at, NOW())
           WHERE id = $5`,
          [row.name.trim(), updatedUom, updatedRefNum, payload.userId || null, checklistId]
        );
      } else if (projectId) {
        const { rows: clRows } = await orgQuery(payload.orgId!,
          `INSERT INTO project_checklist (project_id, name, reference_number, uom, status, updated_by, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
           RETURNING id`,
          [projectId, row.name.trim(), refNum || '', uom, status, payload.userId || null]
        );
        checklistId = clRows[0].id;
      } else {
        // No project: a shared library checklist, so project_id stays NULL.
        const { rows: clRows } = await orgQuery(payload.orgId!,
          `INSERT INTO library_checklists (project_id, name, reference_number, uom, status, updated_by, created_at, updated_at)
           VALUES (NULL, $1, $2, $3, $4, $5, NOW(), NOW())
           RETURNING id`,
          [row.name.trim(), refNum || '', uom, status, payload.userId || null]
        );
        checklistId = clRows[0].id;
      }

      if (projectId) touchedProjectIds.add(projectId);

      // Cloning: either from a library template, or from another checklist
      // (which may itself be a project checklist).
      const templateId = row.library_template_id || row.template_id;
      const sourceId = row.copy_from_checklist_id || row.library_checklist_id;

      if (templateId || sourceId) {
        const { rows: currStages } = await orgQuery(payload.orgId!,
          `SELECT count(*)::int AS count FROM ${t.stage} WHERE ${t.checklistFk} = $1`,
          [checklistId]
        );
        if (parseInt(currStages[0]?.count || '0') === 0) {
          if (sourceId) {
            await copyChildrenFrom(payload.orgId!, sourceId, checklistId);
          } else {
            await copyLibraryTemplate(payload.orgId!, templateId, checklistId);
          }
        }
      }

      // Handle Stage if specified (e.g. on excel import)
      const stageName = row.stage_name && String(row.stage_name).trim() ? String(row.stage_name).trim() : (row.checkpoint || row.question ? 'Single Stage' : null);
      if (stageName) {
        const { rows: existingStages } = await orgQuery(payload.orgId!,
          `SELECT id FROM ${t.stage} WHERE ${t.checklistFk} = $1 AND name = $2`,
          [checklistId, stageName]
        );

        let stageId: string;
        if (existingStages.length > 0) {
          stageId = existingStages[0].id;
        } else {
          const { rows: countRows } = await orgQuery(payload.orgId!,
            `SELECT COALESCE(MAX(COALESCE("index", sr_no, 0)), 0) + 1 AS next_idx FROM ${t.stage} WHERE ${t.checklistFk} = $1`, [checklistId]);
          const nextIdx = parseInt(countRows[0].next_idx);

          const { rows: stageRows } = await orgQuery(payload.orgId!,
            `INSERT INTO ${t.stage} (${t.checklistFk}, sr_no, "index", name, witness_required, drawing_required, created_at)
             VALUES ($1, $2, $2, $3, $4, $5, NOW())
             RETURNING id`,
            [checklistId, nextIdx, stageName, !!row.witness_required, !!row.drawing_required]
          );
          stageId = stageRows[0].id;
        }

        // Handle Checkpoint if specified
        const cpQuestion = row.checkpoint || row.question;
        if (cpQuestion && String(cpQuestion).trim()) {
          const qText = String(cpQuestion).trim();
          const { rows: existingCp } = await orgQuery(payload.orgId!,
            `SELECT id FROM ${t.checkpoint}
             WHERE ${t.stageFk} = $1 AND (TRIM(question) = TRIM($2) OR LOWER(TRIM(question)) = LOWER(TRIM($2)))`,
            [stageId, qText]
          );

          if (existingCp.length > 0) {
            await orgQuery(payload.orgId!,
              `UPDATE ${t.checkpoint}
               SET question = $1, input_type = $2, photo_required = $3, remark_required = $4
               WHERE id = $5`,
              [qText, row.input_type || 'yes_no', !!row.photo_required, !!row.remark_required, existingCp[0].id]
            );
          } else {
            const { rows: cpCount } = await orgQuery(payload.orgId!,
              `SELECT COALESCE(MAX(sr_no), 0) + 1 AS next_sr_no FROM ${t.checkpoint} WHERE ${t.stageFk} = $1`, [stageId]);
            const nextSrNo = parseInt(cpCount[0].next_sr_no);

            await orgQuery(payload.orgId!,
              `INSERT INTO ${t.checkpoint} (${t.stageFk}, question, input_type, photo_required, remark_required, sr_no, created_at)
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
