-- ============================================================
-- Valid8 — Full Database Setup (Direct Public Schema)
-- ============================================================


-- psql -U postgres -d digiqc_new -f db/setup.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- Core Tables in public schema
-- ============================================================

CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  user_limit integer DEFAULT 10,
  licensing text DEFAULT '',
  expiry_date date,
  logo_url text DEFAULT '',
  console_uses integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  avatar_url text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.otp_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  otp_code text NOT NULL,
  expires_at timestamptz NOT NULL,
  used boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS otp_verifications_email_idx ON public.otp_verifications (email);

CREATE TABLE IF NOT EXISTS public.org_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'disabled')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, organization_id)
);

-- Teams
CREATE TABLE IF NOT EXISTS public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  name text NOT NULL,
  type text DEFAULT 'inspection',
  team_lead_name text DEFAULT '',
  spoc_name text DEFAULT '',
  active_projects text DEFAULT '',
  inactive_projects text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Members
CREATE TABLE IF NOT EXISTS public.members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  name text NOT NULL,
  email text DEFAULT '',
  phone text DEFAULT '',
  access_type text DEFAULT 'Paid',
  active boolean DEFAULT true,
  default_role text DEFAULT 'User',
  teams text DEFAULT '',
  active_projects text DEFAULT '',
  inactive_projects text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Projects
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  name text NOT NULL,
  nomenclature text DEFAULT '',
  instruction text DEFAULT '',
  profile text DEFAULT '',
  image_url text DEFAULT '',
  status text DEFAULT 'active',
  unique_code text,
  client_name text DEFAULT '',
  description text DEFAULT '',
  project_admin_id uuid,
  radius_m integer DEFAULT 100,
  timezone text DEFAULT 'Asia/Calcutta',
  latitude double precision,
  longitude double precision,
  address text DEFAULT '',
  perm_location boolean DEFAULT false,
  perm_authentication boolean DEFAULT false,
  perm_rfi boolean DEFAULT false,
  updated_by uuid,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Remove foreign key constraints that restrict organization_id or admin_id
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_organization_id_fkey;
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_project_admin_id_fkey;
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_updated_by_fkey;
ALTER TABLE public.teams DROP CONSTRAINT IF EXISTS teams_organization_id_fkey;
ALTER TABLE public.members DROP CONSTRAINT IF EXISTS members_organization_id_fkey;

CREATE INDEX IF NOT EXISTS projects_unique_code_idx
ON public.projects (unique_code)
WHERE unique_code IS NOT NULL;

-- Project columns migration for existing installations
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS organization_id uuid;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS nomenclature text DEFAULT '';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS instruction text DEFAULT '';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS profile text DEFAULT '';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS image_url text DEFAULT '';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS unique_code text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS client_name text DEFAULT '';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS description text DEFAULT '';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS project_admin_id uuid;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS radius_m integer DEFAULT 100;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'Asia/Calcutta';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS longitude double precision;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS address text DEFAULT '';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS perm_location boolean DEFAULT false;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS perm_authentication boolean DEFAULT false;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS perm_rfi boolean DEFAULT false;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS updated_by uuid;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- Library Checklists (Canonical Checklists in public schema)
CREATE TABLE IF NOT EXISTS public.library_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid,
  name text NOT NULL,
  reference_number text,
  uom text DEFAULT '',
  status text DEFAULT 'draft',
  updated_by uuid,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.library_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  library_checklist_id uuid NOT NULL REFERENCES public.library_checklists(id) ON DELETE CASCADE,
  sr_no integer NOT NULL DEFAULT 1,
  "index" integer NOT NULL DEFAULT 1,
  name text NOT NULL,
  witness_required boolean DEFAULT false,
  drawing_required boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.library_stages ADD COLUMN IF NOT EXISTS "index" integer DEFAULT 1;

CREATE TABLE IF NOT EXISTS public.library_checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  library_stage_id uuid NOT NULL REFERENCES public.library_stages(id) ON DELETE CASCADE,
  sr_no integer NOT NULL DEFAULT 1,
  question text NOT NULL,
  input_type text NOT NULL DEFAULT 'yes_no',
  photo_required boolean DEFAULT false,
  remark_required boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.library_checkpoints DROP COLUMN IF EXISTS drawing_required;
