import { orgQuery } from '@/lib/db';

export async function ensureChecklistSchema(orgId: string) {
  try {
    // 0. Ensure base tables exist
    await orgQuery(orgId, `
      CREATE TABLE IF NOT EXISTS checklists (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id uuid NOT NULL,
        name text NOT NULL,
        created_at timestamptz DEFAULT now()
      )
    `);
    await orgQuery(orgId, `
      CREATE TABLE IF NOT EXISTS checklist_stages (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        checklist_id uuid NOT NULL,
        sr_no integer NOT NULL DEFAULT 1,
        name text NOT NULL,
        created_at timestamptz DEFAULT now()
      )
    `);
    await orgQuery(orgId, `
      CREATE TABLE IF NOT EXISTS checkpoints (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        stage_id uuid NOT NULL,
        question text NOT NULL,
        input_type text NOT NULL DEFAULT 'yes_no',
        drawing_required boolean DEFAULT false,
        witness_required boolean DEFAULT false,
        created_at timestamptz DEFAULT now()
      )
    `);

    // 1. Ensure columns exist
    console.log('Ensuring checklist columns exist...');
    await orgQuery(orgId, `ALTER TABLE checklists ADD COLUMN IF NOT EXISTS reference_number TEXT`);
    await orgQuery(orgId, `ALTER TABLE checklists ADD COLUMN IF NOT EXISTS uom TEXT`);
    await orgQuery(orgId, `ALTER TABLE checklists ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'`);
    await orgQuery(orgId, `ALTER TABLE checklist_stages ADD COLUMN IF NOT EXISTS sr_no INTEGER DEFAULT 0`);
    await orgQuery(orgId, `ALTER TABLE checkpoints ADD COLUMN IF NOT EXISTS sr_no INTEGER DEFAULT 0`);

    // 2. Ensure Unique Constraints exist for ON CONFLICT
    // We use a try-catch block because ADD CONSTRAINT doesn't have IF NOT EXISTS
    console.log('Ensuring unique constraints exist...');
    try {
      console.log('Adding missing unique constraints...');
      await orgQuery(orgId, `ALTER TABLE checklists ADD CONSTRAINT checklists_project_ref_unique UNIQUE (project_id, reference_number)`);
    } catch (e) { console.log('Constraint checklists_project_ref_unique might already exist'); }

    try {
      await orgQuery(orgId, `ALTER TABLE checklist_stages ADD CONSTRAINT stages_checklist_name_unique UNIQUE (checklist_id, name)`);
    } catch (e) { console.log('Constraint stages_checklist_name_unique might already exist'); }

    // 3. Ensure stage-level requirement flags and checkpoint photo/remark flags exist
    console.log('Ensuring stage requirement columns exist...');
    await orgQuery(orgId, `ALTER TABLE checklist_stages ADD COLUMN IF NOT EXISTS witness_required BOOLEAN DEFAULT false`);
    await orgQuery(orgId, `ALTER TABLE checklist_stages ADD COLUMN IF NOT EXISTS drawing_required BOOLEAN DEFAULT false`);
    await orgQuery(orgId, `ALTER TABLE checkpoints ADD COLUMN IF NOT EXISTS photo_required BOOLEAN DEFAULT false`);
    await orgQuery(orgId, `ALTER TABLE checkpoints ADD COLUMN IF NOT EXISTS remark_required BOOLEAN DEFAULT false`);
  } catch (error) {
    console.error('Schema ensureChecklistSchema error:', error);
  }
}
