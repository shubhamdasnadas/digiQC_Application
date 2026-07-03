-- DigiQC SAAS Multi-Tenant Migration
-- Run AFTER db/schema.sql (or replace the original schema)
-- Run: psql -U postgres -d digiQC -f db/migration_saas.sql

-- ============================================================
-- PUBLIC SCHEMA — shared between all organizations
-- ============================================================

-- Users table (app-level auth)
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  avatar_url text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Organization members (which users belong to which orgs)
CREATE TABLE IF NOT EXISTS public.org_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'disabled')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, organization_id)
);

-- ============================================================
-- HELPER: Derive schema name from org name
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
-- FUNCTION: Create org schema with all business tables
-- Called when a new organization is registered
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_org_schema(org_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  schema_name text;
BEGIN
  schema_name := public.org_schema_name(org_id);

  -- Create the schema
  EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', schema_name);

  -- Create all business tables in the org schema
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
      created_at timestamptz DEFAULT now()
    )', schema_name);

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
END;
$$;

-- ============================================================
-- FUNCTION: Drop org schema (cascade)
-- Called when an organization is deleted
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
-- Migrate existing data if any
-- For existing organizations, create their schemas and copy data
-- ============================================================

DO $$
DECLARE
  org RECORD;
  schema_name text;
BEGIN
  FOR org IN SELECT id FROM public.organizations LOOP
    schema_name := public.org_schema_name(org.id);

    -- Only create if schema doesn't exist yet
    IF NOT EXISTS (
      SELECT 1 FROM pg_namespace WHERE nspname = schema_name
    ) THEN
      PERFORM public.create_org_schema(org.id);

      -- Copy existing teams
      EXECUTE format('
        INSERT INTO %I.teams (id, organization_id, name, type, team_lead_name, spoc_name, created_at)
        SELECT id, organization_id, name, type, team_lead_name, spoc_name, created_at
        FROM public.teams WHERE organization_id = %L
      ', schema_name, org.id);

      -- Copy existing projects
      EXECUTE format('
        INSERT INTO %I.projects (id, organization_id, name, nomenclature, instruction, profile, image_url, status, created_at)
        SELECT id, organization_id, name, nomenclature, instruction, profile, image_url, status, created_at
        FROM public.projects WHERE organization_id = %L
      ', schema_name, org.id);

      -- Copy existing checklists (join to get correct project_ids)
      EXECUTE format('
        INSERT INTO %I.checklists (id, project_id, name, created_at)
        SELECT cl.id, cl.project_id, cl.name, cl.created_at
        FROM public.checklists cl
        JOIN public.projects p ON cl.project_id = p.id
        WHERE p.organization_id = %L
      ', schema_name, org.id);

      -- Copy existing super_admins
      EXECUTE format('
        INSERT INTO %I.super_admins (id, organization_id, name, email, mobile_no, roles, created_at)
        SELECT id, organization_id, name, email, mobile_no, roles, created_at
        FROM public.super_admins WHERE organization_id = %L
      ', schema_name, org.id);
    END IF;
  END LOOP;
END;
$$;


-- ============================================================
-- Rename any legacy UUID-based org schemas to org_<name>
-- Safe to re-run: skips already-renamed, drops orphan UUID schemas
-- ============================================================

DO $$
DECLARE
  rec        RECORD;
  uuid_schema text;
  target     text;
BEGIN
  FOR rec IN
    SELECT n.nspname AS uuid_schema, o.id, o.name
    FROM pg_namespace n
    JOIN public.organizations o
      ON n.nspname = 'org_' || replace(o.id::text, '-', '_')
    WHERE n.nspname ~ '^org_[0-9a-f]{8}_[0-9a-f]{4}_[0-9a-f]{4}_[0-9a-f]{4}_[0-9a-f]{12}$'
  LOOP
    target := public.org_schema_name(rec.id);

    IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = target) THEN
      -- Target already exists: drop the leftover UUID schema
      EXECUTE format('DROP SCHEMA %I CASCADE', rec.uuid_schema);
      RAISE NOTICE 'Dropped orphan schema % (% already exists)', rec.uuid_schema, target;
    ELSE
      -- Rename UUID schema to name-based schema
      EXECUTE format('ALTER SCHEMA %I RENAME TO %I', rec.uuid_schema, target);
      RAISE NOTICE 'Renamed % -> %', rec.uuid_schema, target;
    END IF;
  END LOOP;
END;
$$;