ALTER TABLE public.library_checkpoints DROP COLUMN IF EXISTS witness_required;
ALTER TABLE public.library_checklists DROP CONSTRAINT IF EXISTS library_checklists_reference_number_key;
ALTER TABLE public.library_checklists DROP CONSTRAINT IF EXISTS library_checklists_name_key;
DROP INDEX IF EXISTS public.library_checklists_reference_number_key;
ALTER TABLE public.library_checklists ALTER COLUMN reference_number DROP NOT NULL;
ALTER TABLE public.library_checklists ALTER COLUMN reference_number SET DEFAULT '';
ALTER TABLE public.library_checklists ALTER COLUMN uom DROP NOT NULL;
ALTER TABLE public.library_checklists ALTER COLUMN uom SET DEFAULT '';
ALTER TABLE public.library_checklists ALTER COLUMN status DROP NOT NULL;
ALTER TABLE public.library_checklists ALTER COLUMN status SET DEFAULT 'draft';

-- ============================================================
-- Project-owned checklists
-- A checklist that belongs to a project lives in project_checklist →
-- project_stage → project_checkpoints. library_checklists / library_stages /
-- library_checkpoints hold only the shared canonical library
-- (project_id IS NULL). The column sets mirror library_* deliberately so the
-- API can return the same JSON from either source.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.project_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  name text NOT NULL,
  reference_number text DEFAULT '',
  uom text DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  updated_by uuid,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.project_stage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_checklist_id uuid NOT NULL REFERENCES public.project_checklist(id) ON DELETE CASCADE,
  sr_no integer NOT NULL DEFAULT 1,
  "index" integer NOT NULL DEFAULT 1,
  name text NOT NULL,
  witness_required boolean DEFAULT false,
  drawing_required boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.project_checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_stage_id uuid NOT NULL REFERENCES public.project_stage(id) ON DELETE CASCADE,
  sr_no integer NOT NULL DEFAULT 1,
  question text NOT NULL,
  input_type text NOT NULL DEFAULT 'yes_no',
  photo_required boolean DEFAULT false,
  remark_required boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_checklist_project_idx
ON public.project_checklist (project_id);

CREATE INDEX IF NOT EXISTS project_stage_checklist_idx
ON public.project_stage (project_checklist_id);

CREATE INDEX IF NOT EXISTS project_checkpoints_stage_idx
ON public.project_checkpoints (project_stage_id);

-- Move every project-scoped row out of the shared library tables and into the
-- project_* tables, preserving the original UUIDs. eqcs.checklist_id and the
-- stage_id / checkpoint_id values stored inside eqcs.stages_data and
-- eqcs.inspection_data (jsonb) reference these ids, so they must not change.
-- Safe to re-run: once the rows have moved, the WHERE clauses match nothing.
DO $$
BEGIN
  INSERT INTO public.project_checklist
    (id, project_id, name, reference_number, uom, status, updated_by, updated_at, created_at)
  SELECT id, project_id, name, COALESCE(reference_number, ''), COALESCE(uom, ''),
         COALESCE(status, 'draft'),
         CASE WHEN updated_by::text ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
              THEN updated_by::text::uuid ELSE NULL END,
         updated_at, created_at
  FROM public.library_checklists
  WHERE project_id IS NOT NULL
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.project_stage
    (id, project_checklist_id, sr_no, "index", name, witness_required, drawing_required, created_at)
  SELECT ls.id, ls.library_checklist_id, ls.sr_no, COALESCE(ls."index", ls.sr_no, 1),
         ls.name, COALESCE(ls.witness_required, false), COALESCE(ls.drawing_required, false),
         ls.created_at
  FROM public.library_stages ls
  WHERE EXISTS (SELECT 1 FROM public.project_checklist pc WHERE pc.id = ls.library_checklist_id)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.project_checkpoints
    (id, project_stage_id, sr_no, question, input_type, photo_required, remark_required, created_at)
  SELECT lcp.id, lcp.library_stage_id, lcp.sr_no, lcp.question,
         COALESCE(lcp.input_type, 'yes_no'), COALESCE(lcp.photo_required, false),
         COALESCE(lcp.remark_required, false), lcp.created_at
  FROM public.library_checkpoints lcp
  WHERE EXISTS (SELECT 1 FROM public.project_stage ps WHERE ps.id = lcp.library_stage_id)
  ON CONFLICT (id) DO NOTHING;

  DELETE FROM public.library_checklists WHERE project_id IS NOT NULL;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

