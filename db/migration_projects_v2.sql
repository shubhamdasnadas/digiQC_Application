-- DigiQC Projects Module v2 Migration
-- Run AFTER db/migration_saas.sql (which creates the per-org schemas)
-- Run: psql -U postgres -d digiQC -f db/migration_projects_v2.sql
--
-- This migration:
--   1. Extends the per-org `projects` table with the full form fields
--   2. Adds the supporting tables for project module tabs
--      (eqcs, issues, register_entries, project_members, project_teams,
--       project_targets, project_nomenclature)
--   3. Wires the same DDL into `public.create_org_schema()` so any new
--      organization created later gets the full module set automatically.

-- ============================================================
-- PART 1: Extend the existing `projects` table
-- ============================================================

DO $$
DECLARE
  sch text;
BEGIN
  FOR sch IN
    SELECT nspname FROM pg_namespace
    WHERE nspname LIKE 'org_%'
  LOOP
    -- Extend projects with the new fields
    EXECUTE format('
      ALTER TABLE %I.projects
        ADD COLUMN IF NOT EXISTS unique_code text,
        ADD COLUMN IF NOT EXISTS client_name text DEFAULT '''',
        ADD COLUMN IF NOT EXISTS description text DEFAULT '''',
        ADD COLUMN IF NOT EXISTS project_admin_id uuid,
        ADD COLUMN IF NOT EXISTS radius_m integer DEFAULT 100,
        ADD COLUMN IF NOT EXISTS timezone text DEFAULT ''Asia/Calcutta'',
        ADD COLUMN IF NOT EXISTS latitude double precision,
        ADD COLUMN IF NOT EXISTS longitude double precision,
        ADD COLUMN IF NOT EXISTS address text DEFAULT '''',
        ADD COLUMN IF NOT EXISTS perm_location boolean DEFAULT false,
        ADD COLUMN IF NOT EXISTS perm_authentication boolean DEFAULT false,
        ADD COLUMN IF NOT EXISTS perm_rfi boolean DEFAULT false,
        ADD COLUMN IF NOT EXISTS updated_by uuid,
        ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
    ', sch);

    -- Unique code must be unique per org
    EXECUTE format('
      CREATE UNIQUE INDEX IF NOT EXISTS projects_org_unique_code_idx
      ON %I.projects (organization_id, unique_code)
      WHERE unique_code IS NOT NULL;
    ', sch);
  END LOOP;
END
$$;

-- ============================================================
-- PART 2: Create the project module tables in every org schema
-- ============================================================

DO $$
DECLARE
  sch text;
BEGIN
  FOR sch IN
    SELECT nspname FROM pg_namespace
    WHERE nspname LIKE 'org_%'
  LOOP
    -- ─── Project members (Assigned Users + My Role) ──────────
    EXECUTE format('
      CREATE TABLE IF NOT EXISTS %I.project_members (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id uuid NOT NULL REFERENCES %I.projects(id) ON DELETE CASCADE,
        user_id uuid NOT NULL,
        role text NOT NULL DEFAULT ''member''
          CHECK (role IN (''admin'',''member'',''inspector'',''approver'',''viewer'')),
        added_at timestamptz DEFAULT now(),
        UNIQUE(project_id, user_id)
      );
    ', sch, sch);

    EXECUTE format('
      CREATE INDEX IF NOT EXISTS project_members_project_idx
      ON %I.project_members (project_id);
    ', sch);

    -- ─── Project <-> Teams link ─────────────────────────────
    EXECUTE format('
      CREATE TABLE IF NOT EXISTS %I.project_teams (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id uuid NOT NULL REFERENCES %I.projects(id) ON DELETE CASCADE,
        team_id uuid NOT NULL REFERENCES %I.teams(id) ON DELETE CASCADE,
        added_at timestamptz DEFAULT now(),
        UNIQUE(project_id, team_id)
      );
    ', sch, sch, sch);

    -- ─── EQC records ────────────────────────────────────────
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
        created_at timestamptz DEFAULT now()
      );
    ', sch, sch);

    EXECUTE format('
      CREATE INDEX IF NOT EXISTS eqcs_project_status_idx
      ON %I.eqcs (project_id, status);
    ', sch);

    EXECUTE format('
      CREATE INDEX IF NOT EXISTS eqcs_project_rfi_idx
      ON %I.eqcs (project_id) WHERE rfi_id IS NOT NULL;
    ', sch);

    -- ─── Issues ─────────────────────────────────────────────
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
      );
    ', sch, sch);

    EXECUTE format('
      CREATE INDEX IF NOT EXISTS issues_project_status_idx
      ON %I.issues (project_id, status);
    ', sch);

    -- ─── Register (drawings / documents) ─────────────────────
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
      );
    ', sch, sch);

    EXECUTE format('
      CREATE INDEX IF NOT EXISTS register_project_idx
      ON %I.register_entries (project_id);
    ', sch);

    -- ─── Targets ────────────────────────────────────────────
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
      );
    ', sch, sch);

    -- ─── Nomenclature ───────────────────────────────────────
    EXECUTE format('
      CREATE TABLE IF NOT EXISTS %I.project_nomenclature (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id uuid NOT NULL REFERENCES %I.projects(id) ON DELETE CASCADE,
        prefix text NOT NULL,
        description text DEFAULT '''',
        example text DEFAULT '''',
        created_at timestamptz DEFAULT now()
      );
    ', sch, sch);
  END LOOP;
END
$$;

-- ============================================================
-- PART 3: Update create_org_schema() so NEW orgs get the same DDL
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

  -- ─── Core tables (kept in sync with migration_saas.sql) ──
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.teams (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL,
      name text NOT NULL,
      type text DEFAULT ''inspection'',
      team_lead_name text DEFAULT '''',
      spoc_name text DEFAULT '''',
      created_at timestamptz DEFAULT now()
    )', schema_name);

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

  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.checklists (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id uuid NOT NULL,
      name text NOT NULL,
      created_at timestamptz DEFAULT now()
    )', schema_name);

  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.checklist_stages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      checklist_id uuid NOT NULL,
      sr_no integer NOT NULL DEFAULT 1,
      name text NOT NULL,
      created_at timestamptz DEFAULT now()
    )', schema_name);

  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.checkpoints (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      stage_id uuid NOT NULL,
      question text NOT NULL,
      input_type text NOT NULL DEFAULT ''yes_no'',
      drawing_required boolean DEFAULT false,
      witness_required boolean DEFAULT false,
      created_at timestamptz DEFAULT now()
    )', schema_name);

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

  -- ─── Project module tables (new in v2) ──────────────────
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.project_members (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id uuid NOT NULL REFERENCES %I.projects(id) ON DELETE CASCADE,
      user_id uuid NOT NULL,
      role text NOT NULL DEFAULT ''member'',
      added_at timestamptz DEFAULT now(),
      UNIQUE(project_id, user_id)
    )', schema_name, schema_name);

  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.project_teams (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id uuid NOT NULL REFERENCES %I.projects(id) ON DELETE CASCADE,
      team_id uuid NOT NULL REFERENCES %I.teams(id) ON DELETE CASCADE,
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
      stage_result text DEFAULT ''pending'',
      approver_id uuid,
      approver_log text DEFAULT '''',
      status text NOT NULL DEFAULT ''pending'',
      inspected_by uuid,
      inspected_at timestamptz,
      rfi_id uuid,
      notes text DEFAULT '''',
      created_at timestamptz DEFAULT now()
    )', schema_name, schema_name);

  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.issues (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id uuid NOT NULL REFERENCES %I.projects(id) ON DELETE CASCADE,
      title text NOT NULL,
      description text DEFAULT '''',
      severity text NOT NULL DEFAULT ''medium'',
      status text NOT NULL DEFAULT ''open'',
      assignee_id uuid,
      reported_by uuid,
      due_date date,
      created_at timestamptz DEFAULT now()
    )', schema_name, schema_name);

  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.register_entries (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id uuid NOT NULL REFERENCES %I.projects(id) ON DELETE CASCADE,
      document_no text DEFAULT '''',
      title text NOT NULL,
      revision text DEFAULT ''R0'',
      status text DEFAULT ''active'',
      file_url text DEFAULT '''',
      created_at timestamptz DEFAULT now()
    )', schema_name, schema_name);

  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.project_targets (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id uuid NOT NULL REFERENCES %I.projects(id) ON DELETE CASCADE,
      metric text NOT NULL,
      target_value numeric DEFAULT 0,
      current_value numeric DEFAULT 0,
      unit text DEFAULT '''',
      period text DEFAULT ''monthly'',
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
END;
$$;

-- ============================================================
-- PART 4: Backfill any pre-existing orgs that don't have the
-- new tables yet (e.g. if migration_saas.sql ran before this).
-- create_org_schema() is idempotent (IF NOT EXISTS) so it's safe
-- to call again.
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
