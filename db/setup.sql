-- ============================================================
-- DigiQC — Full Database Setup
-- ============================================================
-- Consolidates what used to be six separate migration files
-- (migration_saas.sql, migration_projects_v2.sql,
--  migration_checklists_v3.sql, migration_checklist_library_normalize.sql,
--  migration_members.sql, migration_teams_projects_columns.sql)
-- into a single script a new developer runs once against a fresh database.
--
-- Run:
--   createdb digiQC
--   psql -U postgres -d digiQC -f db/setup.sql
--
-- What this does:
--   1. Creates the shared `public` schema tables (organizations, users,
--      org_members, and the shared checklist library tables).
--   2. Creates public.org_schema_name() / create_org_schema() /
--      drop_org_schema() — the functions the app calls to provision a
--      brand-new, fully isolated schema (org_<name>) for each organization,
--      with every business table (teams, members, projects, checklists,
--      project sub-modules, etc.) already in its final, up-to-date shape.
--   3. Backfills create_org_schema() for any organizations that already
--      exist (no-op on a fresh database — safe to re-run any time).
--
-- After this, run `node scripts/seed.js` to create demo organizations,
-- a demo user, and sample data.
--
-- Note: db/checklist.sql is a separate, optional legacy data dump (a flat
-- pg_dump of an old shared checklist library) — only needed if you want to
-- import that legacy dataset via scripts/migrate-checklist-library.js.
-- It is not required to set up a working database.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- PART 1: Shared `public` schema tables
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

CREATE TABLE IF NOT EXISTS public.org_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'disabled')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, organization_id)
);

-- Shared checklist library (normalized; not per-org)
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

-- ============================================================
-- PART 2: Helper — derive an org's schema name from its id
-- ============================================================

