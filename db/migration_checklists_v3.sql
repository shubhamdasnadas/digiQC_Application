-- Add missing columns to checklists table
ALTER TABLE checklists ADD COLUMN IF NOT EXISTS reference_number TEXT;
ALTER TABLE checklists ADD COLUMN IF NOT EXISTS uom TEXT;
ALTER TABLE checklists ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Ensure checklist_stages has sr_no
ALTER TABLE checklist_stages ADD COLUMN IF NOT EXISTS sr_no INTEGER DEFAULT 0;

-- Ensure checkpoints has sr_no
ALTER TABLE checkpoints ADD COLUMN IF NOT EXISTS sr_no INTEGER DEFAULT 0;

-- Add unique constraint to checklists for UPSERT logic
-- Use reference_number as the unique identifier to allow name changes
ALTER TABLE checklists ADD CONSTRAINT checklists_project_ref_unique UNIQUE (project_id, reference_number);

-- Add unique constraint to checklist_stages for UPSERT logic
ALTER TABLE checklist_stages ADD CONSTRAINT stages_checklist_name_unique UNIQUE (checklist_id, name);