DROP TABLE IF EXISTS public.checkpoints CASCADE;
DROP TABLE IF EXISTS public.checklist_stages CASCADE;
DROP TABLE IF EXISTS public.checklists CASCADE;
DROP TABLE IF EXISTS public.checklist CASCADE;
DROP TABLE IF EXISTS public.eqc_items CASCADE;

-- Super admins
CREATE TABLE IF NOT EXISTS public.super_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  name text NOT NULL,
  email text NOT NULL,
  mobile_no text DEFAULT '',
  roles text[] DEFAULT ARRAY['admin'],
  created_at timestamptz DEFAULT now()
);

-- Project module tables
CREATE TABLE IF NOT EXISTS public.project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member'
    CHECK (role IN ('admin','member','inspector','approver','viewer')),
  added_at timestamptz DEFAULT now(),
  UNIQUE(project_id, user_id)
);

CREATE INDEX IF NOT EXISTS project_members_project_idx
ON public.project_members (project_id);

CREATE TABLE IF NOT EXISTS public.project_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  assigned_checklist text DEFAULT '',
  assigned_user text DEFAULT '',
  added_at timestamptz DEFAULT now(),
  UNIQUE(project_id, team_id)
);

CREATE TABLE IF NOT EXISTS public.eqcs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  location text NOT NULL DEFAULT '',
  checklist_id uuid,
  stage_index integer NOT NULL DEFAULT 1,
  total_stages integer NOT NULL DEFAULT 1,
  stage_result text DEFAULT 'pending'
    CHECK (stage_result IN ('pass','fail','pending')),
  completion_status boolean NOT NULL DEFAULT false,
  approver_id uuid,
  approver_log text DEFAULT '',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('passed','failed','pending','rfi')),
  inspected_by uuid,
  inspected_at timestamptz,
  rfi_id uuid,
  notes text DEFAULT '',
  assigned_user_ids uuid[] NOT NULL DEFAULT '{}',
  assigned_team_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS eqcs_project_status_idx
ON public.eqcs (project_id, status);

CREATE INDEX IF NOT EXISTS eqcs_project_rfi_idx
ON public.eqcs (project_id) WHERE rfi_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  severity text NOT NULL DEFAULT 'medium'
    CHECK (severity IN ('low','medium','high','critical')),
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','in_progress','resolved','closed')),
  assignee_id uuid,
  reported_by uuid,
  due_date date,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS issues_project_status_idx
ON public.issues (project_id, status);

CREATE TABLE IF NOT EXISTS public.register_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  document_no text DEFAULT '',
  title text NOT NULL,
  revision text DEFAULT 'R0',
  status text DEFAULT 'active'
    CHECK (status IN ('active','superseded','void')),
  file_url text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS register_project_idx
ON public.register_entries (project_id);

CREATE TABLE IF NOT EXISTS public.project_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  metric text NOT NULL,
  target_value numeric DEFAULT 0,
  current_value numeric DEFAULT 0,
  unit text DEFAULT '',
  period text DEFAULT 'monthly'
    CHECK (period IN ('daily','weekly','monthly','quarterly','project')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.project_nomenclature (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  prefix text NOT NULL,
  description text DEFAULT '',
  example text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.nomenclature (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.nomenclature(id) ON DELETE CASCADE,
  sr_no integer NOT NULL DEFAULT 1,
  name text NOT NULL,
  description text DEFAULT '',
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','inactive')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS nomenclature_project_idx
ON public.nomenclature (project_id);

CREATE INDEX IF NOT EXISTS nomenclature_parent_idx
ON public.nomenclature (parent_id);