CREATE OR REPLACE FUNCTION public.org_schema_name(org_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  org_name text;
BEGIN
  SELECT name INTO org_name FROM public.organizations WHERE id = org_id;
  RETURN 'org_' || lower(regexp_replace(org_name, '[^a-zA-Z0-9]+', '_', 'g'));
END;
$$;

-- ============================================================
-- PART 3: create_org_schema() — provisions a full, isolated
-- schema (org_<name>) with every business table, in its final,
-- up-to-date shape. Called whenever a new organization is created.
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_org_schema(org_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  schema_name text;
BEGIN
  schema_name := public.org_schema_name(org_id);

  EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', schema_name);

  -- ─── Teams ────────────────────────────────────────────────
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.teams (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL,
      name text NOT NULL,
      type text DEFAULT ''inspection'',
      team_lead_name text DEFAULT '''',
      spoc_name text DEFAULT '''',
      active_projects text DEFAULT '''',
      inactive_projects text DEFAULT '''',
      created_at timestamptz DEFAULT now()
    )', schema_name);

  -- ─── Members ──────────────────────────────────────────────
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.members (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL,
      name text NOT NULL,
      email text DEFAULT '''',
      phone text DEFAULT '''',
      access_type text DEFAULT '''',
      active boolean DEFAULT true,
      default_role text DEFAULT '''',
      teams text DEFAULT '''',
      active_projects text DEFAULT '''',
      inactive_projects text DEFAULT '''',
      created_at timestamptz DEFAULT now()
    )', schema_name);

  -- ─── Projects ─────────────────────────────────────────────
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.projects (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL,
      name text NOT NULL,
      nomenclature text DEFAULT '''',
      instruction text DEFAULT '''',
      profile text DEFAULT '''',
      image_url text DEFAULT '''',
      status text DEFAULT ''active'',
      unique_code text,
      client_name text DEFAULT '''',
      description text DEFAULT '''',
      project_admin_id uuid,
      radius_m integer DEFAULT 100,
      timezone text DEFAULT ''Asia/Calcutta'',
      latitude double precision,
      longitude double precision,
      address text DEFAULT '''',
      perm_location boolean DEFAULT false,
      perm_authentication boolean DEFAULT false,
      perm_rfi boolean DEFAULT false,
      updated_by uuid,
      updated_at timestamptz DEFAULT now(),
      created_at timestamptz DEFAULT now()
    )', schema_name);

  EXECUTE format('
    CREATE UNIQUE INDEX IF NOT EXISTS projects_org_unique_code_idx
    ON %I.projects (organization_id, unique_code)
    WHERE unique_code IS NOT NULL
  ', schema_name);

  -- ─── Checklists (2D: stages -> checkpoints) ──────────────
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.checklists (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id uuid NOT NULL,
      name text NOT NULL,
      reference_number text,
      uom text,
      status text DEFAULT ''draft'',
      created_at timestamptz DEFAULT now(),
      UNIQUE (project_id, reference_number)
    )', schema_name);

  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.checklist_stages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      checklist_id uuid NOT NULL,
      sr_no integer NOT NULL DEFAULT 1,
      name text NOT NULL,
      witness_required boolean DEFAULT false,
      drawing_required boolean DEFAULT false,
      created_at timestamptz DEFAULT now(),
      UNIQUE (checklist_id, name)
    )', schema_name);

  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.checkpoints (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      stage_id uuid NOT NULL,
      question text NOT NULL,
      input_type text NOT NULL DEFAULT ''yes_no'',
      drawing_required boolean DEFAULT false,
      witness_required boolean DEFAULT false,
      sr_no integer DEFAULT 0,
      photo_required boolean DEFAULT false,
      remark_required boolean DEFAULT false,
      created_at timestamptz DEFAULT now()
    )', schema_name);

  -- ─── Super admins ─────────────────────────────────────────
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.super_admins (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL,
      name text NOT NULL,
      email text NOT NULL,
      mobile_no text DEFAULT '''',
      roles text[] DEFAULT ARRAY[''admin''],
      created_at timestamptz DEFAULT now()
    )', schema_name);

  -- ─── Project module tables ────────────────────────────────
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.project_members (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id uuid NOT NULL REFERENCES %I.projects(id) ON DELETE CASCADE,
      user_id uuid NOT NULL,
      role text NOT NULL DEFAULT ''member''
        CHECK (role IN (''admin'',''member'',''inspector'',''approver'',''viewer'')),
      added_at timestamptz DEFAULT now(),
      UNIQUE(project_id, user_id)
    )', schema_name, schema_name);

  EXECUTE format('
    CREATE INDEX IF NOT EXISTS project_members_project_idx
    ON %I.project_members (project_id)
  ', schema_name);

  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.project_teams (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id uuid NOT NULL REFERENCES %I.projects(id) ON DELETE CASCADE,
      team_id uuid NOT NULL REFERENCES %I.teams(id) ON DELETE CASCADE,
      assigned_checklist text DEFAULT '''',
      assigned_user text DEFAULT '''',
      added_at timestamptz DEFAULT now(),
      UNIQUE(project_id, team_id)
    )', schema_name, schema_name, schema_name);

  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.eqcs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id uuid NOT NULL REFERENCES %I.projects(id) ON DELETE CASCADE,
      location text NOT NULL DEFAULT '''',
      checklist_id uuid,
      stage_index integer NOT NULL DEFAULT 1,
      total_stages integer NOT NULL DEFAULT 1,
      stage_result text DEFAULT ''pending''
        CHECK (stage_result IN (''pass'',''fail'',''pending'')),
      approver_id uuid,
      approver_log text DEFAULT '''',
      status text NOT NULL DEFAULT ''pending''
        CHECK (status IN (''passed'',''failed'',''pending'',''rfi'')),
      inspected_by uuid,
      inspected_at timestamptz,
      rfi_id uuid,
      notes text DEFAULT '''',
      assigned_user_ids uuid[] NOT NULL DEFAULT ''{}'',
      assigned_team_ids uuid[] NOT NULL DEFAULT ''{}'',
      created_at timestamptz DEFAULT now()
    )', schema_name, schema_name);

  EXECUTE format('
    CREATE INDEX IF NOT EXISTS eqcs_project_status_idx
    ON %I.eqcs (project_id, status)
  ', schema_name);

  EXECUTE format('
    CREATE INDEX IF NOT EXISTS eqcs_project_rfi_idx
    ON %I.eqcs (project_id) WHERE rfi_id IS NOT NULL
  ', schema_name);

  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.issues (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id uuid NOT NULL REFERENCES %I.projects(id) ON DELETE CASCADE,
      title text NOT NULL,
      description text DEFAULT '''',
      severity text NOT NULL DEFAULT ''medium''
        CHECK (severity IN (''low'',''medium'',''high'',''critical'')),
      status text NOT NULL DEFAULT ''open''
        CHECK (status IN (''open'',''in_progress'',''resolved'',''closed'')),
      assignee_id uuid,
      reported_by uuid,
      due_date date,
      created_at timestamptz DEFAULT now()
    )', schema_name, schema_name);

  EXECUTE format('
    CREATE INDEX IF NOT EXISTS issues_project_status_idx
    ON %I.issues (project_id, status)
  ', schema_name);

  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.register_entries (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id uuid NOT NULL REFERENCES %I.projects(id) ON DELETE CASCADE,
      document_no text DEFAULT '''',
      title text NOT NULL,
      revision text DEFAULT ''R0'',
      status text DEFAULT ''active''
        CHECK (status IN (''active'',''superseded'',''void'')),
      file_url text DEFAULT '''',
      created_at timestamptz DEFAULT now()
    )', schema_name, schema_name);

  EXECUTE format('
    CREATE INDEX IF NOT EXISTS register_project_idx
    ON %I.register_entries (project_id)
  ', schema_name);

  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.project_targets (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id uuid NOT NULL REFERENCES %I.projects(id) ON DELETE CASCADE,
      metric text NOT NULL,
      target_value numeric DEFAULT 0,
      current_value numeric DEFAULT 0,
      unit text DEFAULT '''',
      period text DEFAULT ''monthly''
        CHECK (period IN (''daily'',''weekly'',''monthly'',''quarterly'',''project'')),
      created_at timestamptz DEFAULT now()
    )', schema_name, schema_name);

  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.project_nomenclature (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id uuid NOT NULL REFERENCES %I.projects(id) ON DELETE CASCADE,
      prefix text NOT NULL,
      description text DEFAULT '''',
      example text DEFAULT '''',
      created_at timestamptz DEFAULT now()
    )', schema_name, schema_name);

  -- ─── Nomenclature (tasks & sub-tasks) ─────────────────────
  -- Self-referencing: rows with parent_id NULL are tasks, rows with
  -- parent_id set are sub-tasks of that task. Deleting a task cascades
  -- to its sub-tasks.
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.nomenclature (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id uuid NOT NULL REFERENCES %I.projects(id) ON DELETE CASCADE,
      parent_id uuid REFERENCES %I.nomenclature(id) ON DELETE CASCADE,
      sr_no integer NOT NULL DEFAULT 1,
      name text NOT NULL,
      description text DEFAULT '''',
      status text NOT NULL DEFAULT ''active''
        CHECK (status IN (''active'',''inactive'')),
      created_at timestamptz DEFAULT now()
    )', schema_name, schema_name, schema_name);

  EXECUTE format('
    CREATE INDEX IF NOT EXISTS nomenclature_project_idx
    ON %I.nomenclature (project_id)
  ', schema_name);

  EXECUTE format('
    CREATE INDEX IF NOT EXISTS nomenclature_parent_idx
    ON %I.nomenclature (parent_id)
  ', schema_name);
END;
$$;

-- ============================================================
-- PART 4: drop_org_schema() — called when an organization is deleted
-- ============================================================

CREATE OR REPLACE FUNCTION public.drop_org_schema(org_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  schema_name text;
BEGIN
  schema_name := public.org_schema_name(org_id);
  EXECUTE format('DROP SCHEMA IF EXISTS %I CASCADE', schema_name);
END;
$$;

-- ============================================================
-- PART 5: Backfill — provision schemas for any orgs that already
-- exist (no-op on a fresh database; create_org_schema is fully
-- idempotent, so this is also safe to re-run against a live DB
-- after this file gains new tables/columns in the future).
-- ============================================================

DO $$
DECLARE
  org RECORD;
BEGIN
  FOR org IN SELECT id FROM public.organizations LOOP
    PERFORM public.create_org_schema(org.id);
  END LOOP;
END
$$;
