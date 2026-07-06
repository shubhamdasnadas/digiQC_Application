import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { orgQuery } from '@/lib/db';
import { listLibraryChecklists } from '@/lib/checklistLibrary';
import fs from 'fs';
import path from 'path';

async function ensureSchema(orgId: string) {
  try {
    // 1. Ensure columns exist
    const { rows: colRows } = await orgQuery(orgId, `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'checklists' AND column_name = 'reference_number'
    `);

    if (colRows.length === 0) {
      console.log('Applying missing checklist columns...');
      await orgQuery(orgId, `ALTER TABLE checklists ADD COLUMN IF NOT EXISTS reference_number TEXT`);
      await orgQuery(orgId, `ALTER TABLE checklists ADD COLUMN IF NOT EXISTS uom TEXT`);
      await orgQuery(orgId, `ALTER TABLE checklists ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'`);
      await orgQuery(orgId, `ALTER TABLE checklist_stages ADD COLUMN IF NOT EXISTS sr_no INTEGER DEFAULT 0`);
      await orgQuery(orgId, `ALTER TABLE checkpoints ADD COLUMN IF NOT EXISTS sr_no INTEGER DEFAULT 0`);
    }

    // 2. Ensure Unique Constraints exist for ON CONFLICT
    const { rows: constraintRows } = await orgQuery(orgId, `
      SELECT conname FROM pg_constraint WHERE conname = 'checklists_project_ref_unique'
    `);

    if (constraintRows.length === 0) {
      console.log('Adding missing unique constraints...');
      try {
        await orgQuery(orgId, `ALTER TABLE checklists ADD CONSTRAINT checklists_project_ref_unique UNIQUE (project_id, reference_number)`);
      } catch (e) { console.log('Constraint checklists_project_ref_unique might already exist'); }

      try {
        await orgQuery(orgId, `ALTER TABLE checklist_stages ADD CONSTRAINT stages_checklist_name_unique UNIQUE (checklist_id, name)`);
      } catch (e) { console.log('Constraint stages_checklist_name_unique might already exist'); }
    }
  } catch (error) {
    console.error('Schema ensureSchema error:', error);
  }
}

export async function GET(request: NextRequest) {
  const { payload, response } = requireAuth(request);
  if (!payload) return response;

  await ensureSchema(payload.orgId!);

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

  await ensureSchema(payload.orgId!);

  try {
    const body = await request.json();
    const rows = body.rows ?? [body];

    for (const row of rows) {
      // 1. Handle Checklist
      const { rows: clRows } = await orgQuery(payload.orgId!,
        `INSERT INTO checklists (project_id, name, reference_number, uom, status) 
         VALUES ($1, $2, $3, $4, $5) 
         ON CONFLICT (project_id, reference_number) DO UPDATE SET name = EXCLUDED.name, uom = EXCLUDED.uom
         RETURNING id`,
        [row.project_id, row.name, row.reference_number || null, row.uom || null, row.status || 'active']
      );
      const checklistId = clRows[0].id;

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
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}