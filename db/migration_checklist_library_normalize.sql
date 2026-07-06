-- Normalizes the shared checklist library out of the flat array-column
-- public.checklist table into real relational tables.
--
-- Run in this order:
--   1. psql -U postgres -d digiQC -f db/migration_checklist_library_normalize.sql
--   2. node scripts/migrate-checklist-library.js   (populates the new tables from public.checklist)

CREATE TABLE IF NOT EXISTS public.library_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  reference_number text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.library_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  library_checklist_id uuid NOT NULL REFERENCES public.library_checklists(id) ON DELETE CASCADE,
  sr_no integer NOT NULL DEFAULT 1,
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (library_checklist_id, name)
);

CREATE TABLE IF NOT EXISTS public.library_checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  library_stage_id uuid NOT NULL REFERENCES public.library_stages(id) ON DELETE CASCADE,
  sr_no integer NOT NULL DEFAULT 1,
  question text NOT NULL,
  input_type text NOT NULL DEFAULT 'yes_no',
  drawing_required boolean DEFAULT false,
  witness_required boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
