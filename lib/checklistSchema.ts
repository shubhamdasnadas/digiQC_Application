import { orgQuery } from '@/lib/db';

export async function ensureChecklistSchema(orgId: string) {
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

    // 3. Ensure stage-level requirement flags and checkpoint photo/remark flags exist
    const { rows: stageReqCols } = await orgQuery(orgId, `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'checklist_stages' AND column_name = 'witness_required'
    `);

    if (stageReqCols.length === 0) {
      console.log('Applying missing stage requirement columns...');
      await orgQuery(orgId, `ALTER TABLE checklist_stages ADD COLUMN IF NOT EXISTS witness_required BOOLEAN DEFAULT false`);
      await orgQuery(orgId, `ALTER TABLE checklist_stages ADD COLUMN IF NOT EXISTS drawing_required BOOLEAN DEFAULT false`);
      await orgQuery(orgId, `ALTER TABLE checkpoints ADD COLUMN IF NOT EXISTS photo_required BOOLEAN DEFAULT false`);
      await orgQuery(orgId, `ALTER TABLE checkpoints ADD COLUMN IF NOT EXISTS remark_required BOOLEAN DEFAULT false`);
    }
  } catch (error) {
    console.error('Schema ensureChecklistSchema error:', error);
  }
}
