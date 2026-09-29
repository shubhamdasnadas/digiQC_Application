-- ============================================================
-- Valid8 — Full Database Setup (Direct Public Schema)
-- ============================================================

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
  created_at timestamptz DEFAULT now()
);

-- Members
CREATE TABLE IF NOT EXISTS public.members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  name text NOT NULL,
  email text DEFAULT '',
  phone text DEFAULT '',
  access_type text DEFAULT '',
  active boolean DEFAULT true,
  default_role text DEFAULT '',
  teams text DEFAULT '',
  active_projects text DEFAULT '',
  inactive_projects text DEFAULT '',
  created_at timestamptz DEFAULT now()
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

CREATE INDEX IF NOT EXISTS projects_unique_code_idx
ON public.projects (unique_code)
WHERE unique_code IS NOT NULL;

-- Checklists
CREATE TABLE IF NOT EXISTS public.checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  name text NOT NULL,
  reference_number text,
  uom text,
  status text DEFAULT 'draft',
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS checklists_project_ref_idx
ON public.checklists (project_id, reference_number)
WHERE reference_number IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.checklist_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id uuid NOT NULL,
  sr_no integer NOT NULL DEFAULT 1,
  name text NOT NULL,
  witness_required boolean DEFAULT false,
  drawing_required boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id uuid NOT NULL,
  question text NOT NULL,
  input_type text NOT NULL DEFAULT 'yes_no',
  drawing_required boolean DEFAULT false,
  witness_required boolean DEFAULT false,
  sr_no integer DEFAULT 0,
  photo_required boolean DEFAULT false,
  remark_required boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

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

-- Shared checklist library
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
  created_at timestamptz DEFAULT now()
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
