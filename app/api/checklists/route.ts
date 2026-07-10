import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { orgQuery } from '@/lib/db';
import { listLibraryChecklists, getLibraryChecklistDetail } from '@/lib/checklistLibrary';
import { ensureChecklistSchema } from '@/lib/checklistSchema';
import { touchProject } from '@/lib/projects';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  const { payload, response } = requireAuth(request);
  if (!payload) return response;

  await ensureChecklistSchema(payload.orgId!);

  try {
    const { rows } = await orgQuery(payload.orgId!, `
      SELECT c.*,
        CASE WHEN p.id IS NOT NULL
          THEN json_build_object('name', p.name)
          ELSE NULL
        END AS project
      FROM checklists c
      LEFT JOIN projects p ON c.project_id = p.id
      ORDER BY c.created_at DESC
    `);
    const libraryChecklists = await listLibraryChecklists();
    return NextResponse.json([...rows, ...libraryChecklists]);
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
      // 1. Handle Checklist
      const { rows: clRows } = await orgQuery(payload.orgId!,
        `INSERT INTO checklists (project_id, name, reference_number, uom, status) 
         VALUES ($1, $2, $3, $4, $5) 
         ON CONFLICT (project_id, reference_number) DO UPDATE SET name = EXCLUDED.name, uom = EXCLUDED.uom
         RETURNING id`,
        [row.project_id, row.name, row.reference_number || null, row.uom || null, row.status || 'draft']
      );
      const checklistId = clRows[0].id;
      if (row.project_id) touchedProjectIds.add(row.project_id);

      // If cloning from the shared library, copy over its stages/checkpoints since
      // they live in separate library_stages/library_checkpoints tables.
      if (row.library_checklist_id) {
        const detail = await getLibraryChecklistDetail(row.library_checklist_id);
        if (detail) {
          for (const stage of detail.stages) {
            const { rows: stageRows } = await orgQuery(payload.orgId!,
              `INSERT INTO checklist_stages (checklist_id, sr_no, name, witness_required, drawing_required)
               VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT (checklist_id, name) DO UPDATE SET name = EXCLUDED.name
               RETURNING id`,
              [checklistId, stage.sr_no, stage.name, stage.witness_required || false, stage.drawing_required || false]
            );
            const stageId = stageRows[0].id;

            const stageCheckpoints = detail.checkpoints.filter(cp => cp.stage_id === stage.id);
            for (const cp of stageCheckpoints) {
              await orgQuery(payload.orgId!,
                `INSERT INTO checkpoints (stage_id, sr_no, question, input_type, drawing_required, witness_required)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [stageId, cp.sr_no, cp.question, cp.input_type, cp.drawing_required || false, cp.witness_required || false]
              );
            }
          }
        }
      }

      // 2. Handle Stage
      if (row.stage_name) {
        const { rows: stageRows } = await orgQuery(payload.orgId!,
          `INSERT INTO checklist_stages (checklist_id, name) 
           VALUES ($1, $2) 
           ON CONFLICT (checklist_id, name) DO UPDATE SET name = EXCLUDED.name
           RETURNING id`,
          [checklistId, row.stage_name]
        );
        const stageId = stageRows[0].id;

        const { rows: stageCount } = await orgQuery(payload.orgId!,
          `SELECT count(*) as count FROM checklist_stages WHERE checklist_id = $1`, [checklistId]);
        await orgQuery(payload.orgId!,
          `UPDATE checklist_stages SET sr_no = (SELECT count(*) FROM checklist_stages WHERE checklist_id = $1) + 1 WHERE id = $2`,
          [checklistId, stageId]);

        // 3. Handle Checkpoint
        if (row.checkpoint) {
          const { rows: cpCount } = await orgQuery(payload.orgId!,
            `SELECT count(*) as count FROM checkpoints WHERE stage_id = $1`, [stageId]);
          const nextSrNo = parseInt(cpCount[0].count) + 1;

          await orgQuery(payload.orgId!,
            `INSERT INTO checkpoints (stage_id, question, input_type, drawing_required, witness_required, sr_no) 
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              stageId,
              row.checkpoint,
              row.input_type || 'yes_no',
              row.drawing_required || false,
              row.witness_required || false,
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