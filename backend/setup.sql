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

-- ============================================================
-- PART 6: Legacy flat checklist import table (from checklist.sql)
-- ============================================================

CREATE TABLE public.checklist (
    checklist_name character varying(100)[],
    reference_number character varying(100)[],
    stage_name character varying(100)[],
    checkpoint character varying(500)[],
    yn text[],
    photo boolean[],
    remark boolean[]
);


ALTER TABLE public.checklist OWNER TO postgres;

--
-- TOC entry 4164 (class 0 OID 422876)
-- Dependencies: 319
-- Data for Name: checklist; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.checklist (checklist_name, reference_number, stage_name, checkpoint, yn, photo, remark) FROM stdin;
{"Arch - Beam & Slab Checking"}	{PCPL/ARCH/BEAM-SLAB-SHT/2024/0001}	{"Single Stage"}	{"Slab Shuttering Measurements checked properly?"}	{Y/N}	{f}	{t}
{"Arch - Beam & Slab Checking"}	{PCPL/ARCH/BEAM-SLAB-SHT/2024/0001}	{"Single Stage"}	{"Dowells for RCC walls is properly kept?"}	{Y/N}	{t}	{f}
{"Arch - Beam & Slab Checking"}	{PCPL/ARCH/BEAM-SLAB-SHT/2024/0001}	{"Single Stage"}	{"Cut-outs in beams and slab are properly placed"}	{Y/N}	{t}	{f}
{"Arch - Beam & Slab Checking"}	{PCPL/ARCH/BEAM-SLAB-SHT/2024/0001}	{"Single Stage"}	{"Sleeves in beams and slab are properly placed?"}	{Y/N}	{t}	{f}
{"Arch - Beam & Slab Checking"}	{PCPL/ARCH/BEAM-SLAB-SHT/2024/0001}	{"Single Stage"}	{"Electrical conduits: are placed properly?\ni. Conduit from Duct to main DB in flats\nii. Conduits from DB to switchboard and light/fan points laid as per lower floor blockwork location."}	{Y/N}	{t}	{f}
{"Arch - Beam & Slab Checking"}	{PCPL/ARCH/BEAM-SLAB-SHT/2024/0001}	{"Single Stage"}	{"Electrical points : are placed properly?\ni. Ceiling Lights\nii. Ceiling Fan\niii. Beam Light\niv. Chajja Light"}	{Y/N}	{t}	{f}
{"Arch - Beam & Slab Checking"}	{PCPL/ARCH/BEAM-SLAB-SHT/2024/0001}	{"Single Stage"}	{"Chajja Slab : Location, length, sunk etc is proper?"}	{Y/N}	{f}	{t}
{"Arch - Beam & Slab Checking"}	{PCPL/ARCH/BEAM-SLAB-SHT/2024/0001}	{"Single Stage"}	{"Duct beams with service slab are properly measured?"}	{Y/N}	{f}	{f}
{"Arch - Beam & Slab Checking"}	{PCPL/ARCH/BEAM-SLAB-SHT/2024/0001}	{"Single Stage"}	{"Staircase landing/midlanding beams are correctly measured?"}	{Y/N}	{t}	{f}
{"Arch - Beam & Slab Checking"}	{PCPL/ARCH/BEAM-SLAB-SHT/2024/0001}	{"Single Stage"}	{"Toilet beam near loft entry"}	{Y/N}	{t}	{f}
{"Arch - Beam & Slab Checking"}	{PCPL/ARCH/BEAM-SLAB-SHT/2024/0001}	{"Single Stage"}	{"Kitchen beam reduction near sunk as per drawing?"}	{Y/N}	{f}	{f}
{"Arch - Beam & Slab Checking"}	{PCPL/ARCH/BEAM-SLAB-SHT/2024/0001}	{"Single Stage"}	{"Beam Depths is correct & as per drawing?"}	{Y/N}	{t}	{t}
{"Arch - Beam & Slab Checking"}	{PCPL/ARCH/BEAM-SLAB-SHT/2024/0001}	{"Single Stage"}	{"Beam locations is correct & as per drawing?"}	{Y/N}	{t}	{f}
{"Arch - Beam & Slab Checking"}	{PCPL/ARCH/BEAM-SLAB-SHT/2024/0001}	{"Single Stage"}	{"Raise Slab is correctly measured?"}	{Y/N}	{f}	{f}
{"Arch - Beam & Slab Checking"}	{PCPL/ARCH/BEAM-SLAB-SHT/2024/0001}	{"Single Stage"}	{"Sunk Slab is correctly measured?"}	{Y/N}	{t}	{f}
{"Arch - Beam & Slab Checking"}	{PCPL/ARCH/BEAM-SLAB-SHT/2024/0001}	{"Single Stage"}	{"Slab level (TOS) checked?"}	{Y/N}	{f}	{f}
{"Arch - Below Plinth Column Checking"}	{PCPL/ARCH/BLW-PLT-COL-CHK/2024/0001}	{"Single Stage"}	{"Plinth beam level and depth above the columns are checked properly?"}	{Y/N}	{f}	{t}
{"Arch - Below Plinth Column Checking"}	{PCPL/ARCH/BLW-PLT-COL-CHK/2024/0001}	{"Single Stage"}	{"Set-out box reference verified w.r. of (Length, Width, Diagonals) ?"}	{Y/N}	{t}	{f}
{"Arch - Below Plinth Column Checking"}	{PCPL/ARCH/BLW-PLT-COL-CHK/2024/0001}	{"Single Stage"}	{"Centerline point : X-Axis Point of Each Column"}	{Y/N}	{t}	{t}
{"Arch - Below Plinth Column Checking"}	{PCPL/ARCH/BLW-PLT-COL-CHK/2024/0001}	{"Single Stage"}	{"Centerline point : Y-Axis Point of Each Column"}	{Y/N}	{t}	{t}
{"Arch - Below Plinth Column Checking"}	{PCPL/ARCH/BLW-PLT-COL-CHK/2024/0001}	{"Single Stage"}	{"Size of column is correct?"}	{Y/N}	{f}	{t}
{"Arch - Below Plinth Column Checking"}	{PCPL/ARCH/BLW-PLT-COL-CHK/2024/0001}	{"Single Stage"}	{"Distance between each column is correct?"}	{Y/N}	{f}	{t}
{"Arch - Below Plinth Column Checking"}	{PCPL/ARCH/BLW-PLT-COL-CHK/2024/0001}	{"Single Stage"}	{"Column Height : Upto Plinth beam bottom level is correct?"}	{Y/N}	{t}	{t}
{"Arch - Centreline"}	{PCPL/ARCH/CENTRELINE/2024/0001}	{"Single Stage"}	{"Set-Out Box Full length and Diagonal dimension (Kath-Kona) & Open Space Checked?"}	{Y/N}	{t}	{t}
{"Arch - Centreline"}	{PCPL/ARCH/CENTRELINE/2024/0001}	{"Single Stage"}	{"Centerline : Y-Axis Points (to be checked on line-dori fixed on opposite side railings)"}	{TEXT}	{f}	{t}
{"Arch - Centreline"}	{PCPL/ARCH/CENTRELINE/2024/0001}	{"Single Stage"}	{"Centerline : X-Axis Points  (to be checked on line-dori fixed on opposite side railings)"}	{TEXT}	{f}	{t}
{"Arch - Centreline"}	{PCPL/ARCH/CENTRELINE/2024/0001}	{"Single Stage"}	{"Road Level Marking (0.00m level) and FGL marking"}	{Y/N}	{t}	{t}
{"Arch - Column Starter"}	{PCPL/ARCH/COL-STARTER/2024/0001}	{"Single Stage"}	{"Column Kat-kona (right-angle) is correct?"}	{Y/N}	{t}	{f}
{"Arch - Column Starter"}	{PCPL/ARCH/COL-STARTER/2024/0001}	{"Single Stage"}	{"Column reduction or skew, if any?"}	{Y/N}	{f}	{t}
{"Arch - Column Starter"}	{PCPL/ARCH/COL-STARTER/2024/0001}	{"Single Stage"}	{"Is provision kept for Electrical Box/points on columns (if any)"}	{Y/N}	{t}	{f}
{"Arch - Column Starter"}	{PCPL/ARCH/COL-STARTER/2024/0001}	{"Single Stage"}	{"Is Column Centreline proper?"}	{Y/N}	{t}	{f}
{"Arch - Column Starter"}	{PCPL/ARCH/COL-STARTER/2024/0001}	{"Single Stage"}	{"Distances between column/columns are proper?"}	{Y/N}	{t}	{f}
{"Arch - Column Starter"}	{PCPL/ARCH/COL-STARTER/2024/0001}	{"Single Stage"}	{"Column Sizes are proper?"}	{Y/N}	{t}	{f}
{"Arch - Complete Plinth Checking"}	{PCPL/ARCH/COMP-PL-CHK/2024/0001}	{"Single Stage"}	{"Surrounding Ground level Marking (FGL)"}	{TEXT}	{t}	{f}
{"Arch - Complete Plinth Checking"}	{PCPL/ARCH/COMP-PL-CHK/2024/0001}	{"Single Stage"}	{"Is Road Level Marking (0.00m level)?"}	{TEXT}	{t}	{f}
{"Arch - Complete Plinth Checking"}	{PCPL/ARCH/COMP-PL-CHK/2024/0001}	{"Single Stage"}	{"Trenches to be left in plinth grade slab for services lines to pass?"}	{Y/N}	{t}	{f}
{"Arch - Complete Plinth Checking"}	{PCPL/ARCH/COMP-PL-CHK/2024/0001}	{"Single Stage"}	{"Are IOD Open Spaces kept properly as per measurements?"}	{Y/N}	{t}	{f}
{"Arch - Complete Plinth Checking"}	{PCPL/ARCH/COMP-PL-CHK/2024/0001}	{"Single Stage"}	{"Open Spaces are kept as per measurements?"}	{Y/N}	{t}	{f}
{"Arch - Complete Plinth Checking"}	{PCPL/ARCH/COMP-PL-CHK/2024/0001}	{"Single Stage"}	{"Plinth beam measurements"}	{TEXT}	{f}	{t}
{"Arch - Complete Plinth Checking"}	{PCPL/ARCH/COMP-PL-CHK/2024/0001}	{"Single Stage"}	{"Plinth Kat-Kona (Right-Angle)is correct?"}	{Y/N}	{t}	{f}
{"Arch - Complete Plinth Checking"}	{PCPL/ARCH/COMP-PL-CHK/2024/0001}	{"Single Stage"}	{"Plinth Level: Substation (if any), Meter room etc."}	{TEXT}	{t}	{f}
{"Arch - Complete Plinth Checking"}	{PCPL/ARCH/COMP-PL-CHK/2024/0001}	{"Single Stage"}	{"Plinth Level: Internal Chowks as per drawing?"}	{TEXT}	{t}	{f}
{"Arch - Complete Plinth Checking"}	{PCPL/ARCH/COMP-PL-CHK/2024/0001}	{"Single Stage"}	{"Plinth Level: Shops, if any as per drawing?"}	{TEXT}	{t}	{f}
{"Arch - Complete Plinth Checking"}	{PCPL/ARCH/COMP-PL-CHK/2024/0001}	{"Single Stage"}	{"Plinth Level: Entrance Lobby as per drawing?"}	{TEXT}	{t}	{f}
{"Arch - Complete Plinth Checking"}	{PCPL/ARCH/COMP-PL-CHK/2024/0001}	{"Single Stage"}	{"Plinth Level: Stilt as per drawing?"}	{TEXT}	{t}	{f}
{"Arch - Door Framing"}	{PCPL/ARCH/DOOR-FRAMING/2024/0001}	{"Single Stage"}	{"Kitchen Door frame -- Granite main frame : chamfer, half round, full round moulding on Passage/living room side"}	{Y/N}	{f}	{f}
{"Arch - Door Framing"}	{PCPL/ARCH/DOOR-FRAMING/2024/0001}	{"Single Stage"}	{"Living Room Door frame -- Double khacha wooden frame"}	{Y/N}	{f}	{f}
{"Arch - Door Framing"}	{PCPL/ARCH/DOOR-FRAMING/2024/0001}	{"Single Stage"}	{"Living Room Door frame -- Projected out from masonry line as per plaster and POP thickness from lobby side."}	{Y/N}	{f}	{f}
{"Arch - Door Framing"}	{PCPL/ARCH/DOOR-FRAMING/2024/0001}	{"Single Stage"}	{"Living Room Door frame -- Horn projection to be chiseled."}	{Y/N}	{f}	{f}
{"Arch - Door Framing"}	{PCPL/ARCH/DOOR-FRAMING/2024/0001}	{"Single Stage"}	{"Bed Room Door frame -- Single khacha wooden frame"}	{Y/N}	{f}	{f}
{"Arch - Door Framing"}	{PCPL/ARCH/DOOR-FRAMING/2024/0001}	{"Single Stage"}	{"Bed Room Door frame -- Projected out from masonry line as per plaster and POP thickness from passage side."}	{Y/N}	{f}	{f}
{"Arch - Door Framing"}	{PCPL/ARCH/DOOR-FRAMING/2024/0001}	{"Single Stage"}	{"Bed Room Door frame -- Horn projection to be chiseled."}	{Y/N}	{f}	{f}
{"Arch - Door Framing"}	{PCPL/ARCH/DOOR-FRAMING/2024/0001}	{"Single Stage"}	{"Toilet Door frame -- Granite subframe Location and thickness, projected out from masonry work to flush with toilet dado"}	{Y/N}	{f}	{f}
{"Arch - Door Framing"}	{PCPL/ARCH/DOOR-FRAMING/2024/0001}	{"Single Stage"}	{"Toilet Door frame -- Granite main frame width."}	{Y/N}	{f}	{f}
{"Arch - Door Framing"}	{PCPL/ARCH/DOOR-FRAMING/2024/0001}	{"Single Stage"}	{"Toilet Door frame -- Granite main frame : chamfer, half round, full round moulding on passage/bedroom side."}	{Y/N}	{f}	{f}
{"Arch - Door Framing"}	{PCPL/ARCH/DOOR-FRAMING/2024/0001}	{"Single Stage"}	{"Toilet Door frame -- Granite main frame : projected out from the masonry work to flush with skirting tile on the passage/bedroom side."}	{Y/N}	{f}	{f}
{"Arch - Door Framing"}	{PCPL/ARCH/DOOR-FRAMING/2024/0001}	{"Single Stage"}	{"Toilet Door frame -- Granite threshold in line with main frame with chamfer."}	{Y/N}	{f}	{f}
{"Arch - Door Framing"}	{PCPL/ARCH/DOOR-FRAMING/2024/0001}	{"Single Stage"}	{"Kitchen Door frame -- Granite subframe Location and thickness,  projected out from masonry work to flush with Kitchen dado."}	{Y/N}	{f}	{f}
{"Arch - Door Framing"}	{PCPL/ARCH/DOOR-FRAMING/2024/0001}	{"Single Stage"}	{"Kitchen Door frame -- Granite main frame width."}	{Y/N}	{f}	{f}
{"Arch - Door Framing"}	{PCPL/ARCH/DOOR-FRAMING/2024/0001}	{"Single Stage"}	{"Kitchen Door frame -- Granite main frame : projected out from the masonry work to flush with skirting tile on the passage/living room side."}	{Y/N}	{f}	{f}
{"Arch - Electrical Checklist"}	{PCPL/ARCH/ELECTRICAL/2024/0001}	{"Single Stage"}	{"Kitchen -- Main switch board location and points."}	{Y/N}	{f}	{f}
{"Arch - Electrical Checklist"}	{PCPL/ARCH/ELECTRICAL/2024/0001}	{"Single Stage"}	{"Bedroom -- Ceiling light and fan points, chajja light, beam light points, AC point etc."}	{Y/N}	{f}	{f}
{"Arch - Electrical Checklist"}	{PCPL/ARCH/ELECTRICAL/2024/0001}	{"Single Stage"}	{"Bedroom -- AC Switch and point"}	{Y/N}	{f}	{f}
{"Arch - Electrical Checklist"}	{PCPL/ARCH/ELECTRICAL/2024/0001}	{"Single Stage"}	{"Bedroom -- TV switch board location and points"}	{Y/N}	{f}	{f}
{"Arch - Electrical Checklist"}	{PCPL/ARCH/ELECTRICAL/2024/0001}	{"Single Stage"}	{"Bedroom -- Side table switch board location and points"}	{Y/N}	{f}	{f}
{"Arch - Electrical Checklist"}	{PCPL/ARCH/ELECTRICAL/2024/0001}	{"Single Stage"}	{"Bedroom -- Main switch board location and points."}	{Y/N}	{f}	{f}
{"Arch - Electrical Checklist"}	{PCPL/ARCH/ELECTRICAL/2024/0001}	{"Single Stage"}	{"Toilet -- Clashes of electrical lines and points with plumbing lines and/or tile joints."}	{Y/N}	{f}	{f}
{"Arch - Electrical Checklist"}	{PCPL/ARCH/ELECTRICAL/2024/0001}	{"Single Stage"}	{"Toilet -- Gyeser point location and height"}	{Y/N}	{f}	{f}
{"Arch - Electrical Checklist"}	{PCPL/ARCH/ELECTRICAL/2024/0001}	{"Single Stage"}	{"Toilet -- Exhaust point location and height"}	{Y/N}	{f}	{f}
{"Arch - Electrical Checklist"}	{PCPL/ARCH/ELECTRICAL/2024/0001}	{"Single Stage"}	{"Kitchen -- Washing machine point location and height"}	{Y/N}	{f}	{f}
{"Arch - Electrical Checklist"}	{PCPL/ARCH/ELECTRICAL/2024/0001}	{"Single Stage"}	{"Kitchen -- Ceiling light and fan points, chajja light, beam light points."}	{Y/N}	{f}	{f}
{"Arch - Electrical Checklist"}	{PCPL/ARCH/ELECTRICAL/2024/0001}	{"Single Stage"}	{"Kitchen -- Clashes of Ceiling light/fan point with sunk slab etc."}	{Y/N}	{f}	{f}
{"Arch - Electrical Checklist"}	{PCPL/ARCH/ELECTRICAL/2024/0001}	{"Single Stage"}	{"Kitchen -- Clashes with plumbing lines and/or tile joints."}	{Y/N}	{f}	{f}
{"Arch - Electrical Checklist"}	{PCPL/ARCH/ELECTRICAL/2024/0001}	{"Single Stage"}	{"Kitchen -- Clashes of electrical lines and points with plumbing lines and/or tile joints."}	{Y/N}	{f}	{f}
{"Arch - Electrical Checklist"}	{PCPL/ARCH/ELECTRICAL/2024/0001}	{"Single Stage"}	{"Kitchen -- Aqua guard point location and height"}	{Y/N}	{f}	{f}
{"Arch - Electrical Checklist"}	{PCPL/ARCH/ELECTRICAL/2024/0001}	{"Single Stage"}	{"Kitchen -- Microwave, mixer points Location and height from platform."}	{Y/N}	{f}	{f}
{"Arch - Electrical Checklist"}	{PCPL/ARCH/ELECTRICAL/2024/0001}	{"Single Stage"}	{"Kitchen -- Fridge point location, height."}	{Y/N}	{f}	{f}
{"Arch - Electrical Checklist"}	{PCPL/ARCH/ELECTRICAL/2024/0001}	{"Single Stage"}	{"Living room -- Ceiling light and fan points, chajja light, beam light points, AC point etc."}	{Y/N}	{f}	{f}
{"Arch - Electrical Checklist"}	{PCPL/ARCH/ELECTRICAL/2024/0001}	{"Single Stage"}	{"Living room -- Dining area switch board locaion, height and points"}	{Y/N}	{f}	{f}
{"Arch - Electrical Checklist"}	{PCPL/ARCH/ELECTRICAL/2024/0001}	{"Single Stage"}	{"Living room -- AC Switch and point : location and height"}	{Y/N}	{f}	{f}
{"Arch - Electrical Checklist"}	{PCPL/ARCH/ELECTRICAL/2024/0001}	{"Single Stage"}	{"Toilet -- Main switch board location and points."}	{Y/N}	{f}	{f}
{"Arch - Electrical Checklist"}	{PCPL/ARCH/ELECTRICAL/2024/0001}	{"Single Stage"}	{"Toilet -- Light Point location and height"}	{Y/N}	{f}	{f}
{"Arch - Electrical Checklist"}	{PCPL/ARCH/ELECTRICAL/2024/0001}	{"Single Stage"}	{"Living room -- TV switch board location, height and points"}	{Y/N}	{f}	{f}
{"Arch - Electrical Checklist"}	{PCPL/ARCH/ELECTRICAL/2024/0001}	{"Single Stage"}	{"Living room -- Side table switch board location, height and points"}	{Y/N}	{f}	{f}
{"Arch - Electrical Checklist"}	{PCPL/ARCH/ELECTRICAL/2024/0001}	{"Single Stage"}	{"Living room -- Main switch board location, height and points."}	{Y/N}	{f}	{f}
{"Arch - Electrical Checklist"}	{PCPL/ARCH/ELECTRICAL/2024/0001}	{"Single Stage"}	{"General -- Bell Buzzer location"}	{Y/N}	{f}	{f}
{"Arch - Electrical Checklist"}	{PCPL/ARCH/ELECTRICAL/2024/0001}	{"Single Stage"}	{"General -- LV board location, size."}	{Y/N}	{f}	{f}
{"Arch - Electrical Checklist"}	{PCPL/ARCH/ELECTRICAL/2024/0001}	{"Single Stage"}	{"General -- DB Location, Size and depth"}	{Y/N}	{f}	{f}
{"Arch - Electrical Checklist"}	{PCPL/ARCH/ELECTRICAL/2024/0001}	{"Single Stage"}	{"Kitchen -- Exhaust point and switch location and height"}	{Y/N}	{f}	{f}
{"Arch - Electrical Checklist"}	{PCPL/ARCH/ELECTRICAL/2024/0001}	{"Single Stage"}	{"Passage -- Main switch board location, height and points."}	{Y/N}	{f}	{f}
{"Arch - Electrical Checklist"}	{PCPL/ARCH/ELECTRICAL/2024/0001}	{"Single Stage"}	{"Bedroom -- Night Lamp point location and height if provided."}	{Y/N}	{f}	{f}
{"Arch - Excavation"}	{PCPL/ARCH/EXCVN/2024/0001}	{"Single Stage"}	{"Proximity of trees to excavation area checked on site?"}	{Y/N}	{t}	{t}
{"Arch - Excavation"}	{PCPL/ARCH/EXCVN/2024/0001}	{"Single Stage"}	{"Proximity of compound wall to excavation area checked on site?"}	{Y/N}	{t}	{t}
{"Arch - Excavation"}	{PCPL/ARCH/EXCVN/2024/0001}	{"Single Stage"}	{"Check any precautions need to be taken, if excavation is planned in rainy season."}	{Y/N}	{f}	{t}
{"Arch - Excavation"}	{PCPL/ARCH/EXCVN/2024/0001}	{"Single Stage"}	{"Road Level Marking (0.00m level) and FGL marking"}	{Y/N}	{t}	{t}
{"Arch - Excavation"}	{PCPL/ARCH/EXCVN/2024/0001}	{"Single Stage"}	{"Set-Out Box : Full length (all four sides) & Diagonals (Kath-Kona) are checked?"}	{Y/N}	{t}	{t}
{"Arch - Excavation"}	{PCPL/ARCH/EXCVN/2024/0001}	{"Single Stage"}	{"Set-Out Box :Diagonals (Kath-kona)"}	{Y/N}	{f}	{f}
{"Arch - Excavation"}	{PCPL/ARCH/EXCVN/2024/0001}	{"Single Stage"}	{"Excavation Depth : Geotechnical Consultant checking and Report"}	{Y/N}	{f}	{f}
{"Arch - Excavation"}	{PCPL/ARCH/EXCVN/2024/0001}	{"Single Stage"}	{"Excavation Depth : Structural Consultant Checking done at site?"}	{Y/N}	{f}	{t}
{"Arch - Excavation"}	{PCPL/ARCH/EXCVN/2024/0001}	{"Single Stage"}	{"Excavation depth confirmed by Geotechnical consultant?"}	{Y/N}	{t}	{f}
{"Arch - Excavation"}	{PCPL/ARCH/EXCVN/2024/0001}	{"Single Stage"}	{"Ground Water table as per the geo technical report is verified?"}	{Y/N}	{f}	{t}
{"Arch - Flooring"}	{PCPL/ARCH/FLRNG/2024/0001}	{"Single Stage"}	{"Bedroom -- Skirting checking : height offset from wall if any, groove in gypsum, finishing near door frames."}	{Y/N}	{f}	{f}
{"Arch - Flooring"}	{PCPL/ARCH/FLRNG/2024/0001}	{"Single Stage"}	{"Passage -- Tile joint near kitchen, bedrooms and toilet"}	{Y/N}	{f}	{f}
{"Arch - Flooring"}	{PCPL/ARCH/FLRNG/2024/0001}	{"Single Stage"}	{"Passage -- Tile drop near toilet"}	{Y/N}	{f}	{f}
{"Arch - Flooring"}	{PCPL/ARCH/FLRNG/2024/0001}	{"Single Stage"}	{"Passage -- Any other point"}	{Y/N}	{f}	{f}
{"Arch - Flooring"}	{PCPL/ARCH/FLRNG/2024/0001}	{"Single Stage"}	{"Kitchen -- Tile Size"}	{Y/N}	{f}	{f}
{"Arch - Flooring"}	{PCPL/ARCH/FLRNG/2024/0001}	{"Single Stage"}	{"Kitchen -- Start point tile"}	{Y/N}	{f}	{f}
{"Arch - Flooring"}	{PCPL/ARCH/FLRNG/2024/0001}	{"Single Stage"}	{"Kitchen -- Line-out of tiles: one row and one columns to check the cut-tiles"}	{Y/N}	{f}	{f}
{"Arch - Flooring"}	{PCPL/ARCH/FLRNG/2024/0001}	{"Single Stage"}	{"Kitchen -- Wastage adjusted as per the site line-out"}	{Y/N}	{f}	{f}
{"Arch - Flooring"}	{PCPL/ARCH/FLRNG/2024/0001}	{"Single Stage"}	{"Kitchen -- Tile raise below platform"}	{Y/N}	{f}	{f}
{"Arch - Flooring"}	{PCPL/ARCH/FLRNG/2024/0001}	{"Single Stage"}	{"Bedroom -- Start point tile"}	{Y/N}	{f}	{f}
{"Arch - Flooring"}	{PCPL/ARCH/FLRNG/2024/0001}	{"Single Stage"}	{"Bedroom -- Line-out of tiles: one row and one columns to check the cut-tiles"}	{Y/N}	{f}	{f}
{"Arch - Flooring"}	{PCPL/ARCH/FLRNG/2024/0001}	{"Single Stage"}	{"Bedroom -- Wastage adjusted as per the site line-out"}	{Y/N}	{f}	{f}
{"Arch - Flooring"}	{PCPL/ARCH/FLRNG/2024/0001}	{"Single Stage"}	{"Bedroom -- Door area tile joint"}	{Y/N}	{f}	{f}
{"Arch - Flooring"}	{PCPL/ARCH/FLRNG/2024/0001}	{"Single Stage"}	{"Living Room -- Tile Size"}	{Y/N}	{f}	{f}
{"Arch - Flooring"}	{PCPL/ARCH/FLRNG/2024/0001}	{"Single Stage"}	{"Living Room -- Start point tile"}	{Y/N}	{f}	{f}
{"Arch - Flooring"}	{PCPL/ARCH/FLRNG/2024/0001}	{"Single Stage"}	{"Living Room -- Line-out of tiles: one row and one columns to check the cut-tiles"}	{Y/N}	{f}	{f}
{"Arch - Flooring"}	{PCPL/ARCH/FLRNG/2024/0001}	{"Single Stage"}	{"Living Room -- Wastage adjusted as per the site line-out"}	{Y/N}	{f}	{f}
{"Arch - Flooring"}	{PCPL/ARCH/FLRNG/2024/0001}	{"Single Stage"}	{"Living Room -- Main Door Threshold tile joint"}	{Y/N}	{f}	{f}
{"Arch - Flooring"}	{PCPL/ARCH/FLRNG/2024/0001}	{"Single Stage"}	{"Living Room -- Skirting checking : height, offset from wall if any, groove in gypsum, finishing near door frames."}	{Y/N}	{f}	{f}
{"Arch - Flooring"}	{PCPL/ARCH/FLRNG/2024/0001}	{"Single Stage"}	{"Passage -- Tile Size"}	{Y/N}	{f}	{f}
{"Arch - Flooring"}	{PCPL/ARCH/FLRNG/2024/0001}	{"Single Stage"}	{"Passage -- Tile joints, cut tiles etc."}	{Y/N}	{f}	{f}
{"Arch - Flooring"}	{PCPL/ARCH/FLRNG/2024/0001}	{"Single Stage"}	{"Passage -- Wastage adjusted as per the site line-out"}	{Y/N}	{f}	{f}
{"Arch - Kitchen & Toilet Dado"}	{PCPL/ARCH/KIT-TOIL-DADO/2024/0001}	{"Kitchen Area"}	{"Finished floor level marking on site checked on all the walls?"}	{Y/N}	{f}	{f}
{"Arch - Kitchen & Toilet Dado"}	{PCPL/ARCH/KIT-TOIL-DADO/2024/0001}	{"Kitchen Area"}	{"Door side wall :  Tile marking: Start tile, cut-tile, adjustments as per wastage and tile joint"}	{Y/N}	{t}	{f}
{"Arch - Kitchen & Toilet Dado"}	{PCPL/ARCH/KIT-TOIL-DADO/2024/0001}	{"Kitchen Area"}	{"Window side wall :  Tile marking: Start tile, cut-tile, adjustments as per wastage and tile joint"}	{Y/N}	{t}	{f}
{"Arch - Kitchen & Toilet Dado"}	{PCPL/ARCH/KIT-TOIL-DADO/2024/0001}	{"Kitchen Area"}	{"Right hand side wall :  Tile marking: Start tile, cut-tile, adjustments as per wastage and tile joint"}	{Y/N}	{t}	{f}
{"Arch - Kitchen & Toilet Dado"}	{PCPL/ARCH/KIT-TOIL-DADO/2024/0001}	{"Kitchen Area"}	{"Left hand side wall :  Tile marking: Start tile, cut-tile, adjustments as per wastage and tile joint"}	{Y/N}	{t}	{f}
{"Arch - Kitchen & Toilet Dado"}	{PCPL/ARCH/KIT-TOIL-DADO/2024/0001}	{"Toilet Area"}	{"Left hand side wall :  Tile marking: Start tile, cut-tile, adjustments as per wastage and tile joint"}	{Y/N}	{t}	{f}
{"Arch - Kitchen & Toilet Dado"}	{PCPL/ARCH/KIT-TOIL-DADO/2024/0001}	{"Toilet Area"}	{"Finished floor level marking on site on all the walls"}	{Y/N}	{f}	{f}
{"Arch - Kitchen & Toilet Dado"}	{PCPL/ARCH/KIT-TOIL-DADO/2024/0001}	{"Toilet Area"}	{"Door side wall :  Tile marking: Start tile, cut-tile, adjustments as per wastage and tile joint"}	{Y/N}	{t}	{f}
{"Arch - Kitchen & Toilet Dado"}	{PCPL/ARCH/KIT-TOIL-DADO/2024/0001}	{"Toilet Area"}	{"Window side wall :  Tile marking: Start tile, cut-tile, adjustments as per wastage and tile joint"}	{Y/N}	{t}	{f}
{"Arch - Kitchen & Toilet Dado"}	{PCPL/ARCH/KIT-TOIL-DADO/2024/0001}	{"Toilet Area"}	{"Right hand side wall :  Tile marking: Start tile, cut-tile, adjustments as per wastage and tile joint"}	{Y/N}	{t}	{f}
{"Arch - Masonry Work"}	{PCPL/ARCH/MSNRY/2024/0001}	{"Single Stage"}	{"Electrical conduit location in beams with respect to masonry location."}	{Y/N}	{f}	{f}
{"Arch - Masonry Work"}	{PCPL/ARCH/MSNRY/2024/0001}	{"Single Stage"}	{"100mm thick walls is verified as per drawing?"}	{Y/N}	{f}	{f}
{"Arch - Masonry Work"}	{PCPL/ARCH/MSNRY/2024/0001}	{"Single Stage"}	{"Staircase span as per approved drawing?"}	{Y/N}	{f}	{f}
{"Arch - Masonry Work"}	{PCPL/ARCH/MSNRY/2024/0001}	{"Single Stage"}	{"Lobby Measurement as per approved drawing?"}	{Y/N}	{f}	{f}
{"Arch - Masonry Work"}	{PCPL/ARCH/MSNRY/2024/0001}	{"Single Stage"}	{"Parapet wall height marking is true and as per the drawing?"}	{Y/N}	{f}	{f}
{"Arch - Masonry Work"}	{PCPL/ARCH/MSNRY/2024/0001}	{"Single Stage"}	{"Verify if any wall is marked as RCC wall in approved drawing?"}	{Y/N}	{f}	{f}
{"Arch - Masonry Work"}	{PCPL/ARCH/MSNRY/2024/0001}	{"Single Stage"}	{"150mm thick walls is verified as per drawing?"}	{Y/N}	{f}	{f}
{"Arch - Masonry Work"}	{PCPL/ARCH/MSNRY/2024/0001}	{"Single Stage"}	{"Plum of the lineout from the beam above for offset is verified?"}	{Y/N}	{f}	{f}
{"Arch - Masonry Work"}	{PCPL/ARCH/MSNRY/2024/0001}	{"Single Stage"}	{"Diagonals (Kath-kona) of the masonry lineout is checked?"}	{Y/N}	{f}	{f}
{"Arch - Masonry Work"}	{PCPL/ARCH/MSNRY/2024/0001}	{"Single Stage"}	{"Masonry Lineout measurements as per WD?"}	{Y/N}	{f}	{f}
{"Arch - Masonry Work"}	{PCPL/ARCH/MSNRY/2024/0001}	{"Single Stage"}	{"Finished floor level marking is verified?"}	{Y/N}	{f}	{f}
{"Arch - Masonry Work"}	{PCPL/ARCH/MSNRY/2024/0001}	{"Single Stage"}	{"Duct area masonry work required? (if any)"}	{Y/N}	{f}	{f}
{"Arch - Masonry Work"}	{PCPL/ARCH/MSNRY/2024/0001}	{"Single Stage"}	{"Sunk Slab area lineout, offset etc. as per drawing?"}	{Y/N}	{f}	{f}
{"Arch - Masonry Work"}	{PCPL/ARCH/MSNRY/2024/0001}	{"Single Stage"}	{"Raise slab area lineout. offset etc. as per drawing?"}	{Y/N}	{f}	{f}
{"Quality - Internal Painting"}	{PCPL/QUAL/INTERNAL-PAINTING/2024/0001}	{Post}	{"Checked for brush marks?"}	{Y/N}	{t}	{f}
{"Arch - Masonry Work"}	{PCPL/ARCH/MSNRY/2024/0001}	{"Single Stage"}	{"Window location, Sill and lintel marking from finished floor level/top of finishing (TOF) level. (For all the windows including toilet windows)"}	{Y/N}	{f}	{f}
{"Arch - Masonry Work"}	{PCPL/ARCH/MSNRY/2024/0001}	{"Single Stage"}	{"Door location and lintel marking from finished floor level/top of finishing (TOF) level. (For all the doors)"}	{Y/N}	{f}	{f}
{"Arch - Plinth Beam Checking"}	{PCPL/ARCH/PL-BEAM/2024/0001}	{"Single Stage"}	{"Open Space Checked as per IOD Plan?"}	{Y/N}	{f}	{f}
{"Arch - Plinth Beam Checking"}	{PCPL/ARCH/PL-BEAM/2024/0001}	{"Single Stage"}	{"Provision of trench for services is provided?"}	{Y/N}	{f}	{f}
{"Arch - Plinth Beam Checking"}	{PCPL/ARCH/PL-BEAM/2024/0001}	{"Single Stage"}	{"Is Road Level Marking marked (0.00m level)?"}	{Y/N}	{t}	{f}
{"Arch - Plinth Beam Checking"}	{PCPL/ARCH/PL-BEAM/2024/0001}	{"Single Stage"}	{"Surrounding Ground level Marking (FGL)"}	{Y/N}	{f}	{t}
{"Arch - Plinth Beam Checking"}	{PCPL/ARCH/PL-BEAM/2024/0001}	{"Single Stage"}	{"Checked Plinth Level: Stilt as per drawing?"}	{Y/N}	{t}	{f}
{"Arch - Plinth Beam Checking"}	{PCPL/ARCH/PL-BEAM/2024/0001}	{"Single Stage"}	{"Checked Plinth Level: Entrance Lobby as per drawing?"}	{Y/N}	{t}	{f}
{"Arch - Plinth Beam Checking"}	{PCPL/ARCH/PL-BEAM/2024/0001}	{"Single Stage"}	{"Checked Plinth Level: Shops as per drawing?"}	{Y/N}	{t}	{f}
{"Arch - Plinth Beam Checking"}	{PCPL/ARCH/PL-BEAM/2024/0001}	{"Single Stage"}	{"Checked Plinth Level: Internal Chowk as per drawing?"}	{Y/N}	{t}	{f}
{"Arch - Plinth Beam Checking"}	{PCPL/ARCH/PL-BEAM/2024/0001}	{"Single Stage"}	{"Checked Plinth Level: Substation (if any), Meter room etc."}	{Y/N}	{t}	{f}
{"Arch - Plinth Beam Checking"}	{PCPL/ARCH/PL-BEAM/2024/0001}	{"Single Stage"}	{"Plinth beam levels checked properly?"}	{Y/N}	{t}	{f}
{"Arch - Plinth Beam Checking"}	{PCPL/ARCH/PL-BEAM/2024/0001}	{"Single Stage"}	{"Plinth beam Sizes checked properly?"}	{Y/N}	{t}	{f}
{"Arch - Plinth Beam Checking"}	{PCPL/ARCH/PL-BEAM/2024/0001}	{"Single Stage"}	{"Plinth Beam location checked properly?"}	{Y/N}	{t}	{f}
{"Arch - Plinth Beam Checking"}	{PCPL/ARCH/PL-BEAM/2024/0001}	{"Single Stage"}	{"Plinth Beam Gala Kath-Kona (Diagonals) are checked properly?"}	{Y/N}	{t}	{f}
{"Arch - Plinth Beam Checking"}	{PCPL/ARCH/PL-BEAM/2024/0001}	{"Single Stage"}	{"Sleeves in Plinth beams for services?"}	{Y/N}	{t}	{f}
{"Arch - Plinth Beam Checking"}	{PCPL/ARCH/PL-BEAM/2024/0001}	{"Single Stage"}	{"Are Plinth beams affected due to services?"}	{Y/N}	{f}	{t}
{"Arch - Plumbing Checklist"}	{PCPL/ARCH/PLUMBING/2024/0001}	{"Single Stage"}	{"Kitchen -- Location and size of Kitchen Sink and platform is correct?"}	{Y/N}	{f}	{f}
{"Arch - Plumbing Checklist"}	{PCPL/ARCH/PLUMBING/2024/0001}	{"Single Stage"}	{"Kitchen -- Location of Sink Cock and height as per tile marking is correct?"}	{Y/N}	{f}	{f}
{"Arch - Plumbing Checklist"}	{PCPL/ARCH/PLUMBING/2024/0001}	{"Single Stage"}	{"Kitchen -- Location of the Nahani Trap is correct?"}	{Y/N}	{f}	{f}
{"Arch - Plumbing Checklist"}	{PCPL/ARCH/PLUMBING/2024/0001}	{"Single Stage"}	{"Kitchen -- Location of Washing machine drainage point and connection to the nahani trap is correct?"}	{Y/N}	{f}	{f}
{"Arch - Plumbing Checklist"}	{PCPL/ARCH/PLUMBING/2024/0001}	{"Single Stage"}	{"Kitchen -- Aquaguard point location and height as per tile marking is correct?"}	{Y/N}	{f}	{f}
{"Arch - Plumbing Checklist"}	{PCPL/ARCH/PLUMBING/2024/0001}	{"Single Stage"}	{"Kitchen -- Washing machine water supply point location and height is correct?"}	{Y/N}	{f}	{f}
{"Arch - Plumbing Checklist"}	{PCPL/ARCH/PLUMBING/2024/0001}	{"Single Stage"}	{"Kitchen -- Clashes of plumning lines and points with electrical lines/switchboards and/or tile joints are checked?"}	{Y/N}	{f}	{f}
{"Arch - Plumbing Checklist"}	{PCPL/ARCH/PLUMBING/2024/0001}	{"Single Stage"}	{"Toilet -- Location, size and height of washbasin is correct?"}	{Y/N}	{f}	{f}
{"Arch - Plumbing Checklist"}	{PCPL/ARCH/PLUMBING/2024/0001}	{"Single Stage"}	{"Toilet -- Location of washbasin spout/tap is correct?"}	{Y/N}	{f}	{f}
{"Arch - Plumbing Checklist"}	{PCPL/ARCH/PLUMBING/2024/0001}	{"Single Stage"}	{"Toilet -- Location of WC and height is correct?"}	{Y/N}	{f}	{f}
{"Arch - Plumbing Checklist"}	{PCPL/ARCH/PLUMBING/2024/0001}	{"Single Stage"}	{"Toilet -- Location of flush valve and height is correct?"}	{Y/N}	{f}	{f}
{"Arch - Plumbing Checklist"}	{PCPL/ARCH/PLUMBING/2024/0001}	{"Single Stage"}	{"Toilet -- Location and height of two way bib cock with jet spray is correct?"}	{Y/N}	{f}	{f}
{"Arch - Plumbing Checklist"}	{PCPL/ARCH/PLUMBING/2024/0001}	{"Single Stage"}	{"Toilet -- Location and heights of the diverter, spout and shower is correct?"}	{Y/N}	{f}	{f}
{"Arch - Plumbing Checklist"}	{PCPL/ARCH/PLUMBING/2024/0001}	{"Single Stage"}	{"Toilet -- Loft tank angle cock location and height is correct?"}	{Y/N}	{f}	{f}
{"Arch - Plumbing Checklist"}	{PCPL/ARCH/PLUMBING/2024/0001}	{"Single Stage"}	{"Toilet -- Location and height of angle cock for gyeser  is correct?"}	{Y/N}	{f}	{f}
{"Arch - Plumbing Checklist"}	{PCPL/ARCH/PLUMBING/2024/0001}	{"Single Stage"}	{"Toilet -- point and angle cock for gyeser and gyeser position is correct?"}	{Y/N}	{f}	{f}
{"Arch - Plumbing Checklist"}	{PCPL/ARCH/PLUMBING/2024/0001}	{"Single Stage"}	{"Toilet -- Clashes of plumbing lines and points with electrical lines/switchboards and/or tile joints are checked?"}	{Y/N}	{f}	{f}
{"Arch - Pre Demolition"}	{PCPL/ARCH/PRE-DEMOL/2024/0001}	{"Single Stage"}	{"Existing trees : Is required tree cutting done on site as per NOC received?"}	{Y/N}	{f}	{f}
{"Arch - Pre Demolition"}	{PCPL/ARCH/PRE-DEMOL/2024/0001}	{"Single Stage"}	{"Disconnecting chamber location marked?"}	{Y/N}	{f}	{f}
{"Arch - Pre Demolition"}	{PCPL/ARCH/PRE-DEMOL/2024/0001}	{"Single Stage"}	{"Existing well : Current condition is acceptable, please add remarks in case of repairing/re-construction is needed?"}	{Y/N}	{f}	{f}
{"Arch - Pre Demolition"}	{PCPL/ARCH/PRE-DEMOL/2024/0001}	{"Single Stage"}	{"Front Branding elevation design prepared and executed?"}	{Y/N}	{f}	{f}
{"Arch - Pre Demolition"}	{PCPL/ARCH/PRE-DEMOL/2024/0001}	{"Single Stage"}	{"Master file drawing discussed with site team for site constraints?"}	{Y/N}	{f}	{f}
{"Arch - Pre Demolition"}	{PCPL/ARCH/PRE-DEMOL/2024/0001}	{"Single Stage"}	{"Existing Substation : Application for temporary shifting, if required."}	{Y/N}	{f}	{f}
{"Arch - Pre Demolition"}	{PCPL/ARCH/PRE-DEMOL/2024/0001}	{"Single Stage"}	{"Existing Substation : If present then location needs to be marked."}	{Y/N}	{f}	{t}
{"Arch - Pre Demolition"}	{PCPL/ARCH/PRE-DEMOL/2024/0001}	{"Single Stage"}	{"Existing trees : Obstructing the construction area, driveway?"}	{Y/N}	{f}	{f}
{"Arch - Pre Demolition"}	{PCPL/ARCH/PRE-DEMOL/2024/0001}	{"Single Stage"}	{"Existing Compound wall :  Current condition, any repairs / re-construction needed?"}	{Y/N}	{f}	{f}
{"Arch - Pre Demolition"}	{PCPL/ARCH/PRE-DEMOL/2024/0001}	{"Single Stage"}	{"Carraigeway permission to be taken in case new gates are to be executed on site for construction stage"}	{Y/N}	{f}	{f}
{"Arch - Pre Demolition"}	{PCPL/ARCH/PRE-DEMOL/2024/0001}	{"Single Stage"}	{"Existing Entry Exit gates : Feasible to be used during construction?"}	{Y/N}	{f}	{f}
{"Arch - Pre Demolition"}	{PCPL/ARCH/PRE-DEMOL/2024/0001}	{"Single Stage"}	{"Site logistic plan is discussed & prepared?"}	{Y/N}	{t}	{t}
{"Arch - Pre Demolition"}	{PCPL/ARCH/PRE-DEMOL/2024/0001}	{"Single Stage"}	{"Demolition plan : ( Indicating what needs to be retained )"}	{Y/N}	{f}	{t}
{"Arch - Pre Demolition"}	{PCPL/ARCH/PRE-DEMOL/2024/0001}	{"Single Stage"}	{"Setback checking done as per demarcation plan?"}	{Y/N}	{f}	{f}
{"Arch - Pre Demolition"}	{PCPL/ARCH/PRE-DEMOL/2024/0001}	{"Single Stage"}	{"Fixed Points on Plot / Plot boundary for Set-Out start?"}	{Y/N}	{f}	{f}
{"Arch - Pre Demolition"}	{PCPL/ARCH/PRE-DEMOL/2024/0001}	{"Single Stage"}	{"Road Level marking on site  (+0.00m) done & Checked the road levels at multiple points throughout the width of the site?"}	{Y/N}	{t}	{f}
{"Arch - Pre Demolition"}	{PCPL/ARCH/PRE-DEMOL/2024/0001}	{"Single Stage"}	{"Existing trees: If Yes, then is tree cutting NOC received?"}	{Y/N}	{f}	{f}
{"Arch - Retaining Wall Checklist"}	{PCPL/ARCH/RETNG-WALL/2024/0001}	{"Single Stage"}	{"Retaining wall : Length in Metres"}	{Y/N}	{f}	{t}
{"Arch - Retaining Wall Checklist"}	{PCPL/ARCH/RETNG-WALL/2024/0001}	{"Single Stage"}	{"Retaining wall : Thickness Metres"}	{Y/N}	{f}	{t}
{"Arch - Retaining Wall Checklist"}	{PCPL/ARCH/RETNG-WALL/2024/0001}	{"Single Stage"}	{"Retaining wall : Pour plan approved by Structural consultant?"}	{Y/N}	{f}	{t}
{"Arch - Retaining Wall Checklist"}	{PCPL/ARCH/RETNG-WALL/2024/0001}	{"Single Stage"}	{"Retaining wall : cut-outs for services, if any"}	{Y/N}	{t}	{t}
{"Arch - Retaining Wall Checklist"}	{PCPL/ARCH/RETNG-WALL/2024/0001}	{"Single Stage"}	{"Blinding wall on Shore piles?"}	{Y/N}	{t}	{f}
{"Arch - Retaining Wall Checklist"}	{PCPL/ARCH/RETNG-WALL/2024/0001}	{"Single Stage"}	{"Waterproofing on Blinding wall done?"}	{Y/N}	{t}	{f}
{"Arch - Retaining Wall Checklist"}	{PCPL/ARCH/RETNG-WALL/2024/0001}	{"Single Stage"}	{"Retaining wall : Cover provision"}	{Y/N}	{f}	{t}
{"Arch - Retaining Wall Checklist"}	{PCPL/ARCH/RETNG-WALL/2024/0001}	{"Single Stage"}	{"Retaining wall : Height in Metres"}	{Y/N}	{f}	{t}
{"Arch - Retaining Wall Checklist"}	{PCPL/ARCH/RETNG-WALL/2024/0001}	{"Single Stage"}	{"Retaining wall : Location."}	{Y/N}	{f}	{t}
{"Arch - Setout"}	{PCPL/ARCH/SETOUT/2024/0001}	{"Single Stage"}	{"Temporary Meter location"}	{Y/N}	{t}	{f}
{"Arch - Setout"}	{PCPL/ARCH/SETOUT/2024/0001}	{"Single Stage"}	{"Site workers toilet location"}	{Y/N}	{t}	{f}
{"Arch - Setout"}	{PCPL/ARCH/SETOUT/2024/0001}	{"Single Stage"}	{"Building Set-Out Box Start Points from 2 or max 4 Fixed Points on Plot Boundary?"}	{Y/N}	{f}	{f}
{"Arch - Setout"}	{PCPL/ARCH/SETOUT/2024/0001}	{"Single Stage"}	{"Fixed Points on Plot / Plot boundary for Set-Out start?"}	{Y/N}	{f}	{f}
{"Arch - Setout"}	{PCPL/ARCH/SETOUT/2024/0001}	{"Single Stage"}	{"Proposed Ground level marking (FGL) is done?"}	{Y/N}	{f}	{t}
{"Arch - Setout"}	{PCPL/ARCH/SETOUT/2024/0001}	{"Single Stage"}	{"Existing Ground level marking is done?"}	{Y/N}	{f}	{t}
{"Arch - Setout"}	{PCPL/ARCH/SETOUT/2024/0001}	{"Single Stage"}	{"Road Level Marking (0.00m level) is marked?"}	{Y/N}	{f}	{t}
{"Arch - Setout"}	{PCPL/ARCH/SETOUT/2024/0001}	{"Single Stage"}	{"Building Set-Out Box setting from the Start points"}	{Y/N}	{f}	{f}
{"Arch - Setout"}	{PCPL/ARCH/SETOUT/2024/0001}	{"Single Stage"}	{"Set-Out Box : Full length (all four sides)"}	{Y/N}	{f}	{t}
{"Arch - Setout"}	{PCPL/ARCH/SETOUT/2024/0001}	{"Single Stage"}	{"Set-Out Box :Diagonals (Kath-kona)"}	{Y/N}	{f}	{t}
{"Arch - Setout"}	{PCPL/ARCH/SETOUT/2024/0001}	{"Single Stage"}	{"Open-Spaces on all sides (should be as per IOD Plan)"}	{Y/N}	{f}	{t}
{"Arch - Setout"}	{PCPL/ARCH/SETOUT/2024/0001}	{"Single Stage"}	{"Once Set-out box and open spaces are found to be ok, pillar to be cast on all four corners of plot to keep a fixed marking of set-our box ."}	{Y/N}	{f}	{t}
{"Arch - Setout"}	{PCPL/ARCH/SETOUT/2024/0001}	{"Single Stage"}	{"Disconnecting chamber location and depth"}	{Y/N}	{t}	{t}
{"Arch - Shore Pile Centreline"}	{PCPL/ARCH/SHR-PL-CL/2024/0001}	{"Single Stage"}	{"Set-Out Box Full length and Diagonal dimension (Kath-Kona)"}	{Y/N}	{f}	{t}
{"Arch - Shore Pile Centreline"}	{PCPL/ARCH/SHR-PL-CL/2024/0001}	{"Single Stage"}	{"Shore pile Centerline : X-Axis Points"}	{Y/N}	{t}	{f}
{"Arch - Shore Pile Centreline"}	{PCPL/ARCH/SHR-PL-CL/2024/0001}	{"Single Stage"}	{"Shore pile Centerline : Y-Axis Points"}	{Y/N}	{t}	{f}
{"Arch - Shore Pile Centreline"}	{PCPL/ARCH/SHR-PL-CL/2024/0001}	{"Single Stage"}	{"Existing trees : Obstructing for shore piles?"}	{Y/N}	{t}	{f}
{"Arch - Shore Pile Centreline"}	{PCPL/ARCH/SHR-PL-CL/2024/0001}	{"Single Stage"}	{"Shore piles Levels : Top level of capping beam as per drawing?"}	{Y/N}	{f}	{f}
{"Arch - Shore Pile Centreline"}	{PCPL/ARCH/SHR-PL-CL/2024/0001}	{"Single Stage"}	{"Road Level Marking (0.00m level) and FGL marking"}	{Y/N}	{f}	{t}
{"Arch - Shuttering for Footing"}	{PCPL/ARCH/SHT-FOOTING/2024/0001}	{"Single Stage"}	{"Re-checked the set-out box, diagonals, openspaces and centerline marking on railing patti transferred in excavated area."}	{Y/N}	{f}	{f}
{"Arch - Shuttering for Footing"}	{PCPL/ARCH/SHT-FOOTING/2024/0001}	{"Single Stage"}	{"Waterproofing on Blinding wall on Shore piles in case of Basement/UGT/Pits?"}	{Y/N}	{t}	{f}
{"Arch - Shuttering for Footing"}	{PCPL/ARCH/SHT-FOOTING/2024/0001}	{"Single Stage"}	{"Blinding wall on Shore piles in case of Basement/UGT/Pits is done?"}	{Y/N}	{f}	{f}
{"Arch - Shuttering for Footing"}	{PCPL/ARCH/SHT-FOOTING/2024/0001}	{"Single Stage"}	{"Lift/car pit pardi dowels : Provision left?"}	{Y/N}	{f}	{f}
{"Arch - Shuttering for Footing"}	{PCPL/ARCH/SHT-FOOTING/2024/0001}	{"Single Stage"}	{"Tie beam Dowels : Provision left?"}	{Y/N}	{f}	{f}
{"Arch - Shuttering for Footing"}	{PCPL/ARCH/SHT-FOOTING/2024/0001}	{"Single Stage"}	{"Retaining wall dowels : Provision left?"}	{Y/N}	{f}	{f}
{"Arch - Shuttering for Footing"}	{PCPL/ARCH/SHT-FOOTING/2024/0001}	{"Single Stage"}	{"Raft Dowels : Provision left?"}	{Y/N}	{f}	{f}
{"Arch - Shuttering for Footing"}	{PCPL/ARCH/SHT-FOOTING/2024/0001}	{"Single Stage"}	{"Bottom level of footing as per drawing/soil report."}	{Y/N}	{f}	{f}
{"Arch - Shuttering for Footing"}	{PCPL/ARCH/SHT-FOOTING/2024/0001}	{"Single Stage"}	{"Raft : Pressure release pipe provision in case of basement/pits /high ground water table or as suggested by structural consultant?"}	{Y/N}	{f}	{f}
{"Arch - Shuttering for Footing"}	{PCPL/ARCH/SHT-FOOTING/2024/0001}	{"Single Stage"}	{"Raft : Pour plan/Phase plan approved by structural consultant?"}	{Y/N}	{f}	{f}
{"Arch - Shuttering for Footing"}	{PCPL/ARCH/SHT-FOOTING/2024/0001}	{"Single Stage"}	{"Bottom Waterproofing : provision in case of pits, basement raft etc done properly?"}	{Y/N}	{f}	{f}
{"Arch - Shuttering for Footing"}	{PCPL/ARCH/SHT-FOOTING/2024/0001}	{"Single Stage"}	{"PCC : In level and without undulations"}	{Y/N}	{f}	{f}
{"Arch - Shuttering for Footing"}	{PCPL/ARCH/SHT-FOOTING/2024/0001}	{"Single Stage"}	{"Footing Cover of same strength properly placed?"}	{Y/N}	{f}	{f}
{"Arch - Shuttering for Footing"}	{PCPL/ARCH/SHT-FOOTING/2024/0001}	{"Single Stage"}	{"Distance between surrounding footings?"}	{Y/N}	{f}	{f}
{"Arch - Shuttering for Footing"}	{PCPL/ARCH/SHT-FOOTING/2024/0001}	{"Single Stage"}	{"Size of each footing (LxBxH) with offset from the column sides/center are correctly measured?"}	{Y/N}	{f}	{f}
{"Arch - Shuttering for Footing"}	{PCPL/ARCH/SHT-FOOTING/2024/0001}	{"Single Stage"}	{"Size of footing pedestal"}	{Y/N}	{t}	{t}
{"Arch - Shuttering for Footing"}	{PCPL/ARCH/SHT-FOOTING/2024/0001}	{"Single Stage"}	{"Size of column of each footing and pedestal is checked?"}	{Y/N}	{f}	{f}
{"Arch - Shuttering for Footing"}	{PCPL/ARCH/SHT-FOOTING/2024/0001}	{"Single Stage"}	{"Centerline point : Y-Axis Point of Each Column? Mention Column No."}	{Y/N}	{t}	{t}
{"Arch - Shuttering for Footing"}	{PCPL/ARCH/SHT-FOOTING/2024/0001}	{"Single Stage"}	{"Centerline point : X-Axis Point of Each Column? Mention Column No."}	{Y/N}	{t}	{t}
{"Arch - Shuttering for Footing"}	{PCPL/ARCH/SHT-FOOTING/2024/0001}	{"Single Stage"}	{"Column Shuttering patti fixed to check column centers? (khilla marking needed)"}	{Y/N}	{f}	{f}
{"Arch - Shuttering for Footing"}	{PCPL/ARCH/SHT-FOOTING/2024/0001}	{"Single Stage"}	{"Transfer set-out box and centerling from ground level to railing in excavated pit i.e. Excavated area."}	{Y/N}	{t}	{t}
{"Arch - Shuttering for Footing"}	{PCPL/ARCH/SHT-FOOTING/2024/0001}	{"Single Stage"}	{"Footing depth : Khilla marking for pour depth is checked?"}	{Y/N}	{f}	{t}
{"Arch - Slab Shuttering"}	{PCPL/ARCH/SLB-SHT/2024/0001}	{"Single Stage"}	{"Slab : Outer Offset-measurements as per Architectural WD?"}	{Y/N}	{f}	{t}
{"Arch - Slab Shuttering"}	{PCPL/ARCH/SLB-SHT/2024/0001}	{"Single Stage"}	{"Slab Shuttering Measurements of each gala is true and correct?"}	{Y/N}	{f}	{f}
{"Arch - Slab Shuttering"}	{PCPL/ARCH/SLB-SHT/2024/0001}	{"Single Stage"}	{"Slab Gala diagonal measurements (Kath Kona) are proper?"}	{Y/N}	{f}	{f}
{"Arch - Slab Shuttering"}	{PCPL/ARCH/SLB-SHT/2024/0001}	{"Single Stage"}	{"Slab Level checking : T.O.S. as per WD ?"}	{Y/N}	{f}	{t}
{"Arch - Slab Shuttering"}	{PCPL/ARCH/SLB-SHT/2024/0001}	{"Single Stage"}	{"Sunk Slab : Specifically check the offset of sunk compared to wall/beam"}	{Y/N}	{f}	{f}
{"Arch - Slab Shuttering"}	{PCPL/ARCH/SLB-SHT/2024/0001}	{"Single Stage"}	{"Raise Slab"}	{Y/N}	{f}	{f}
{"Arch - Slab Shuttering"}	{PCPL/ARCH/SLB-SHT/2024/0001}	{"Single Stage"}	{"Beam Location is as per drawing?"}	{Y/N}	{t}	{f}
{"Arch - Slab Shuttering"}	{PCPL/ARCH/SLB-SHT/2024/0001}	{"Single Stage"}	{"Beam Depth is as per drawing?"}	{Y/N}	{t}	{f}
{"Arch - Slab Shuttering"}	{PCPL/ARCH/SLB-SHT/2024/0001}	{"Single Stage"}	{"Kitchen beam reduction near sunk as per drawing?"}	{Y/N}	{f}	{t}
{"Arch - Slab Shuttering"}	{PCPL/ARCH/SLB-SHT/2024/0001}	{"Single Stage"}	{"Toilet beam near loft entry as per drawing?"}	{Y/N}	{f}	{t}
{"Arch - Slab Shuttering"}	{PCPL/ARCH/SLB-SHT/2024/0001}	{"Single Stage"}	{"Staircase landing/midlanding beams are properly measured?"}	{Y/N}	{f}	{f}
{"Arch - Slab Shuttering"}	{PCPL/ARCH/SLB-SHT/2024/0001}	{"Single Stage"}	{"Duct beams with service slab are properly measured?"}	{Y/N}	{f}	{f}
{"Arch - Slab Shuttering"}	{PCPL/ARCH/SLB-SHT/2024/0001}	{"Single Stage"}	{"Chajja Slab : Location, length, sunk etc. is proper?"}	{Y/N}	{f}	{f}
{"Arch - Slab Shuttering"}	{PCPL/ARCH/SLB-SHT/2024/0001}	{"Single Stage"}	{"Electrical points : are correctly placed?\ni. Ceiling Lights\nii. Ceiling Fan\niii. Beam Light\niv. Chajja Light"}	{Y/N}	{t}	{f}
{"Arch - Slab Shuttering"}	{PCPL/ARCH/SLB-SHT/2024/0001}	{"Single Stage"}	{"Electrical conduits: are correctly placed?\ni. Conduit from Duct to main DB in flats\nii. Conduits from DB to switchboard and light/fan points laid as per lower floor blockwork location."}	{Y/N}	{t}	{f}
{"Arch - Slab Shuttering"}	{PCPL/ARCH/SLB-SHT/2024/0001}	{"Single Stage"}	{"Shuttering change needed? (to be changed in max. after  7 slab casting)"}	{Y/N}	{f}	{f}
{"Arch - Slab Shuttering"}	{PCPL/ARCH/SLB-SHT/2024/0001}	{"Single Stage"}	{"Sleeves in beams and slab are properly placed?"}	{Y/N}	{t}	{f}
{"Arch - Slab Shuttering"}	{PCPL/ARCH/SLB-SHT/2024/0001}	{"Single Stage"}	{"Cut-outs in beams and slab are properly placed?"}	{Y/N}	{t}	{f}
{"Arch - Slab Shuttering"}	{PCPL/ARCH/SLB-SHT/2024/0001}	{"Single Stage"}	{"Dowells for RCC walls are kept properly?"}	{Y/N}	{t}	{f}
{"Arch - Slab Shuttering"}	{PCPL/ARCH/SLB-SHT/2024/0001}	{"Single Stage"}	{"Beam and Column Covers are properly placed and acceptable?"}	{Y/N}	{t}	{f}
{"Arch - Slab Shuttering"}	{PCPL/ARCH/SLB-SHT/2024/0001}	{"Single Stage"}	{"Slab Cleaning, Joint packing with tape, Oiling of shuttering etc done properly?"}	{Y/N}	{t}	{f}
{"Arch - Slab Shuttering"}	{PCPL/ARCH/SLB-SHT/2024/0001}	{"Single Stage"}	{"Slab : Outer full length and width measurements as per Architectural WD?"}	{Y/N}	{f}	{t}
{"Arch - Snag List"}	{PCPL/ARCH/SNAG-LIST/2024/0001}	{"Single Stage"}	{"Misc -- Kitchen Fins"}	{Y/N}	{f}	{f}
{"Arch - Snag List"}	{PCPL/ARCH/SNAG-LIST/2024/0001}	{"Single Stage"}	{"Misc -- Pump"}	{Y/N}	{f}	{f}
{"Arch - Snag List"}	{PCPL/ARCH/SNAG-LIST/2024/0001}	{"Single Stage"}	{"Misc -- Duct Coverage with Jali"}	{Y/N}	{f}	{f}
{"Arch - Snag List"}	{PCPL/ARCH/SNAG-LIST/2024/0001}	{"Single Stage"}	{"Misc -- Duct Fins"}	{Y/N}	{f}	{f}
{"Arch - Snag List"}	{PCPL/ARCH/SNAG-LIST/2024/0001}	{"Single Stage"}	{"Ground Floor -- Electrical Meter Panel Shutters"}	{Y/N}	{f}	{f}
{"Arch - Snag List"}	{PCPL/ARCH/SNAG-LIST/2024/0001}	{"Single Stage"}	{"Ground Floor -- Lobby Finishes"}	{Y/N}	{f}	{f}
{"Arch - Snag List"}	{PCPL/ARCH/SNAG-LIST/2024/0001}	{"Single Stage"}	{"Ground Floor -- Lifts"}	{Y/N}	{f}	{f}
{"Arch - Snag List"}	{PCPL/ARCH/SNAG-LIST/2024/0001}	{"Single Stage"}	{"Ground Floor -- Mechnical parking (working Properly )"}	{Y/N}	{f}	{f}
{"Arch - Snag List"}	{PCPL/ARCH/SNAG-LIST/2024/0001}	{"Single Stage"}	{"Ground Floor -- Paver  (No cracks/brocken, Clean)"}	{Y/N}	{f}	{f}
{"Arch - Snag List"}	{PCPL/ARCH/SNAG-LIST/2024/0001}	{"Single Stage"}	{"Ground Floor -- Compond Wall finishes (Texture, Paint)"}	{Y/N}	{f}	{f}
{"Arch - Snag List"}	{PCPL/ARCH/SNAG-LIST/2024/0001}	{"Single Stage"}	{"Ground Floor -- Gate"}	{Y/N}	{f}	{f}
{"Arch - Snag List"}	{PCPL/ARCH/SNAG-LIST/2024/0001}	{"Single Stage"}	{"Lobby Area -- Camera"}	{Y/N}	{f}	{f}
{"Arch - Snag List"}	{PCPL/ARCH/SNAG-LIST/2024/0001}	{"Single Stage"}	{"Lobby Area -- Floor Plate"}	{Y/N}	{f}	{f}
{"Arch - Snag List"}	{PCPL/ARCH/SNAG-LIST/2024/0001}	{"Single Stage"}	{"Lobby Area -- Electric Fixtures"}	{Y/N}	{f}	{f}
{"Arch - Snag List"}	{PCPL/ARCH/SNAG-LIST/2024/0001}	{"Single Stage"}	{"Lobby Area -- Granite Frame Finishing & Polishing"}	{Y/N}	{f}	{f}
{"Arch - Snag List"}	{PCPL/ARCH/SNAG-LIST/2024/0001}	{"Single Stage"}	{"Lobby Area -- Flooring (Joint Filling ,Acid Wash)"}	{Y/N}	{f}	{f}
{"Arch - Snag List"}	{PCPL/ARCH/SNAG-LIST/2024/0001}	{"Single Stage"}	{"Lobby Area -- Gypsum finish (Line level, No cracks, No dampness)"}	{Y/N}	{f}	{f}
{"Arch - Snag List"}	{PCPL/ARCH/SNAG-LIST/2024/0001}	{"Single Stage"}	{"Terrace Area -- Amenities (if any)"}	{Y/N}	{f}	{f}
{"Arch - Snag List"}	{PCPL/ARCH/SNAG-LIST/2024/0001}	{"Single Stage"}	{"Terrace Area -- Any leakges or not"}	{Y/N}	{f}	{f}
{"Arch - Snag List"}	{PCPL/ARCH/SNAG-LIST/2024/0001}	{"Single Stage"}	{"Terrace Area -- Cleaning work"}	{Y/N}	{f}	{f}
{"Arch - Snag List"}	{PCPL/ARCH/SNAG-LIST/2024/0001}	{"Single Stage"}	{"Terrace Area -- Light point"}	{Y/N}	{f}	{f}
{"Arch - Snag List"}	{PCPL/ARCH/SNAG-LIST/2024/0001}	{"Single Stage"}	{"Staircase -- Acid Wash"}	{Y/N}	{f}	{f}
{"Arch - Snag List"}	{PCPL/ARCH/SNAG-LIST/2024/0001}	{"Single Stage"}	{"Staircase -- Wall Finishes (Line level, No cracks, No dampness)"}	{Y/N}	{f}	{f}
{"Arch - Snag List"}	{PCPL/ARCH/SNAG-LIST/2024/0001}	{"Single Stage"}	{"Staircase -- Electric Fixtures"}	{Y/N}	{f}	{f}
{"Arch - Snag List"}	{PCPL/ARCH/SNAG-LIST/2024/0001}	{"Single Stage"}	{"Staircase -- Window (Granite and Marble Framing)"}	{Y/N}	{f}	{f}
{"Arch - Snag List"}	{PCPL/ARCH/SNAG-LIST/2024/0001}	{"Single Stage"}	{"Staircase -- Skirting"}	{Y/N}	{f}	{f}
{"Arch - Snag List"}	{PCPL/ARCH/SNAG-LIST/2024/0001}	{"Single Stage"}	{"Staircase -- Landing and Mid landing Flooring Finishes"}	{Y/N}	{f}	{f}
{"Arch - Snag List"}	{PCPL/ARCH/SNAG-LIST/2024/0001}	{"Single Stage"}	{"Staircase -- Tread And Riser Finishing"}	{Y/N}	{f}	{f}
{"Arch - Snag List"}	{PCPL/ARCH/SNAG-LIST/2024/0001}	{"Single Stage"}	{"Flat -- Acid wash (Cleaning and moping completed)"}	{Y/N}	{f}	{f}
{"Arch - Snag List"}	{PCPL/ARCH/SNAG-LIST/2024/0001}	{"Single Stage"}	{"Flat -- Name Plate : Installed and cleaned"}	{Y/N}	{f}	{f}
{"Arch - Snag List"}	{PCPL/ARCH/SNAG-LIST/2024/0001}	{"Single Stage"}	{"Flat -- Sleeve/conduit covering plate : All sleeves and electrical points should be covered with covering plates, no paint marks on the plate, fixed with screws."}	{Y/N}	{f}	{f}
{"Arch - Snag List"}	{PCPL/ARCH/SNAG-LIST/2024/0001}	{"Single Stage"}	{"Flat -- Beading Patti/ Moulding Patti : Moulding patti fixed on door frames, polished, no paint marks, no cracks, no chipping."}	{Y/N}	{f}	{f}
{"Arch - Snag List"}	{PCPL/ARCH/SNAG-LIST/2024/0001}	{"Single Stage"}	{"Flat -- Sagety Door Grill : Safety grill fixed properly with all screws and no gaps seen, not broken, no scratches."}	{Y/N}	{f}	{f}
{"Arch - Snag List"}	{PCPL/ARCH/SNAG-LIST/2024/0001}	{"Single Stage"}	{"Flat -- Safety Door : Edge Polishing completed, no paint marks, Clean Laminate, no bubbles in the laminate, no chiping/scratches in the laminate, Lock & other fittings working properly, all screws present in the hinges, safety grill fixed properly with all screws and no gaps seen"}	{Y/N}	{f}	{f}
{"Arch - Snag List"}	{PCPL/ARCH/SNAG-LIST/2024/0001}	{"Single Stage"}	{"Flat -- Main Door : Edge Polishing completed, no paint marks, Clean Laminate, no bubbles in the laminate, no chiping/scratches in the laminate, Lock & other fittings working properly, all screws present in the hinges."}	{Y/N}	{f}	{f}
{"Arch - Snag List"}	{PCPL/ARCH/SNAG-LIST/2024/0001}	{"Single Stage"}	{"Flat -- Window M.S.Railing : Fitting completed, celan, no paint marks, not rusted, well painted"}	{Y/N}	{f}	{f}
{"Arch - Snag List"}	{PCPL/ARCH/SNAG-LIST/2024/0001}	{"Single Stage"}	{"Flat -- Glass Railing : Fitting completed, celan, no paint marks no broken glass, no chipping"}	{Y/N}	{f}	{f}
{"Arch - Snag List"}	{PCPL/ARCH/SNAG-LIST/2024/0001}	{"Single Stage"}	{"Flat -- Plumbing & Sanitary Fitting : Fitting completed, Clean, working properly"}	{Y/N}	{f}	{f}
{"Arch - Snag List"}	{PCPL/ARCH/SNAG-LIST/2024/0001}	{"Single Stage"}	{"Flat -- Hardware : Hinges, door handles, door knobs, Aldrop, door magnet, door stopper, etc, provided, clean and in working condition, not rusted."}	{Y/N}	{f}	{f}
{"Arch - Snag List"}	{PCPL/ARCH/SNAG-LIST/2024/0001}	{"Single Stage"}	{"Flat -- Windows (with mosquito nets) : Clean, tracks clean, no paint marks, working smoothly, mosquito net clean, locks working smoothly, all screws present, rain water drainage present, louvered window operates smoothly, no broken glass"}	{Y/N}	{f}	{f}
{"Arch - Snag List"}	{PCPL/ARCH/SNAG-LIST/2024/0001}	{"Single Stage"}	{"Flat -- Granite Frame Finishing & Polishing : Finishing, no chiping/craks in frame, cracks, no wall paint marks, dhar polish/round moulding finished"}	{Y/N}	{f}	{f}
{"Arch - Snag List"}	{PCPL/ARCH/SNAG-LIST/2024/0001}	{"Single Stage"}	{"Flat -- Wooden Frame Polishing work : Finishing, no chiping in frame, cracks, no wall paint marks"}	{Y/N}	{f}	{f}
{"Arch - Snag List"}	{PCPL/ARCH/SNAG-LIST/2024/0001}	{"Single Stage"}	{"Flat -- Internal Paint : No brush strokes seen, finishing proper, on hairline cracks, no dampness"}	{Y/N}	{f}	{f}
{"Arch - Snag List"}	{PCPL/ARCH/SNAG-LIST/2024/0001}	{"Single Stage"}	{"Flat -- Switch Board : All electrical points and switchboards in line-level, clean, no paint marks, no gaps in between switchboard plate and wall, switches working smoothly"}	{Y/N}	{f}	{f}
{"Arch - Snag List"}	{PCPL/ARCH/SNAG-LIST/2024/0001}	{"Single Stage"}	{"Flat -- Electrical Work/Points : Electrical points covered with plate, clean, chajja light clean, tubelight and toilet light clean and working, Gyeser provided and working, exhaust provided and working, intercom provided"}	{Y/N}	{f}	{f}
{"Arch - Snag List"}	{PCPL/ARCH/SNAG-LIST/2024/0001}	{"Single Stage"}	{"Flat -- Loft Finishing : Gypsum and paint completed properly, clean"}	{Y/N}	{f}	{f}
{"Arch - Snag List"}	{PCPL/ARCH/SNAG-LIST/2024/0001}	{"Single Stage"}	{"Flat -- Door Frame & Door shutter finishing : Polishing completed, no paint marks, Clean Laminate, Lock & other fittings working properly, all screws present in the hinges, safety grill fixed properly with all screws and no gaps seen"}	{Y/N}	{f}	{f}
{"Arch - Snag List"}	{PCPL/ARCH/SNAG-LIST/2024/0001}	{"Single Stage"}	{"Flat -- Skirting : Height, clean, no chipping, joints filled"}	{Y/N}	{f}	{f}
{"Arch - Snag List"}	{PCPL/ARCH/SNAG-LIST/2024/0001}	{"Single Stage"}	{"Flat -- Flat Flooring : Joint Filling , Acid Wash"}	{Y/N}	{f}	{f}
{"Arch - Snag List"}	{PCPL/ARCH/SNAG-LIST/2024/0001}	{"Single Stage"}	{"Flat -- Toilet Flooring : Joint filing, No broken tiles, Complete with nahani trap"}	{Y/N}	{f}	{f}
{"Arch - Snag List"}	{PCPL/ARCH/SNAG-LIST/2024/0001}	{"Single Stage"}	{"Flat -- Toilet Dado  : Line and level, Joint Filling, No broken tiles"}	{Y/N}	{f}	{f}
{"Arch - Snag List"}	{PCPL/ARCH/SNAG-LIST/2024/0001}	{"Single Stage"}	{"Flat -- Kitchen Platform : Moulding, No cracks, Clean"}	{Y/N}	{f}	{f}
{"Arch - Snag List"}	{PCPL/ARCH/SNAG-LIST/2024/0001}	{"Single Stage"}	{"Flat -- Kitchen dado : Line and level, Joint Filling, No broken tiles"}	{Y/N}	{f}	{f}
{"Arch - Snag List"}	{PCPL/ARCH/SNAG-LIST/2024/0001}	{"Single Stage"}	{"Flat -- Running Grooves"}	{Y/N}	{f}	{f}
{"Arch - Snag List"}	{PCPL/ARCH/SNAG-LIST/2024/0001}	{"Single Stage"}	{"Flat -- Internal Paint  : Finishing"}	{Y/N}	{f}	{f}
{"Arch - Snag List"}	{PCPL/ARCH/SNAG-LIST/2024/0001}	{"Single Stage"}	{"Flat -- Gypsum finish : Line level, No cracks, No dampness"}	{Y/N}	{f}	{f}
{"Arch - Staircase & Lobby Finishing"}	{PCPL/ARCH/STRC-LOBBY-FIN/2024/0001}	{"Single Stage"}	{"Parapet height is correct?"}	{Y/N}	{f}	{f}
{"Arch - Staircase & Lobby Finishing"}	{PCPL/ARCH/STRC-LOBBY-FIN/2024/0001}	{"Single Stage"}	{"Parapet handrail detail : Wood/Granite/M.S. handrail is as per the approved design and make?"}	{Y/N}	{f}	{f}
{"Arch - Staircase & Lobby Finishing"}	{PCPL/ARCH/STRC-LOBBY-FIN/2024/0001}	{"Single Stage"}	{"Midlanding : Skirting, Granite patta, vitrified tile flooring checked?"}	{Y/N}	{t}	{f}
{"Arch - Staircase & Lobby Finishing"}	{PCPL/ARCH/STRC-LOBBY-FIN/2024/0001}	{"Single Stage"}	{"Floor number & Signage location?"}	{Y/N}	{t}	{f}
{"Arch - Staircase & Lobby Finishing"}	{PCPL/ARCH/STRC-LOBBY-FIN/2024/0001}	{"Single Stage"}	{"Ceiling : Light points, Sprinkler location etc. is correct and checked?"}	{Y/N}	{t}	{f}
{"Arch - Staircase & Lobby Finishing"}	{PCPL/ARCH/STRC-LOBBY-FIN/2024/0001}	{"Single Stage"}	{"Lobby : Fire pipe and electrical conduit panelling checked?"}	{Y/N}	{t}	{f}
{"Arch - Staircase & Lobby Finishing"}	{PCPL/ARCH/STRC-LOBBY-FIN/2024/0001}	{"Single Stage"}	{"Lobby : Granite patta near lift entrance door checked?"}	{Y/N}	{t}	{f}
{"Arch - Staircase & Lobby Finishing"}	{PCPL/ARCH/STRC-LOBBY-FIN/2024/0001}	{"Single Stage"}	{"Staircase window grill (if any)"}	{Y/N}	{f}	{f}
{"Arch - Staircase & Lobby Finishing"}	{PCPL/ARCH/STRC-LOBBY-FIN/2024/0001}	{"Single Stage"}	{"Lobby : Flooring, Skirting, Granite patta, Vitrified tile flooring checked?"}	{Y/N}	{t}	{f}
{"Arch - Staircase & Lobby Finishing"}	{PCPL/ARCH/STRC-LOBBY-FIN/2024/0001}	{"Single Stage"}	{"Skirting : Height, Joints, offset from wall, etc are checked"}	{Y/N}	{t}	{f}
{"Arch - Staircase & Lobby Finishing"}	{PCPL/ARCH/STRC-LOBBY-FIN/2024/0001}	{"Single Stage"}	{"Finished floor level marking? Kindly mention the Floor Level in remarks"}	{Y/N}	{t}	{f}
{"Arch - Staircase & Lobby Finishing"}	{PCPL/ARCH/STRC-LOBBY-FIN/2024/0001}	{"Single Stage"}	{"Tread and Riser : Joints, Width, nosing, grooves etc are checked?"}	{Y/N}	{t}	{f}
{"Arch - Staircase & Lobby Finishing"}	{PCPL/ARCH/STRC-LOBBY-FIN/2024/0001}	{"Single Stage"}	{"Clear width of Flight after plaster is checked?"}	{Y/N}	{f}	{f}
{"Arch - Staircase & Lobby Finishing"}	{PCPL/ARCH/STRC-LOBBY-FIN/2024/0001}	{"Single Stage"}	{"Finish in staircase : POP or Gudgudi Plaster, Paint etc checked?"}	{Y/N}	{t}	{f}
{"Arch - Window Framing"}	{PCPL/ARCH/WINDOW-FRAMING/2024/0001}	{"Single Stage"}	{"Living room, Bedroom, Kitchen window frame: -- Granite Main frame : chamfer, half round, full round moulding on room side."}	{Y/N}	{f}	{f}
{"Arch - Window Framing"}	{PCPL/ARCH/WINDOW-FRAMING/2024/0001}	{"Single Stage"}	{"Living room, Bedroom, Kitchen window frame: -- Marble subframe Location and width. Width to be finalized in coordination with the window vendor for width needed for aluminium frame."}	{Y/N}	{f}	{f}
{"Arch - Window Framing"}	{PCPL/ARCH/WINDOW-FRAMING/2024/0001}	{"Single Stage"}	{"Living room, Bedroom, Kitchen window frame: -- Granite main frame projected form masonry work with consideration to internal plaster, pop work and skirting."}	{Y/N}	{f}	{f}
{"Arch - Window Framing"}	{PCPL/ARCH/WINDOW-FRAMING/2024/0001}	{"Single Stage"}	{"Toilet Window -- Marble subframe Location and width. Width to be finalized in coordination with the window vendor for width needed for aluminium frame."}	{Y/N}	{f}	{f}
{"Arch - Window Framing"}	{PCPL/ARCH/WINDOW-FRAMING/2024/0001}	{"Single Stage"}	{"Toilet Window -- Granite Main frame width : to be finalized depending on the wall thickness and sub-frame width needed for the Aluminium louvered window to be accomodated."}	{Y/N}	{f}	{f}
{"Arch - Window Framing"}	{PCPL/ARCH/WINDOW-FRAMING/2024/0001}	{"Single Stage"}	{"Toilet Window -- Granite Main frame : chamfer, half round, full round moulding on toilet side."}	{Y/N}	{f}	{f}
{"Arch - Window Framing"}	{PCPL/ARCH/WINDOW-FRAMING/2024/0001}	{"Single Stage"}	{"Toilet Window -- Granite main frame projected form masonry work with consideration to dado work."}	{Y/N}	{f}	{f}
{"Arch - Window Framing"}	{PCPL/ARCH/WINDOW-FRAMING/2024/0001}	{"Single Stage"}	{"Living room, Bedroom, Kitchen window frame: -- Granite Main frame width : to be finalized depending on the wall thickness and sub-frame width needed for the Aluminium sliding window to be accomodated."}	{Y/N}	{f}	{f}
{"CRM - Joint Inspection"}	{PCPL/CRM/JOINT-INSP/2024/0001}	{"Single Stage"}	{"Tiling - Joints Properly Filled"}	{Y/N}	{f}	{f}
{"CRM - Joint Inspection"}	{PCPL/CRM/JOINT-INSP/2024/0001}	{"Single Stage"}	{"Electrification - Switches are working properly"}	{Y/N}	{f}	{f}
{"CRM - Joint Inspection"}	{PCPL/CRM/JOINT-INSP/2024/0001}	{"Single Stage"}	{"Electrification - Electric Meters are allotted to flat"}	{Y/N}	{f}	{f}
{"CRM - Joint Inspection"}	{PCPL/CRM/JOINT-INSP/2024/0001}	{"Single Stage"}	{"Kitchen Platform - Properly Fixed with No Cracks"}	{Y/N}	{f}	{f}
{"CRM - Joint Inspection"}	{PCPL/CRM/JOINT-INSP/2024/0001}	{"Single Stage"}	{"Door and Windows - Properly Fixed"}	{Y/N}	{f}	{f}
{"CRM - Joint Inspection"}	{PCPL/CRM/JOINT-INSP/2024/0001}	{"Single Stage"}	{"Door and Windows - All fittings are Proper"}	{Y/N}	{f}	{f}
{"CRM - Joint Inspection"}	{PCPL/CRM/JOINT-INSP/2024/0001}	{"Single Stage"}	{"Plumbing and Sanitary - All fittings are Proper"}	{Y/N}	{f}	{f}
{"CRM - Joint Inspection"}	{PCPL/CRM/JOINT-INSP/2024/0001}	{"Single Stage"}	{"Plumbing and Sanitary - Gaps properly Filled"}	{Y/N}	{f}	{f}
{"CRM - Joint Inspection"}	{PCPL/CRM/JOINT-INSP/2024/0001}	{"Single Stage"}	{"Doors and Windows - Opening and Closing is smooth"}	{Y/N}	{f}	{f}
{"CRM - Joint Inspection"}	{PCPL/CRM/JOINT-INSP/2024/0001}	{"Single Stage"}	{"Plumbing and Sanitary - Properly Fixed"}	{Y/N}	{f}	{f}
{"CRM - Joint Inspection"}	{PCPL/CRM/JOINT-INSP/2024/0001}	{"Single Stage"}	{"Walls & Ceiling- Painting Properly Done"}	{Y/N}	{f}	{f}
{"CRM - Joint Inspection"}	{PCPL/CRM/JOINT-INSP/2024/0001}	{"Single Stage"}	{"Walls and Ceiling - No Cracks"}	{Y/N}	{f}	{f}
{"CRM - Joint Inspection"}	{PCPL/CRM/JOINT-INSP/2024/0001}	{"Single Stage"}	{"Tiling - Level"}	{Y/N}	{f}	{f}
{"CRM - Joint Inspection"}	{PCPL/CRM/JOINT-INSP/2024/0001}	{"Single Stage"}	{"Proper Cleaning"}	{Y/N}	{f}	{f}
{"CRM - Joint Inspection"}	{PCPL/CRM/JOINT-INSP/2024/0001}	{"Single Stage"}	{"Tiling - No Cracks"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Living & Dining :-- Electrical DB"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Living & Dining :-- Window Railing/Grill"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Living & Dining :-- Chajja"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Living & Dining :-- Aluminium Sliding Window"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Living & Dining :-- Flooring & Skirting"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Living & Dining :-- Wall & Ceiling Painting"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Living & Dining :-- Main Door and Door Fittings"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Bath - 1 :-- Geyser with 3 pin socket"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Bath - 1 :-- Floor Traps with cover"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Bath - 1 :-- Wash Basin with Bottle Trap"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Bath - 1 :-- W.C with Seat Cover"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Bath - 1 :-- Aluminium Window Louvers, and Glass"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Bath - 1 :-- C.P. Sanitary Fittings"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Bath - 1 :-- Wall & Floor Tiles"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Bath - 1 :-- Door and Door Fittings"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Bath - 1 :-- Door Laminate"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Bath - 1 :-- Painting"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"BED-04 :-- Cable TV, Telephone line provision"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"BED-04 :-- Light fixtures and fittings"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"BED-04 :-- Electrical Switch Boards"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"BED-04 :-- AC sleeve/drain pipe provision"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"BED-04 :-- Door and Door Fittings"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"BED-04 :-- Door Laminate"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"BED-04 :-- Window Railing/Grill"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"BED-04 :-- Chajja"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"BED-04 :-- Aluminium Sliding Window"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Living & Dining :-- Main Door Laminate"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"BED-04 :-- Flooring & Skirting"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"BED-04 :-- Wall & Ceiling Painting"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"BED-03 :-- Cable TV, Telephone line provision"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"BED-03 :-- Light fixtures and fittings"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"BED-03 :-- Electrical Switch Boards"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"BED-03 :-- AC sleeve/Drain pipe provision"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"BED-03 :-- Door and Door Fittings"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"BED-03 :-- Door Laminate"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"BED-03 :-- Window Railing/Grill"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"BED-03 :-- Chajja"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"BED-03 :-- Aluminium Sliding Window"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"BED-03 :-- Flooring & Skirting"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"BED-03 :-- Wall & Ceiling Painting"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"BED-02 :-- Cable TV, Telephone line provision"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"BED-02 :-- Light fixtures and fittings"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"BED-02 :-- Electrical Switch Boards"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"BED-02 :-- AC sleeve/Drain pipe provision"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"BED-02 :-- Door and Door Fittings"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"BED-02 :-- Door Laminate"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"BED-02 :-- Window Railing/Grill"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"BED-02 :-- Chajja"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"BED-02 :-- Aluminium Sliding Window"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"BED-02 :-- Flooring & Skirting"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"BED-02 :-- Wall & Ceiling Painting"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"BED-01 :-- Cable TV, Telephone line provision"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"BED-01 :-- Light fixtures and fittings"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"BED-01 :-- Electrical Switch Boards"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"BED-01 :-- AC sleeve/Drain pipe provision"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"BED-01 :-- Door and Door Fittings"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"BED-01 :-- Door Laminate"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"BED-01 :-- Window Railing/Grill"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"BED-01 :-- Chajja"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"BED-01 :-- Aluminium Sliding Window"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"BED-01 :-- Flooring & Skirting"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"BED-01 :-- Wall & Ceiling Painting"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Living & Dining :-- Door Bell"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Living & Dining :-- Cable TV, Telephone line, Internet, Intercom provision"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Living & Dining :-- Light fixtures and fittings"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Living & Dining :-- Electrical Switch Boards"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Living & Dining :-- AC Sleeve/Drain Pipe provision"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Living & Dining :-- Safety Door Laminate"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Living & Dining :-- Safety Door and Door Fittings"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"A/C :-- Drain point location and connection for A/C outlet"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"A/C :-- A/C sleeve for outdoor unit"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Passage :-- Electrical Switch Board"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Passage :-- Ceiling Light Fixture"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Passage :-- Flooring & Skirting"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Passage :-- Wall & Ceiling Painting"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Kitchen :-- Modular Kitchen Set (if applicable)"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Kitchen :-- Water Purifier (if applicable)"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Kitchen :-- Water Purifier Provision"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Kitchen :-- Light fixtures and fittings"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Kitchen :-- Exhaust Fan with two pin"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Kitchen :-- Plumbing pipe work completion"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Kitchen :-- Washing Machine Electrical Point"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Kitchen :-- Washing Machine Outlet and Inlet"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Kitchen :-- Floor Traps with cover"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"(with Waste Coupling and Waste pipe)"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Kitchen :-- Kitchen Platform with Sink"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Kitchen :-- Aluminium Sliding Window"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Kitchen :-- Wall & Floor Tiles"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Kitchen :-- Wall & Ceiling Painting"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Bath - 4 :-- Light Fixture and Fitting"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Bath - 4 :-- Bathroom Accessories"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Bath - 4 :-- Loft"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Bath - 4 :-- Exhaust Fan with two pin"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Bath - 4 :-- Geyser with 3 pin socket"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Bath - 4 :-- Floor Traps with cover"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Bath - 4 :-- Wash Basin with Bottle Trap"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Bath - 4 :-- W.C with Seat Cover"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Bath - 4 :-- Aluminium Window Louvers, and Glass"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Bath - 4 :-- C.P. Sanitary Fittings"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Bath - 4 :-- Wall & Floor Tiles"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Bath - 4 :-- Door and Door Fittings"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Bath - 4 :-- Door Laminate"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Bath - 4 :-- Painting"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Bath - 3 :-- Light Fixture and Fitting"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Bath - 3 :-- Bathroom Accessories"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Bath - 3 :-- Loft"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Bath - 3 :-- Exhaust Fan with two pin"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Bath - 3 :-- Geyser with 3 pin socket"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Bath - 3 :-- Floor Traps with cover"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Bath - 3 :-- Wash Basin with Bottle Trap"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Bath - 3 :-- W.C with Seat Cover"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Bath - 3 :-- Aluminium Window Louvers, and Glass"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Bath - 3 :-- C.P. Sanitary Fittings"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Bath - 3 :-- Wall & Floor Tiles"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Bath - 3 :-- Door and Door Fittings"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Bath - 3 :-- Door Laminate"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Bath - 3 :-- Painting"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Bath - 2 :-- Light Fixture and Fitting"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Bath - 2 :-- Bathroom Accessories"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Bath - 2 :-- Loft"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Bath - 2 :-- Exhaust Fan with two pin"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Bath - 2 :-- Geyser with 3 pin socket"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Bath - 2 :-- Floor Traps with cover"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Bath - 2 :-- Wash Basin with Bottle Trap"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Bath - 2 :-- W.C with Seat Cover"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Bath - 2 :-- Aluminium Window Louvers, and Glass"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Bath - 2 :-- C.P. Sanitary Fittings"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Bath - 2 :-- Wall & Floor Tiles"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Bath - 2 :-- Door and Door Fittings"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Bath - 2 :-- Door Laminate"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Bath - 2 :-- Painting"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Bath - 1 :-- Light Fixture and Fitting"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Bath - 1 :-- Bathroom Accessories"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Bath - 1 :-- Loft"}	{Y/N}	{f}	{f}
{"CRM - Solo Inspection"}	{PCPL/CRM/SOLO-INSP/2024/0001}	{"Single Stage"}	{"Bath - 1 :-- Exhaust Fan with two pin"}	{Y/N}	{f}	{f}
{"Exec - During - Column Sht & Concreting"}	{PCPL/EXEC/DURING/COL-SHT-CONC/2024/0001}	{During}	{"Proper compaction is practiced while concreting?"}	{Y/N}	{f}	{f}
{"Exec - During - Column Sht & Concreting"}	{PCPL/EXEC/DURING/COL-SHT-CONC/2024/0001}	{During}	{"Concrete Grade is as per the RCC Drawing."}	{Y/N}	{f}	{t}
{"Exec - Mivan Slab Column Beam Casting During Stage"}	{PCPL/EXEC/MIVANCASTINGDuring/2025/0001}	{"Single Stage"}	{"Actual slump of concrete at pouring ponit ?"}	{Y/N}	{f}	{f}
{"Exec - Mivan Slab Column Beam Casting During Stage"}	{PCPL/EXEC/MIVANCASTINGDuring/2025/0001}	{"Single Stage"}	{"Is there segregation / bleeding observed?"}	{Y/N}	{t}	{f}
{"Exec - Mivan Slab Column Beam Casting During Stage"}	{PCPL/EXEC/MIVANCASTINGDuring/2025/0001}	{"Single Stage"}	{"Is concrete being consumed within the initial setting period of concrete?"}	{Y/N}	{t}	{f}
{"Exec - Mivan Slab Column Beam Casting During Stage"}	{PCPL/EXEC/MIVANCASTINGDuring/2025/0001}	{"Single Stage"}	{"Is the finishing level being checked by Auto Level or Laser Level or Manually forslab/ screed/ VDF concreting?"}	{Y/N}	{t}	{f}
{"Exec - Mivan Slab Column Beam Casting During Stage"}	{PCPL/EXEC/MIVANCASTINGDuring/2025/0001}	{"Single Stage"}	{"Is proper vibration being done ?"}	{Y/N}	{t}	{f}
{"Exec - Mivan Slab Column Beam Casting During Stage"}	{PCPL/EXEC/MIVANCASTINGDuring/2025/0001}	{"Single Stage"}	{"Is Proper Malleting Being done?"}	{Y/N}	{t}	{f}
{"Exec - Mivan Slab Column Beam Casting During Stage"}	{PCPL/EXEC/MIVANCASTINGDuring/2025/0001}	{"Single Stage"}	{"Is the concrete mixed as per approved mix design?"}	{Y/N}	{f}	{f}
{"Exec - Mivan Slab Column Beam Casting Post Stage"}	{"PCPL/EXEC/MIVAN Casting post/2025/0001"}	{"Single Stage"}	{"All sunken portion line, level and geometry as per drawing ?"}	{Y/N}	{t}	{f}
{"Exec - Mivan Slab Column Beam Casting Post Stage"}	{"PCPL/EXEC/MIVAN Casting post/2025/0001"}	{"Single Stage"}	{"Is adequate curing being done using curing agent ?"}	{Y/N}	{t}	{f}
{"Exec - Mivan Slab Column Beam Casting Post Stage"}	{"PCPL/EXEC/MIVAN Casting post/2025/0001"}	{"Single Stage"}	{"Any surface cracks are found?"}	{Y/N}	{t}	{f}
{"Exec - Mivan Slab Column Beam Casting Post Stage"}	{"PCPL/EXEC/MIVAN Casting post/2025/0001"}	{"Single Stage"}	{"Has the alignment of expansion joints (if any) been checked?"}	{Y/N}	{t}	{f}
{"Exec - Mivan Slab Column Beam Casting Post Stage"}	{"PCPL/EXEC/MIVAN Casting post/2025/0001"}	{"Single Stage"}	{"Is marking for location of service conduits & fittings done (where applicable)?"}	{Y/N}	{t}	{f}
{"Exec - Mivan Slab Column Beam Casting Post Stage"}	{"PCPL/EXEC/MIVAN Casting post/2025/0001"}	{"Single Stage"}	{"Is adequate curing being done on top of slab?"}	{Y/N}	{t}	{f}
{"Exec - Mivan Slab Column Beam Casting Post Stage"}	{"PCPL/EXEC/MIVAN Casting post/2025/0001"}	{"Single Stage"}	{"Check for housekeeping and debries removal ?"}	{Y/N}	{t}	{f}
{"Exec - Mivan Slab Column Beam Casting Post Stage"}	{"PCPL/EXEC/MIVAN Casting post/2025/0001"}	{"Single Stage"}	{"Is casting date marked on the structural elements?"}	{Y/N}	{t}	{f}
{"Exec - Mivan Slab Column Beam Casting Post Stage"}	{"PCPL/EXEC/MIVAN Casting post/2025/0001"}	{"Single Stage"}	{"Are all the safety norms being covered as per HSEM process?"}	{Y/N}	{t}	{f}
{"Exec - Mivan Slab Column Beam Casting Post Stage"}	{"PCPL/EXEC/MIVAN Casting post/2025/0001"}	{"Single Stage"}	{"Mention Floor level as per drawing ?"}	{Y/N}	{t}	{f}
{"Exec - Mivan Slab Column Beam Casting Post Stage"}	{"PCPL/EXEC/MIVAN Casting post/2025/0001"}	{"Single Stage"}	{"Check for any offsets, bulging, cracks, honeycomb cold joint steel exposed repair to be done (if any)?"}	{Y/N}	{t}	{f}
{"Exec - Mivan Slab Column Beam Casting Post Stage"}	{"PCPL/EXEC/MIVAN Casting post/2025/0001"}	{"Single Stage"}	{"Check MEP services like sleeves, DB boxes, conduits, switch boxex etc?"}	{Y/N}	{t}	{f}
{"Exec - Mivan Slab Column Beam Casting Post Stage"}	{"PCPL/EXEC/MIVAN Casting post/2025/0001"}	{"Single Stage"}	{"Material shifting cutout repair ?"}	{Y/N}	{t}	{f}
{"Exec - Mivan Slab Column Beam Casting Post Stage"}	{"PCPL/EXEC/MIVAN Casting post/2025/0001"}	{"Single Stage"}	{"Remove the tie rod and pin Patti then fill the holes with approved material?"}	{Y/N}	{t}	{f}
{"Exec - Mivan Slab Column Beam Casting Post Stage"}	{"PCPL/EXEC/MIVAN Casting post/2025/0001"}	{"Single Stage"}	{"Are the inserts embedded in concrete surface exposed properly? (casing of Wall ties)"}	{Y/N}	{t}	{f}
{"Exec - Mivan Slab Column Beam Casting Post Stage"}	{"PCPL/EXEC/MIVAN Casting post/2025/0001"}	{"Single Stage"}	{"Check for door and window opening as per drawing?"}	{Y/N}	{t}	{f}
{"Exec - Mivan Slab Column Beam Casting Post Stage"}	{"PCPL/EXEC/MIVAN Casting post/2025/0001"}	{"Single Stage"}	{"Cleaning & grinding : Any grinding is required for any beam joints or slab joints?"}	{Y/N}	{t}	{f}
{"Exec - Mivan Slab Column Beam Casting Pre Stage"}	{PCPL/EXEC/MIVAN/2025/0001}	{"Single Stage"}	{"Cover blocks provided ?"}	{Y/N}	{t}	{f}
{"Exec - Mivan Slab Column Beam Casting Pre Stage"}	{PCPL/EXEC/MIVAN/2025/0001}	{"Single Stage"}	{"Formwork components labeled and traceable ?"}	{Y/N}	{t}	{f}
{"Exec - Mivan Slab Column Beam Casting Pre Stage"}	{PCPL/EXEC/MIVAN/2025/0001}	{"Single Stage"}	{"All excessive gaps sealed between rocker and floor ?"}	{Y/N}	{t}	{f}
{"Exec - Mivan Slab Column Beam Casting Pre Stage"}	{PCPL/EXEC/MIVAN/2025/0001}	{"Single Stage"}	{"Have alignment and level of beam bottom & beam sides at the junction with the vertical members been checked and found as required?"}	{Y/N}	{t}	{f}
{"Exec - Mivan Slab Column Beam Casting Pre Stage"}	{PCPL/EXEC/MIVAN/2025/0001}	{"Single Stage"}	{"Has size of beam section been checked ?"}	{Y/N}	{t}	{f}
{"Exec - Mivan Slab Column Beam Casting Pre Stage"}	{PCPL/EXEC/MIVAN/2025/0001}	{"Single Stage"}	{"Is plumb for vertical members (min. 2 sides) found as required ?"}	{Y/N}	{t}	{f}
{"Exec - Mivan Slab Column Beam Casting Pre Stage"}	{PCPL/EXEC/MIVAN/2025/0001}	{"Single Stage"}	{"Kicker bolts installed and adjusted ?"}	{Y/N}	{t}	{f}
{"Exec - Mivan Slab Column Beam Casting Pre Stage"}	{PCPL/EXEC/MIVAN/2025/0001}	{"Single Stage"}	{"Flat wall ties installed with proper tie sleeves ?"}	{Y/N}	{t}	{f}
{"Exec - Mivan Slab Column Beam Casting Pre Stage"}	{PCPL/EXEC/MIVAN/2025/0001}	{"Single Stage"}	{"Verticality checked for internal and external walls ?"}	{Y/N}	{t}	{f}
{"Exec - Mivan Slab Column Beam Casting Pre Stage"}	{PCPL/EXEC/MIVAN/2025/0001}	{"Single Stage"}	{"All panels cleaned and coated with release agent?"}	{Y/N}	{t}	{f}
{"Exec - Mivan Slab Column Beam Casting Pre Stage"}	{PCPL/EXEC/MIVAN/2025/0001}	{"Single Stage"}	{"Diagonal check completed for each room?"}	{Y/N}	{t}	{f}
{"Exec - Mivan Slab Column Beam Casting Pre Stage"}	{PCPL/EXEC/MIVAN/2025/0001}	{"Single Stage"}	{"Room dimensions verified as per drawing ?"}	{Y/N}	{t}	{f}
{"Exec - Mivan Slab Column Beam Casting Pre Stage"}	{PCPL/EXEC/MIVAN/2025/0001}	{"Single Stage"}	{"Slab soffit formwork level verified ?"}	{Y/N}	{t}	{f}
{"Exec - Mivan Slab Column Beam Casting Pre Stage"}	{PCPL/EXEC/MIVAN/2025/0001}	{"Single Stage"}	{"Door spacers and vertical soldiers placed as per drawing ?"}	{Y/N}	{t}	{f}
{"Exec - Mivan Slab Column Beam Casting Pre Stage"}	{PCPL/EXEC/MIVAN/2025/0001}	{"Single Stage"}	{"Safety checks for bracing and anchorage completed ?"}	{Y/N}	{t}	{f}
{"Exec - Mivan Slab Column Beam Casting Pre Stage"}	{PCPL/EXEC/MIVAN/2025/0001}	{"Single Stage"}	{"Deck panels and beam bottoms checked for level ?"}	{Y/N}	{t}	{f}
{"Exec - Mivan Slab Column Beam Casting Pre Stage"}	{PCPL/EXEC/MIVAN/2025/0001}	{"Single Stage"}	{"Outer ties for external beams and sunk portions installed ?"}	{Y/N}	{t}	{f}
{"Exec - Mivan Slab Column Beam Casting Pre Stage"}	{PCPL/EXEC/MIVAN/2025/0001}	{"Single Stage"}	{"All pins and wedges securely fixed?"}	{Y/N}	{t}	{f}
{"Exec - Mivan Slab Column Beam Casting Pre Stage"}	{PCPL/EXEC/MIVAN/2025/0001}	{"Single Stage"}	{"Wall panels installed with correct alignment ?"}	{Y/N}	{t}	{f}
{"Exec - Mivan Slab Column Beam Casting Pre Stage"}	{PCPL/EXEC/MIVAN/2025/0001}	{"Single Stage"}	{"MEP Provisions made at site as per drawings GFC ?"}	{Y/N}	{t}	{f}
{"Exec - Mivan Slab Column Beam Casting Pre Stage"}	{PCPL/EXEC/MIVAN/2025/0001}	{"Single Stage"}	{"Has size of beam section been checked?"}	{Y/N}	{t}	{f}
{"Exec - Mivan Slab Column Beam Casting Pre Stage"}	{PCPL/EXEC/MIVAN/2025/0001}	{"Single Stage"}	{"Props verticality and spacing confirmed ?"}	{Y/N}	{t}	{f}
{"Exec - Plumbing"}	{PCPL/EXEC/PLUMW/2025/0001}	{"Post Stage"}	{"Pressure Test End Reading"}	{Y/N}	{t}	{t}
{"Exec - Plumbing"}	{PCPL/EXEC/PLUMW/2025/0001}	{"Post Stage"}	{"Pressure Test End Time"}	{Y/N}	{t}	{t}
{"Exec - Plumbing"}	{PCPL/EXEC/PLUMW/2025/0001}	{"Pre Stage"}	{"Pressure Test Start Time"}	{Y/N}	{t}	{t}
{"Exec - Plumbing"}	{PCPL/EXEC/PLUMW/2025/0001}	{"Pre Stage"}	{"Pressure Test Reading"}	{Y/N}	{t}	{t}
{"Exec - Plumbing"}	{PCPL/EXEC/PLUMW/2025/0001}	{"Pre Stage"}	{"Concealed Plumbing Done As per Architectural Plan"}	{Y/N}	{t}	{f}
{"Exec - Post - Column Sht & Concreting"}	{PCPL/EXEC/POST/COL-SHT-CONC/2024/0001}	{Post}	{"Lattice removed from top of the column?"}	{Y/N}	{t}	{f}
{"Exec - Post - Column Sht & Concreting"}	{PCPL/EXEC/POST/COL-SHT-CONC/2024/0001}	{Post}	{"If honeycombing is observed, have you consulted quality engineer?"}	{Y/N}	{t}	{f}
{"Exec - Post - Column Sht & Concreting"}	{PCPL/EXEC/POST/COL-SHT-CONC/2024/0001}	{Post}	{"Is Curing of columns done for minimum 5 days & wet hessian cloth wrapped around it."}	{Y/N}	{f}	{f}
{"Exec - Post - Column Sht & Concreting"}	{PCPL/EXEC/POST/COL-SHT-CONC/2024/0001}	{Post}	{"No. of cubes casted for test of column."}	{Y/N}	{t}	{t}
{"Exec - Post - Column Sht & Concreting"}	{PCPL/EXEC/POST/COL-SHT-CONC/2024/0001}	{Post}	{"Deshuttering of columns done after 24 hrs-48 hrs?"}	{Y/N}	{t}	{f}
{"Exec - Post - Column Sht & Concreting"}	{PCPL/EXEC/POST/COL-SHT-CONC/2024/0001}	{Post}	{"Hacking of columns done properly?"}	{Y/N}	{t}	{f}
{"Exec - Post - Column Sht & Concreting"}	{PCPL/EXEC/POST/COL-SHT-CONC/2024/0001}	{Post}	{"Date of casting written on column."}	{Y/N}	{t}	{f}
{"Exec - Tie Road"}	{"PCPL/EXEC/MIVAN TIE ROD/2025/0001"}	{"Single Stage"}	{"Water Testing"}	{Y/N}	{t}	{f}
{"Exec - Tie Road"}	{"PCPL/EXEC/MIVAN TIE ROD/2025/0001"}	{"Single Stage"}	{"Mivan Panels are completely removed."}	{Y/N}	{t}	{f}
{"Exec - Tie Road"}	{"PCPL/EXEC/MIVAN TIE ROD/2025/0001"}	{"Single Stage"}	{"PVC Sleeves completely removed from the tie hole portion."}	{Y/N}	{t}	{f}
{"Exec - Tie Road"}	{"PCPL/EXEC/MIVAN TIE ROD/2025/0001"}	{"Single Stage"}	{"PVC Sheet completely removed from the Wall tie."}	{Y/N}	{t}	{f}
{"Exec - Tie Road"}	{"PCPL/EXEC/MIVAN TIE ROD/2025/0001"}	{"Single Stage"}	{"Cleaning Of Grout Hole From Inside Make Sure Area Inside Is Dry."}	{Y/N}	{t}	{f}
{"Exec - Tie Road"}	{"PCPL/EXEC/MIVAN TIE ROD/2025/0001"}	{"Single Stage"}	{"Grounting of Filling GP2 done from internal side."}	{Y/N}	{t}	{f}
{"Exec - Tie Road"}	{"PCPL/EXEC/MIVAN TIE ROD/2025/0001"}	{"Single Stage"}	{"Grouting Filling of GP2  from external side with tamping rod."}	{Y/N}	{t}	{f}
{"Exec - Tie Road"}	{"PCPL/EXEC/MIVAN TIE ROD/2025/0001"}	{"Single Stage"}	{"Top surface finished to the plane of RCC surface."}	{Y/N}	{t}	{f}
{"Exec - Tie Road"}	{"PCPL/EXEC/MIVAN TIE ROD/2025/0001"}	{"Single Stage"}	{"Check for water Seepages If Present."}	{Y/N}	{t}	{f}
{"Execution - Beam, Slab Shuttering and concreting"}	{PCPL/EXEC/BEAM-SLB-SHT-CONC/2024/0001}	{"Pre Stage"}	{"Is height of slab from plinth level/lower slab level as defined in the architectural drawing."}	{Y/N}	{t}	{t}
{"Execution - Beam, Slab Shuttering and concreting"}	{PCPL/EXEC/BEAM-SLB-SHT-CONC/2024/0001}	{"Pre Stage"}	{"Proper fixing of beam bottom (Topi Bottom) done on columns to take load of beam & slab shuttering?"}	{Y/N}	{t}	{t}
{"Execution - Beam, Slab Shuttering and concreting"}	{PCPL/EXEC/BEAM-SLB-SHT-CONC/2024/0001}	{"Pre Stage"}	{"Shuttering material used is in good condition?"}	{Y/N}	{t}	{f}
{"Execution - Beam, Slab Shuttering and concreting"}	{PCPL/EXEC/BEAM-SLB-SHT-CONC/2024/0001}	{"Pre Stage"}	{"Master Stirrups in column for upper floor column size."}	{Y/N}	{f}	{f}
{"Execution - Beam, Slab Shuttering and concreting"}	{PCPL/EXEC/BEAM-SLB-SHT-CONC/2024/0001}	{"Pre Stage"}	{"Proper fixing of props in line, level & plumb."}	{Y/N}	{t}	{f}
{"Execution - Beam, Slab Shuttering and concreting"}	{PCPL/EXEC/BEAM-SLB-SHT-CONC/2024/0001}	{Post}	{"Curing of Slab done for 7 days?"}	{Y/N}	{t}	{f}
{"Execution - Beam, Slab Shuttering and concreting"}	{PCPL/EXEC/BEAM-SLB-SHT-CONC/2024/0001}	{Post}	{"Levelness: Level of Concrete slab is same on top of slab and bottom of slab."}	{Y/N}	{f}	{f}
{"Execution - Beam, Slab Shuttering and concreting"}	{PCPL/EXEC/BEAM-SLB-SHT-CONC/2024/0001}	{Post}	{"Cracks: Any surface cracks are found?"}	{Y/N}	{f}	{f}
{"Execution - Beam, Slab Shuttering and concreting"}	{PCPL/EXEC/BEAM-SLB-SHT-CONC/2024/0001}	{Post}	{"Compaction : Is concrete well compacted and ensured that its even in surface?"}	{Y/N}	{f}	{f}
{"Execution - Beam, Slab Shuttering and concreting"}	{PCPL/EXEC/BEAM-SLB-SHT-CONC/2024/0001}	{Post}	{"Defects: Any sign of defect such as honeycombing or spalling is found"}	{Y/N}	{f}	{f}
{"Execution - Beam, Slab Shuttering and concreting"}	{PCPL/EXEC/BEAM-SLB-SHT-CONC/2024/0001}	{Post}	{"Plum : for checking beam sides is plum ok?"}	{Y/N}	{f}	{f}
{"Execution - Beam, Slab Shuttering and concreting"}	{PCPL/EXEC/BEAM-SLB-SHT-CONC/2024/0001}	{"Pre Stage"}	{"Is the reinforcement provided for beam as per Structural drawing?"}	{Y/N}	{t}	{f}
{"Execution - Beam, Slab Shuttering and concreting"}	{PCPL/EXEC/BEAM-SLB-SHT-CONC/2024/0001}	{"Pre Stage"}	{"Oiling of slab shuttering done properly?"}	{Y/N}	{f}	{f}
{"Execution - Beam, Slab Shuttering and concreting"}	{PCPL/EXEC/BEAM-SLB-SHT-CONC/2024/0001}	{Post}	{"Cleaning & grinding : Any grinding is required for any beam joints or slab joints?"}	{Y/N}	{f}	{f}
{"Execution - Beam, Slab Shuttering and concreting"}	{PCPL/EXEC/BEAM-SLB-SHT-CONC/2024/0001}	{"Pre Stage"}	{"Cleaning of slab and gaps are sealed with masking tape/ribs?"}	{Y/N}	{t}	{f}
{"Execution - Beam, Slab Shuttering and concreting"}	{PCPL/EXEC/BEAM-SLB-SHT-CONC/2024/0001}	{Post}	{"Junctions of column & beam in plum"}	{Y/N}	{f}	{f}
{"Execution - Beam, Slab Shuttering and concreting"}	{PCPL/EXEC/BEAM-SLB-SHT-CONC/2024/0001}	{Post}	{"Beam sides line level is as per requirement?"}	{Y/N}	{t}	{f}
{"Execution - Beam, Slab Shuttering and concreting"}	{PCPL/EXEC/BEAM-SLB-SHT-CONC/2024/0001}	{Post}	{"Electrical points: checked and ensured that all electrical points are in position?"}	{Y/N}	{t}	{f}
{"Execution - Beam, Slab Shuttering and concreting"}	{PCPL/EXEC/BEAM-SLB-SHT-CONC/2024/0001}	{Post}	{"Nails & wire : Checked & ensured that nails & wires are removed properly."}	{Y/N}	{t}	{f}
{"Execution - Beam, Slab Shuttering and concreting"}	{PCPL/EXEC/BEAM-SLB-SHT-CONC/2024/0001}	{Post}	{"Shuttering Ribs : Checked & ensured that shuttering ribs removed or not?"}	{Y/N}	{t}	{f}
{"Execution - Beam, Slab Shuttering and concreting"}	{PCPL/EXEC/BEAM-SLB-SHT-CONC/2024/0001}	{"Pre Stage"}	{"Internal and External measurement of the shuttering installed is as per the architectural drawing?"}	{Y/N}	{t}	{f}
{"Execution - Beam, Slab Shuttering and concreting"}	{PCPL/EXEC/BEAM-SLB-SHT-CONC/2024/0001}	{"Pre Stage"}	{"Depth of beam is as per R.C.C. drawings shared?"}	{Y/N}	{t}	{f}
{"Execution - Beam, Slab Shuttering and concreting"}	{PCPL/EXEC/BEAM-SLB-SHT-CONC/2024/0001}	{"Pre Stage"}	{"Line & level of beam bottoms is okay?"}	{Y/N}	{t}	{f}
{"Execution - Beam, Slab Shuttering and concreting"}	{PCPL/EXEC/BEAM-SLB-SHT-CONC/2024/0001}	{"Pre Stage"}	{"Is size of beam and slab is as per drawing?"}	{Y/N}	{t}	{f}
{"Execution - Beam, Slab Shuttering and concreting"}	{PCPL/EXEC/BEAM-SLB-SHT-CONC/2024/0001}	{During}	{"Grade of concrete used as per the RCC drawing?"}	{Y/N}	{t}	{t}
{"Execution - Beam, Slab Shuttering and concreting"}	{PCPL/EXEC/BEAM-SLB-SHT-CONC/2024/0001}	{"Pre Stage"}	{"Packing below props is correctly done?"}	{Y/N}	{t}	{f}
{"Execution - Beam, Slab Shuttering and concreting"}	{PCPL/EXEC/BEAM-SLB-SHT-CONC/2024/0001}	{"Pre Stage"}	{"To check the concealed electrical conduit work for slabs as per drawing"}	{Y/N}	{f}	{f}
{"Execution - Beam, Slab Shuttering and concreting"}	{PCPL/EXEC/BEAM-SLB-SHT-CONC/2024/0001}	{"Pre Stage"}	{"Cut out & sleeves provision for plumbing, MGL and Firefighting pipes as per drawing?"}	{Y/N}	{t}	{f}
{"Execution - Beam, Slab Shuttering and concreting"}	{PCPL/EXEC/BEAM-SLB-SHT-CONC/2024/0001}	{"Pre Stage"}	{"lapping of column is provided as per the drawing?"}	{Y/N}	{t}	{f}
{"Execution - Beam, Slab Shuttering and concreting"}	{PCPL/EXEC/BEAM-SLB-SHT-CONC/2024/0001}	{"Pre Stage"}	{"Cover blocks for Beam & Slab is as per specification?"}	{Y/N}	{f}	{f}
{"Execution - Beam, Slab Shuttering and concreting Pre"}	{PCPL/EXEC/BEAM-SLB-SHT-CONC-PRE-DUR/2025/0001}	{"Pre and During Stage"}	{"Cleaning of slab and gaps are sealed with masking tape/ribs?"}	{Y/N}	{t}	{f}
{"Execution - Beam, Slab Shuttering and concreting Pre"}	{PCPL/EXEC/BEAM-SLB-SHT-CONC-PRE-DUR/2025/0001}	{"Pre and During Stage"}	{"Packing below props is correctly done?"}	{Y/N}	{t}	{f}
{"Execution - Beam, Slab Shuttering and concreting Pre"}	{PCPL/EXEC/BEAM-SLB-SHT-CONC-PRE-DUR/2025/0001}	{"Pre and During Stage"}	{"Depth of beam is as per R.C.C. drawings shared?"}	{Y/N}	{t}	{f}
{"Execution - Beam, Slab Shuttering and concreting Pre"}	{PCPL/EXEC/BEAM-SLB-SHT-CONC-PRE-DUR/2025/0001}	{"Pre and During Stage"}	{"Internal and External measurement of the shuttering installed is as per the architectural drawing?"}	{Y/N}	{t}	{f}
{"Execution - Beam, Slab Shuttering and concreting Pre"}	{PCPL/EXEC/BEAM-SLB-SHT-CONC-PRE-DUR/2025/0001}	{"Pre and During Stage"}	{"Line & level of beam bottoms is okay?"}	{Y/N}	{t}	{f}
{"Execution - Beam, Slab Shuttering and concreting Pre"}	{PCPL/EXEC/BEAM-SLB-SHT-CONC-PRE-DUR/2025/0001}	{"Pre and During Stage"}	{"Proper fixing of beam bottom (Topi Bottom) done on columns to take load of beam & slab shuttering?"}	{Y/N}	{t}	{t}
{"Execution - Beam, Slab Shuttering and concreting Pre"}	{PCPL/EXEC/BEAM-SLB-SHT-CONC-PRE-DUR/2025/0001}	{"Pre and During Stage"}	{"Is size of beam and slab is as per drawing?"}	{Y/N}	{t}	{f}
{"Execution - Beam, Slab Shuttering and concreting Pre"}	{PCPL/EXEC/BEAM-SLB-SHT-CONC-PRE-DUR/2025/0001}	{"Pre and During Stage"}	{"To check the concealed electrical conduit work for slabs as per drawing"}	{Y/N}	{f}	{f}
{"Execution - Beam, Slab Shuttering and concreting Pre"}	{PCPL/EXEC/BEAM-SLB-SHT-CONC-PRE-DUR/2025/0001}	{"Pre and During Stage"}	{"Cut out & sleeves provision for plumbing, MGL and Firefighting pipes as per drawing?"}	{Y/N}	{t}	{f}
{"Execution - Beam, Slab Shuttering and concreting Pre"}	{PCPL/EXEC/BEAM-SLB-SHT-CONC-PRE-DUR/2025/0001}	{"Pre and During Stage"}	{"Proper fixing of props in line, level & plumb."}	{Y/N}	{t}	{f}
{"Execution - Beam, Slab Shuttering and concreting Pre"}	{PCPL/EXEC/BEAM-SLB-SHT-CONC-PRE-DUR/2025/0001}	{"Pre and During Stage"}	{"Is height of slab from plinth level/lower slab level as defined in the architectural drawing."}	{Y/N}	{t}	{t}
{"Execution - Beam, Slab Shuttering and concreting Pre"}	{PCPL/EXEC/BEAM-SLB-SHT-CONC-PRE-DUR/2025/0001}	{"Pre and During Stage"}	{"Shuttering material used is in good condition?"}	{Y/N}	{t}	{f}
{"Execution - Beam, Slab Shuttering and concreting Pre"}	{PCPL/EXEC/BEAM-SLB-SHT-CONC-PRE-DUR/2025/0001}	{"Pre and During Stage"}	{"lapping of column is provided as per the drawing?"}	{Y/N}	{t}	{f}
{"Execution - Beam, Slab Shuttering and concreting Pre"}	{PCPL/EXEC/BEAM-SLB-SHT-CONC-PRE-DUR/2025/0001}	{"Pre and During Stage"}	{"Cover blocks for Beam & Slab is as per specification?"}	{Y/N}	{f}	{f}
{"Execution - Beam, Slab Shuttering and concreting Pre"}	{PCPL/EXEC/BEAM-SLB-SHT-CONC-PRE-DUR/2025/0001}	{"Pre and During Stage"}	{"Is the reinforcement provided for beam as per Structural drawing?"}	{Y/N}	{t}	{f}
{"Execution - Beam, Slab Shuttering and concreting Pre"}	{PCPL/EXEC/BEAM-SLB-SHT-CONC-PRE-DUR/2025/0001}	{"Pre and During Stage"}	{"Oiling of slab shuttering done properly?"}	{Y/N}	{f}	{f}
{"Execution - Beam, Slab Shuttering and concreting Pre"}	{PCPL/EXEC/BEAM-SLB-SHT-CONC-PRE-DUR/2025/0001}	{"Pre and During Stage"}	{"Master Stirrups in column for upper floor column size."}	{Y/N}	{f}	{f}
{"Execution - Beam, Slab Shuttering and concreting Pre"}	{PCPL/EXEC/BEAM-SLB-SHT-CONC-PRE-DUR/2025/0001}	{"Pre and During Stage"}	{"Grade of concrete used as per the RCC drawing?"}	{Y/N}	{t}	{t}
{"Execution - Demolition"}	{PCPL/EXEC/DEMOLITION/2024/0001}	{"Pre Stage"}	{"I-beams are properly erected, welded and applied coat of Red-Oxide & paint before installtion of G.I Sheet?"}	{Y/N}	{t}	{f}
{"Execution - Demolition"}	{PCPL/EXEC/DEMOLITION/2024/0001}	{"Pre Stage"}	{"Temp. Meter cabin constructed & temp. meters are installed on site?"}	{Y/N}	{t}	{f}
{"Execution - Demolition"}	{PCPL/EXEC/DEMOLITION/2024/0001}	{During}	{"All necessary permission files are received on site?"}	{Y/N}	{t}	{f}
{"Execution - Demolition"}	{PCPL/EXEC/DEMOLITION/2024/0001}	{"Pre Stage"}	{"IGBC Dustbins are installed in the society premises to collect electronic waste?"}	{Y/N}	{t}	{f}
{"Execution - Demolition"}	{PCPL/EXEC/DEMOLITION/2024/0001}	{Post}	{"If new boring is done on site then water sample is sent for testing?"}	{Y/N}	{t}	{f}
{"Execution - Demolition"}	{PCPL/EXEC/DEMOLITION/2024/0001}	{Post}	{"As per logistic plan have we constructed/provided basic amenties on site?"}	{Y/N}	{t}	{f}
{"Execution - Demolition"}	{PCPL/EXEC/DEMOLITION/2024/0001}	{Post}	{"Site logistic plan is prepared & discussed?"}	{Y/N}	{t}	{f}
{"Execution - Demolition"}	{PCPL/EXEC/DEMOLITION/2024/0001}	{Post}	{"Have all the debris is completely removed / dispacthed from site?"}	{Y/N}	{t}	{f}
{"Execution - Demolition"}	{PCPL/EXEC/DEMOLITION/2024/0001}	{"Pre Stage"}	{"Locate the MGL Main connector Box, if found within the premises then handove to concerned authority."}	{Y/N}	{t}	{f}
{"Execution - Demolition"}	{PCPL/EXEC/DEMOLITION/2024/0001}	{"Pre Stage"}	{"Check the condition of the carriageway?"}	{Y/N}	{t}	{f}
{"Execution - Demolition"}	{PCPL/EXEC/DEMOLITION/2024/0001}	{Post}	{"Have ensured that while demolition of structure or post demolition, has contractor damaged anything on site?"}	{Y/N}	{f}	{f}
{"Execution - Demolition"}	{PCPL/EXEC/DEMOLITION/2024/0001}	{During}	{"Entry and Exit points on the site are properly secured?"}	{Y/N}	{t}	{f}
{"Execution - Demolition"}	{PCPL/EXEC/DEMOLITION/2024/0001}	{During}	{"Is company banner hoisted on site?"}	{Y/N}	{t}	{f}
{"Execution - Demolition"}	{PCPL/EXEC/DEMOLITION/2024/0001}	{During}	{"Is Installation of Safety Banner done to prevent the haphazard situation on site?"}	{Y/N}	{t}	{f}
{"Execution - Demolition"}	{PCPL/EXEC/DEMOLITION/2024/0001}	{During}	{"As per AQI Norms, necessary arrangements are done on site?"}	{Y/N}	{t}	{t}
{"Execution - Demolition"}	{PCPL/EXEC/DEMOLITION/2024/0001}	{During}	{"Handover of water connection to concerned authority?"}	{Y/N}	{t}	{f}
{"Execution - Demolition"}	{PCPL/EXEC/DEMOLITION/2024/0001}	{During}	{"Have ensured that roads are cleaned?"}	{Y/N}	{t}	{f}
{"Execution - Demolition"}	{PCPL/EXEC/DEMOLITION/2024/0001}	{During}	{"PCC on gate (5m X 5m) to perform cleaning activity of tyres?"}	{Y/N}	{t}	{f}
{"Execution - Demolition"}	{PCPL/EXEC/DEMOLITION/2024/0001}	{During}	{"SWM (Soil Waste Management) Permission status?"}	{Y/N}	{f}	{f}
{"Execution - Demolition"}	{PCPL/EXEC/DEMOLITION/2024/0001}	{"Pre Stage"}	{"Is main disconnecting chamber (Sewarage Chamber) located on site?"}	{Y/N}	{t}	{f}
{"Execution - Demolition"}	{PCPL/EXEC/DEMOLITION/2024/0001}	{"Pre Stage"}	{"Electrical Meters and electrical line dismantled properly and handovered to concerned authority?"}	{Y/N}	{t}	{f}
{"Execution - Demolition"}	{PCPL/EXEC/DEMOLITION/2024/0001}	{"Pre Stage"}	{"Is MGNL Meters and line dismantled properly and handovered to concerned authority?"}	{Y/N}	{t}	{f}
{"Execution - Demolition"}	{PCPL/EXEC/DEMOLITION/2024/0001}	{"Pre Stage"}	{"Is exisitng/new borewell location marked on site & shared with concerned architect?"}	{Y/N}	{t}	{f}
{"Execution - Demolition"}	{PCPL/EXEC/DEMOLITION/2024/0001}	{"Pre Stage"}	{"Labour insurance policy is checked?"}	{Y/N}	{f}	{f}
{"Execution - Demolition"}	{PCPL/EXEC/DEMOLITION/2024/0001}	{"Pre Stage"}	{"Is there any hinderance while demolishing society premises due to existing trees?"}	{Y/N}	{t}	{f}
{"Execution - Demolition"}	{PCPL/EXEC/DEMOLITION/2024/0001}	{Post}	{"Curing Pit constructed on site?"}	{Y/N}	{t}	{f}
{"Execution - Demolition"}	{PCPL/EXEC/DEMOLITION/2024/0001}	{Post}	{"Dewatering Pit constructed on site?"}	{Y/N}	{t}	{f}
{"Execution - Demolition"}	{PCPL/EXEC/DEMOLITION/2024/0001}	{"Pre Stage"}	{"G.I Sheet fixed around the building compound wall upto a desirable height?"}	{Y/N}	{t}	{f}
{"Execution - During - Masonry Work"}	{PCPL/EXEC/DURING/MASONRY/2024/0001}	{During}	{"Is jointing mortar filled between the blocks as per standard thickness?"}	{Y/N}	{t}	{f}
{"Execution - During - Masonry Work"}	{PCPL/EXEC/DURING/MASONRY/2024/0001}	{During}	{"Patli provided at the required distance of masonry wall?"}	{Y/N}	{t}	{f}
{"Execution - During - Masonry Work"}	{PCPL/EXEC/DURING/MASONRY/2024/0001}	{During}	{"Openings are provided at first layer for doors & etc as per drawing?"}	{Y/N}	{f}	{f}
{"Execution - During - Masonry Work"}	{PCPL/EXEC/DURING/MASONRY/2024/0001}	{During}	{"DPC/concrete block over the first layer of chhapkam brick work done?"}	{Y/N}	{t}	{f}
{"Execution - During - Masonry Work"}	{PCPL/EXEC/DURING/MASONRY/2024/0001}	{During}	{"Erection of door frames fixed with necessary number of holdfast & verticality checked?"}	{Y/N}	{t}	{f}
{"Execution - Electrical Work"}	{PCPL/EXEC/ELEW/2024/0001}	{"Pre Stage"}	{"Clean all Points of conduits in slab during the casting of slab"}	{Y/N}	{f}	{f}
{"Execution - Electrical Work"}	{PCPL/EXEC/ELEW/2024/0001}	{"Pre Stage"}	{"After 7days of completion of Brick work start zari layout  marked as per drawing"}	{Y/N}	{t}	{f}
{"Execution - Electrical Work"}	{PCPL/EXEC/ELEW/2024/0001}	{During}	{"Electrical DB with conduits to be fixed"}	{Y/N}	{f}	{f}
{"Execution - Electrical Work"}	{PCPL/EXEC/ELEW/2024/0001}	{Post}	{"Cleaning of debris of materials fallen on slab after finsih of work in each floor"}	{Y/N}	{f}	{f}
{"Execution - Electrical Work"}	{PCPL/EXEC/ELEW/2024/0001}	{Post}	{"If any conduits choked in slab same is to be provided in slab before flooring starts on approval from arch"}	{Y/N}	{f}	{f}
{"Execution - Electrical Work"}	{PCPL/EXEC/ELEW/2024/0001}	{During}	{"Fixing of all conduits pipes and Boxes as per line and floor levels already fixed"}	{Y/N}	{f}	{f}
{"Execution - Electrical Work"}	{PCPL/EXEC/ELEW/2024/0001}	{During}	{"All Electrical Boxes to be fixed in Perfect Right angle and level as per final gypsum finish level"}	{Y/N}	{t}	{f}
{"Execution - Electrical Work"}	{PCPL/EXEC/ELEW/2024/0001}	{During}	{"Zari cutting in wall to be done as per approved  layout"}	{Y/N}	{t}	{f}
{"Execution - Excavation"}	{PCPL/EXEC/EXCAVATION/2024/0001}	{"Single Stage"}	{"Execution of trial pit in order to check soil consitions?"}	{Y/N}	{t}	{f}
{"Execution - Excavation"}	{PCPL/EXEC/EXCAVATION/2024/0001}	{"Single Stage"}	{"Excavated soil is required for backfilling post foundation work?"}	{Y/N}	{f}	{t}
{"Execution - Excavation"}	{PCPL/EXEC/EXCAVATION/2024/0001}	{"Single Stage"}	{"Strata to be checked and idenfied as per the soil investigation report, Kindly mention the depth of the strata."}	{Y/N}	{t}	{t}
{"Execution - Excavation"}	{PCPL/EXEC/EXCAVATION/2024/0001}	{"Single Stage"}	{"Excavation Permissions (SWM & Royalty) received by Site Team and have quantity & validity of the permission is verified?"}	{Y/N}	{t}	{f}
{"Execution - Excavation"}	{PCPL/EXEC/EXCAVATION/2024/0001}	{"Single Stage"}	{"Excavation work contract copy received on site?"}	{Y/N}	{t}	{f}
{"Execution - Excavation"}	{PCPL/EXEC/EXCAVATION/2024/0001}	{"Single Stage"}	{"Have all the excavated soil is completely removed / dispacthed from site?"}	{Y/N}	{t}	{f}
{"Execution - Excavation"}	{PCPL/EXEC/EXCAVATION/2024/0001}	{"Single Stage"}	{"AQI Norms are properly followed on site?"}	{Y/N}	{t}	{f}
{"Execution - Excavation"}	{PCPL/EXEC/EXCAVATION/2024/0001}	{"Single Stage"}	{"Is any location found to be dangerous during excavation?"}	{Y/N}	{t}	{f}
{"Execution - Excavation"}	{PCPL/EXEC/EXCAVATION/2024/0001}	{"Single Stage"}	{"Is gunitting required to protect the side soil or not?"}	{Y/N}	{t}	{f}
{"Execution - External Plaster"}	{PCPL/EXEC/EXT-PLASTER/2024/0001}	{"During 2nd Coat"}	{"Removal of Dead Mortar and Debris present on floor"}	{Y/N}	{t}	{f}
{"Execution - External Plaster"}	{PCPL/EXEC/EXT-PLASTER/2024/0001}	{"Surface Prep"}	{"Proper alignment of cutouts, sleeves and proper finishing of the same"}	{Y/N}	{t}	{f}
{"Execution - External Plaster"}	{PCPL/EXEC/EXT-PLASTER/2024/0001}	{"Surface Prep"}	{"Erected scaffoldings in a proper manner?"}	{Y/N}	{t}	{f}
{"Execution - External Plaster"}	{PCPL/EXEC/EXT-PLASTER/2024/0001}	{"Surface Prep"}	{"post concrete works surface preparation like removal of binding wires/nails/algie-fungi?"}	{Y/N}	{t}	{f}
{"Execution - External Plaster"}	{PCPL/EXEC/EXT-PLASTER/2024/0001}	{"Surface Prep"}	{"Hacking on RCC Surface done?"}	{Y/N}	{t}	{f}
{"Execution - External Plaster"}	{PCPL/EXEC/EXT-PLASTER/2024/0001}	{"Surface Prep"}	{"The Top layer of Block masonry Joints are properly grouted without any hollowness in Mortar Joint?"}	{Y/N}	{t}	{f}
{"Execution - External Plaster"}	{PCPL/EXEC/EXT-PLASTER/2024/0001}	{"Surface Prep"}	{"Lattice, Green patches, un-even surfaces is thoroughly brushed and washed with water spray and wire brush?"}	{Y/N}	{f}	{f}
{"Execution - External Plaster"}	{PCPL/EXEC/EXT-PLASTER/2024/0001}	{"Surface Prep"}	{"Fibre glass mesh provided at junction of masonry& RCC members?"}	{Y/N}	{t}	{f}
{"Execution - External Plaster"}	{PCPL/EXEC/EXT-PLASTER/2024/0001}	{"Surface Prep"}	{"Tie Rod holes / Rebars/ Concrete offsets has been flushed / treated properly and filled with GP2 chemical?"}	{Y/N}	{t}	{f}
{"Execution - External Plaster"}	{PCPL/EXEC/EXT-PLASTER/2024/0001}	{"Surface Prep"}	{"Plaster dhada to be done on walls and ceiling of min 25mm thick."}	{Y/N}	{t}	{f}
{"Execution - External Plaster"}	{PCPL/EXEC/EXT-PLASTER/2024/0001}	{"Surface Prep"}	{"Kindly check for the vertically using line-dori? if found any bulging then chipout as per line dori."}	{Y/N}	{t}	{f}
{"Execution - External Plaster"}	{PCPL/EXEC/EXT-PLASTER/2024/0001}	{"Surface Prep"}	{"Hack-Aid chemical applied on RCC surface before start of plastering?"}	{Y/N}	{t}	{f}
{"Execution - External Plaster"}	{PCPL/EXEC/EXT-PLASTER/2024/0001}	{"During 1st Coat"}	{"Pre-wetting of masonry & RCC surfaces before start of plaster?"}	{Y/N}	{t}	{f}
{"Execution - External Plaster"}	{PCPL/EXEC/EXT-PLASTER/2024/0001}	{"During 1st Coat"}	{"Mixing of ready mix plaster in trays on respective floor level and cleaned properly?"}	{Y/N}	{t}	{f}
{"Execution - External Plaster"}	{PCPL/EXEC/EXT-PLASTER/2024/0001}	{"During 1st Coat"}	{"First coat plaster of 12mm to be started after all above points done"}	{Y/N}	{t}	{f}
{"Execution - External Plaster"}	{PCPL/EXEC/EXT-PLASTER/2024/0001}	{"During 1st Coat"}	{"Curing of the first coat of plaster done for 2 days?"}	{Y/N}	{t}	{f}
{"Execution - External Plaster"}	{PCPL/EXEC/EXT-PLASTER/2024/0001}	{"During 2nd Coat"}	{"Cleaning has been done post completion of 1st coat plaster?"}	{Y/N}	{t}	{f}
{"Execution - External Plaster"}	{PCPL/EXEC/EXT-PLASTER/2024/0001}	{"During 2nd Coat"}	{"At the juction between chajja and wall/beam, rounding has been done properly?"}	{Y/N}	{t}	{f}
{"Execution - External Plaster"}	{PCPL/EXEC/EXT-PLASTER/2024/0001}	{"During 2nd Coat"}	{"2nd coat plaster of 12mm to be started after sufficient curing is done for first coat of plaster."}	{Y/N}	{t}	{f}
{"Execution - External Plaster"}	{PCPL/EXEC/EXT-PLASTER/2024/0001}	{"During 2nd Coat"}	{"Surface is properly finished with Plaster and if found any cracks then rectify same."}	{Y/N}	{t}	{f}
{"Execution - External Plaster"}	{PCPL/EXEC/EXT-PLASTER/2024/0001}	{"During 2nd Coat"}	{"Maintained true level surface, right angle, plumb, edge, sharp corners?"}	{Y/N}	{t}	{f}
{"Execution - External Plaster"}	{PCPL/EXEC/EXT-PLASTER/2024/0001}	{"During 2nd Coat"}	{"Maintained drip mold be at chajja level as per the architect drawing?"}	{Y/N}	{t}	{f}
{"Execution - External Plaster"}	{PCPL/EXEC/EXT-PLASTER/2024/0001}	{Post}	{"Curing of External plaster for 2 day as per requirements"}	{Y/N}	{t}	{f}
{"Execution - External Plaster"}	{PCPL/EXEC/EXT-PLASTER/2024/0001}	{Post}	{"For dead wall, water is poured for min. 2 days to check dampness?"}	{Y/N}	{t}	{f}
{"Execution - Footing/Foundation"}	{PCPL/EXEC/FOOTING/2024/0001}	{"Single Stage"}	{"Check the level of PCC for foundation from ground level as per Arch. Drawing?"}	{Y/N}	{t}	{f}
{"Execution - Footing/Foundation"}	{PCPL/EXEC/FOOTING/2024/0001}	{"Single Stage"}	{"Is footing column number, size, column centre & orientation as per( RCC & Arch) drawings?"}	{Y/N}	{t}	{f}
{"Execution - Footing/Foundation"}	{PCPL/EXEC/FOOTING/2024/0001}	{"Single Stage"}	{"Orientation of the footing is as per the drawing?"}	{Y/N}	{t}	{f}
{"Execution - Footing/Foundation"}	{PCPL/EXEC/FOOTING/2024/0001}	{"Single Stage"}	{"Minimum 3 stations for reference point of columns are constructed?"}	{Y/N}	{f}	{f}
{"Execution - Footing/Foundation"}	{PCPL/EXEC/FOOTING/2024/0001}	{"Single Stage"}	{"Is there is provision of pressure relase pipe"}	{Y/N}	{t}	{f}
{"Execution - Footing/Foundation"}	{PCPL/EXEC/FOOTING/2024/0001}	{"Single Stage"}	{"Chappkam of the footing is taken over the PCC?"}	{Y/N}	{t}	{f}
{"Execution - Footing/Foundation"}	{PCPL/EXEC/FOOTING/2024/0001}	{"Single Stage"}	{"Grade of concrete mix is as per RCC drawing?"}	{Y/N}	{t}	{f}
{"Execution - Footing/Foundation"}	{PCPL/EXEC/FOOTING/2024/0001}	{"Single Stage"}	{"Is shuttering and supporting of footing properly provided?"}	{Y/N}	{t}	{f}
{"Execution - Footing/Foundation"}	{PCPL/EXEC/FOOTING/2024/0001}	{"Single Stage"}	{"Is Cover block size & its spacing in the reinforcement as per structural drawing?"}	{Y/N}	{f}	{f}
{"Execution - Footing/Foundation"}	{PCPL/EXEC/FOOTING/2024/0001}	{"Single Stage"}	{"Pedestal reinforcement is properly placed as per the structural design and drawing?"}	{Y/N}	{t}	{f}
{"Execution - Footing/Foundation"}	{PCPL/EXEC/FOOTING/2024/0001}	{"Single Stage"}	{"Is reinforcement of footing as per drawing?"}	{Y/N}	{t}	{f}
{"Execution - Footing/Foundation"}	{PCPL/EXEC/FOOTING/2024/0001}	{"Single Stage"}	{"Is reinforcement of column as per drawing?"}	{Y/N}	{t}	{f}
{"Execution - Footing/Foundation"}	{PCPL/EXEC/FOOTING/2024/0001}	{"Single Stage"}	{"Final level of footing is checked and verified?"}	{Y/N}	{t}	{f}
{"Execution - Foundation Pile"}	{PCPL/EXEC/FND-PILE/2024/0001}	{"Single Stage"}	{"centre of the pile is thoroughly checked and verified by engineer from the reference point?"}	{Y/N}	{f}	{f}
{"Execution - Foundation Pile"}	{PCPL/EXEC/FND-PILE/2024/0001}	{"Single Stage"}	{"Set up refrence points with respect to the Arch. Drawings on ground?"}	{Y/N}	{t}	{f}
{"Execution - Foundation Pile"}	{PCPL/EXEC/FND-PILE/2024/0001}	{"Single Stage"}	{"Grade of concrete, reinforcement and cover blocks are as per the approved drawing?"}	{Y/N}	{t}	{f}
{"Execution - Foundation Pile"}	{PCPL/EXEC/FND-PILE/2024/0001}	{"Single Stage"}	{"The depth achieved is compared with the borehole data and checked by a measurment tape?"}	{Y/N}	{t}	{f}
{"Execution - Foundation Pile"}	{PCPL/EXEC/FND-PILE/2024/0001}	{"Single Stage"}	{"Have all the pile locations are marked on site as per pile layout?"}	{Y/N}	{t}	{f}
{"Execution - Foundation Pile"}	{PCPL/EXEC/FND-PILE/2024/0001}	{"Single Stage"}	{"True distance from the adjacent pile is verified with pile foundation layout?"}	{Y/N}	{t}	{f}
{"Execution - Gypsum Work"}	{PCPL/EXEC/GYPW/2024/0001}	{"Single Stage"}	{"Maintained true line, level , Right Angle, Plumb, Edge, sharp corner, Straight Edges?"}	{Y/N}	{f}	{f}
{"Execution - Gypsum Work"}	{PCPL/EXEC/GYPW/2024/0001}	{"Single Stage"}	{"Grooves are provided where tile/skirting and walls are flushed at the same level?"}	{Y/N}	{f}	{f}
{"Execution - Gypsum Work"}	{PCPL/EXEC/GYPW/2024/0001}	{"Single Stage"}	{"Material is checked as per work order?"}	{Y/N}	{t}	{f}
{"Execution - Gypsum Work"}	{PCPL/EXEC/GYPW/2024/0001}	{"Single Stage"}	{"Tikka dhada to be done on walls and ceiling of min 6-8mm thick. (Internal Plaster)"}	{Y/N}	{t}	{f}
{"Execution - Gypsum Work"}	{PCPL/EXEC/GYPW/2024/0001}	{"Single Stage"}	{"Chemical applied as per specification for the application of Gypsum on ceiling?"}	{Y/N}	{t}	{f}
{"Execution - Gypsum Work"}	{PCPL/EXEC/GYPW/2024/0001}	{"Single Stage"}	{"Ceiling is thoroughly brushed and washed with water spray and wire brush to remove patching tape/ dust, etc. (Internal Plaster)"}	{Y/N}	{t}	{f}
{"Execution - Gypsum Work"}	{PCPL/EXEC/GYPW/2024/0001}	{"Single Stage"}	{"Ensured that surface is completely dry and ready for the application of gypsum?"}	{Y/N}	{f}	{f}
{"Execution - Internal Plaster"}	{PCPL/EXEC/INT-PLST/2024/0001}	{"Pre Stage"}	{"Tie Rod holes / Rebars/ Concrete offsets has been flushed / treated properly and filled with GP2 chemical?"}	{Y/N}	{t}	{f}
{"Execution - Internal Plaster"}	{PCPL/EXEC/INT-PLST/2024/0001}	{"Pre Stage"}	{"Pre-wetting of masonry & RCC surfaces done before start of plaster work?"}	{Y/N}	{t}	{f}
{"Execution - Internal Plaster"}	{PCPL/EXEC/INT-PLST/2024/0001}	{"Pre Stage"}	{"Completion of Window marble framing work"}	{Y/N}	{t}	{f}
{"Execution - Internal Plaster"}	{PCPL/EXEC/INT-PLST/2024/0001}	{Post}	{"All the room to be checked for true level surface, right angle, plumb, edge, sharp corners."}	{Y/N}	{t}	{f}
{"Execution - Internal Plaster"}	{PCPL/EXEC/INT-PLST/2024/0001}	{Post}	{"Removed of Dead Mortar and Debris over the slab?"}	{Y/N}	{t}	{f}
{"Execution - Internal Plaster"}	{PCPL/EXEC/INT-PLST/2024/0001}	{During}	{"Curing for chhaat plaster for two days (First Coat)?"}	{Y/N}	{t}	{f}
{"Execution - Internal Plaster"}	{PCPL/EXEC/INT-PLST/2024/0001}	{"Pre Stage"}	{"Conceal conduit pipes finished with cement sand mortar or Ready-mix Plaster Mortar?"}	{Y/N}	{t}	{f}
{"Execution - Internal Plaster"}	{PCPL/EXEC/INT-PLST/2024/0001}	{Post}	{"Curing of internal Plaster intiated after 24 Hrs and taken care upto 7 days?"}	{Y/N}	{t}	{f}
{"Execution - Internal Plaster"}	{PCPL/EXEC/INT-PLST/2024/0001}	{"Pre Stage"}	{"Fibre glass mesh provided on the electrical conduits, at the Junction of Masonry & RCC members?"}	{Y/N}	{t}	{f}
{"Execution - Internal Plaster"}	{PCPL/EXEC/INT-PLST/2024/0001}	{"Pre Stage"}	{"Racking of Masonary Joints, Hacking of RCC Surface and cleaning done?"}	{Y/N}	{t}	{f}
{"Execution - Internal Plaster"}	{PCPL/EXEC/INT-PLST/2024/0001}	{"Pre Stage"}	{"Before start of plaster fixing of services, electrical conduits and DB isntallation completed?"}	{Y/N}	{t}	{f}
{"Execution - Internal Plaster"}	{PCPL/EXEC/INT-PLST/2024/0001}	{During}	{"Applied Hack-Aid chemical on RCC surface before start of plaster work?"}	{Y/N}	{f}	{f}
{"Execution - Kitchen & Toilet Dado"}	{"PCPL/EXEC/KIT-TOILET DADO/2024/0001"}	{Post}	{"Ensured that upon completion of tiling work, cleaning is done properly?"}	{Y/N}	{t}	{f}
{"Execution - Kitchen & Toilet Dado"}	{"PCPL/EXEC/KIT-TOILET DADO/2024/0001"}	{During}	{"Ensured that tiles are properly fixed using rich mortar and grouted?"}	{Y/N}	{t}	{f}
{"Execution - Kitchen & Toilet Dado"}	{"PCPL/EXEC/KIT-TOILET DADO/2024/0001"}	{During}	{"Line & diagonals are checked properly?"}	{Y/N}	{t}	{f}
{"Execution - Kitchen & Toilet Dado"}	{"PCPL/EXEC/KIT-TOILET DADO/2024/0001"}	{During}	{"Level is checked by bubble spirit level?"}	{Y/N}	{t}	{f}
{"Execution - Kitchen & Toilet Dado"}	{"PCPL/EXEC/KIT-TOILET DADO/2024/0001"}	{During}	{"Veritcality is checked by Plumb bob?"}	{Y/N}	{t}	{f}
{"Execution - Kitchen & Toilet Dado"}	{"PCPL/EXEC/KIT-TOILET DADO/2024/0001"}	{During}	{"Ensured that Neru and cement are used in proportion?"}	{Y/N}	{f}	{f}
{"Execution - Kitchen & Toilet Dado"}	{"PCPL/EXEC/KIT-TOILET DADO/2024/0001"}	{During}	{"Ensured that spreading of cement mortar as per specification to a required thickness & slope? (FOR TOILET FLOORING)"}	{Y/N}	{t}	{f}
{"Execution - Kitchen & Toilet Dado"}	{"PCPL/EXEC/KIT-TOILET DADO/2024/0001"}	{During}	{"Ensured that bedding sand is thoroughly spread as per thickness (FOR TOILET FLOORING)"}	{Y/N}	{t}	{f}
{"Execution - Kitchen & Toilet Dado"}	{"PCPL/EXEC/KIT-TOILET DADO/2024/0001"}	{During}	{"Ensured that tiles are soaked in water before the commencement of work?"}	{Y/N}	{t}	{f}
{"Execution - Kitchen & Toilet Dado"}	{"PCPL/EXEC/KIT-TOILET DADO/2024/0001"}	{During}	{"Ensured that tiles are of approved Brand, Shade & Tile Edges are not chipped as well as cazing are not present."}	{Y/N}	{t}	{f}
{"Execution - Kitchen & Toilet Dado"}	{"PCPL/EXEC/KIT-TOILET DADO/2024/0001"}	{"Pre Stage"}	{"Start point location marked as per the architectural drawing."}	{Y/N}	{t}	{f}
{"Execution - Kitchen & Toilet Dado"}	{"PCPL/EXEC/KIT-TOILET DADO/2024/0001"}	{"Pre Stage"}	{"Ensured that tile layout is as per the architectural drawing"}	{Y/N}	{t}	{f}
{"Execution - Kitchen & Toilet Dado"}	{"PCPL/EXEC/KIT-TOILET DADO/2024/0001"}	{"Pre Stage"}	{"Ensured that Internal Plaster work is completed properly."}	{Y/N}	{t}	{f}
{"Execution - Kitchen & Toilet Dado"}	{"PCPL/EXEC/KIT-TOILET DADO/2024/0001"}	{"Pre Stage"}	{"Ensured that electrical conceal work is done?"}	{Y/N}	{t}	{f}
{"Execution - Masonry Work."}	{PCPL/EXEC/MASNRY/2024/0001}	{During}	{"Openings are provided at first layer for doors & etc as per drawing?"}	{Y/N}	{f}	{f}
{"Execution - Masonry Work."}	{PCPL/EXEC/MASNRY/2024/0001}	{Post}	{"Curing for brick wall done as per requirements?"}	{Y/N}	{t}	{f}
{"Execution - Masonry Work."}	{PCPL/EXEC/MASNRY/2024/0001}	{Post}	{"Cleaning of floor after brick work is completed?"}	{Y/N}	{t}	{f}
{"Execution - Masonry Work."}	{PCPL/EXEC/MASNRY/2024/0001}	{Post}	{"Cutouts to be left as per arch drawing locations?"}	{Y/N}	{f}	{f}
{"Execution - Masonry Work."}	{PCPL/EXEC/MASNRY/2024/0001}	{Post}	{"Verticality of walls & corners checked?"}	{Y/N}	{f}	{f}
{"Execution - Masonry Work."}	{PCPL/EXEC/MASNRY/2024/0001}	{Post}	{"RCC Fastner provided at the junction of beam bottom and brick-work?"}	{Y/N}	{f}	{f}
{"Execution - Masonry Work."}	{PCPL/EXEC/MASNRY/2024/0001}	{During}	{"Patli provided at the required distance of masonry wall?"}	{Y/N}	{f}	{f}
{"Execution - Masonry Work."}	{PCPL/EXEC/MASNRY/2024/0001}	{Pre}	{"Is entire floor is properly cleaned before commencement work?"}	{Y/N}	{t}	{f}
{"Execution - Masonry Work."}	{PCPL/EXEC/MASNRY/2024/0001}	{Pre}	{"First layer chhapkam (Line-out) checked as per arch drawings layout?"}	{Y/N}	{t}	{f}
{"Execution - Masonry Work."}	{PCPL/EXEC/MASNRY/2024/0001}	{Pre}	{"Confirmed dimensions & diagonals of each room after first layer (line out)?"}	{Y/N}	{t}	{f}
{"Execution - Masonry Work."}	{PCPL/EXEC/MASNRY/2024/0001}	{During}	{"DPC/concrete block over the first layer of chhapkam brick work done?"}	{Y/N}	{t}	{f}
{"Execution - Masonry Work."}	{PCPL/EXEC/MASNRY/2024/0001}	{During}	{"Erection of door frames fixed with necessary number of holdfast & verticality checked?"}	{Y/N}	{f}	{f}
{"Execution - Masonry Work."}	{PCPL/EXEC/MASNRY/2024/0001}	{During}	{"Is jointing mortar filled between the blocks as per standard thickness?"}	{Y/N}	{t}	{f}
{"Execution - Pile Cap"}	{PCPL/EXEC/PILE-CAP/2024/0001}	{"Single Stage"}	{"is shuttering maintained 150mm away from pile face as per the drawing?"}	{Y/N}	{t}	{f}
{"Execution - Pile Cap"}	{PCPL/EXEC/PILE-CAP/2024/0001}	{"Single Stage"}	{"Breaking of pile upto 75mm below bottom of Pile Cap."}	{Y/N}	{t}	{f}
{"Execution - Pile Cap"}	{PCPL/EXEC/PILE-CAP/2024/0001}	{"Single Stage"}	{"Eccentricity and Integity Test Reports are acceptable and ready to cast the pile caps?"}	{Y/N}	{f}	{t}
{"Execution - Pile Cap"}	{PCPL/EXEC/PILE-CAP/2024/0001}	{"Single Stage"}	{"Vertical reinforcement left above pcc lvl?"}	{Y/N}	{t}	{f}
{"Execution - Pile Cap"}	{PCPL/EXEC/PILE-CAP/2024/0001}	{"Single Stage"}	{"Helical stirrups tied after breaking of pile above pcc top lvl?"}	{Y/N}	{t}	{f}
{"Execution - Pile Cap"}	{PCPL/EXEC/PILE-CAP/2024/0001}	{"Single Stage"}	{"pcc level w.r.to pile cap size, extra spacing of 225mm from pile cap face is provided?"}	{Y/N}	{f}	{t}
{"Execution - Pile Cap"}	{PCPL/EXEC/PILE-CAP/2024/0001}	{"Single Stage"}	{"Orientation of pile cap is per the drawing?"}	{Y/N}	{f}	{t}
{"Execution - Pile Cap"}	{PCPL/EXEC/PILE-CAP/2024/0001}	{"Single Stage"}	{"For Pile Head preparation, 75mm above the pcc top level?"}	{Y/N}	{f}	{t}
{"Execution - Pile Cap"}	{PCPL/EXEC/PILE-CAP/2024/0001}	{"Single Stage"}	{"Cover for pile cap is properly placed?"}	{Y/N}	{t}	{f}
{"Execution - Pile Cap"}	{PCPL/EXEC/PILE-CAP/2024/0001}	{"Single Stage"}	{"Column Horizontal stirrups are properly provided?"}	{Y/N}	{t}	{f}
{"Execution - Pile Cap"}	{PCPL/EXEC/PILE-CAP/2024/0001}	{"Single Stage"}	{"Column reinforcement of vertical bars are as per drawing?"}	{Y/N}	{t}	{f}
{"Execution - Pile Cap"}	{PCPL/EXEC/PILE-CAP/2024/0001}	{"Single Stage"}	{"Is column oreintation as per Arch & RCC drawing?"}	{Y/N}	{f}	{t}
{"Execution - Pile Cap"}	{PCPL/EXEC/PILE-CAP/2024/0001}	{"Single Stage"}	{"Chair bars kept as per depth of pile cap & top reinforcement?"}	{Y/N}	{t}	{f}
{"Execution - Pile Cap"}	{PCPL/EXEC/PILE-CAP/2024/0001}	{"Single Stage"}	{"Pile cap reinforcement is checked and as per RCC drawing"}	{Y/N}	{f}	{t}
{"Execution - Plinth Level"}	{PCPL/EXEC/PLINTH-CHK/2024/0001}	{"Single Stage"}	{"Supports for plinth beam"}	{Y/N}	{t}	{f}
{"Execution - Plinth Level"}	{PCPL/EXEC/PLINTH-CHK/2024/0001}	{"Single Stage"}	{"Proper covers are provided?"}	{Y/N}	{t}	{f}
{"Execution - Plinth Level"}	{PCPL/EXEC/PLINTH-CHK/2024/0001}	{"Single Stage"}	{"Reinforcement provided as per drawing?"}	{Y/N}	{t}	{f}
{"Execution - Plinth Level"}	{PCPL/EXEC/PLINTH-CHK/2024/0001}	{"Single Stage"}	{"Open spaces are checked as per IOD Drawings?"}	{Y/N}	{t}	{f}
{"Execution - Plinth Level"}	{PCPL/EXEC/PLINTH-CHK/2024/0001}	{"Single Stage"}	{"Cross checked the location of plinth beams with IOD Drawing?"}	{Y/N}	{t}	{f}
{"Execution - Plinth Level"}	{PCPL/EXEC/PLINTH-CHK/2024/0001}	{"Single Stage"}	{"Plinth level marking checked with reference to ground level marking as per architect drawing?"}	{Y/N}	{t}	{f}
{"Execution - Plinth Level"}	{PCPL/EXEC/PLINTH-CHK/2024/0001}	{"Single Stage"}	{"Levels of plinth beam/services are checked from all angles?"}	{Y/N}	{t}	{f}
{"Execution - Plinth Level"}	{PCPL/EXEC/PLINTH-CHK/2024/0001}	{"Single Stage"}	{"Shuttering of the plinth beam is checked?"}	{Y/N}	{t}	{f}
{"Execution - (Post) Beam, Slab Shuttering and concreting"}	{"PCPL/EXEC/POST/BEAM-SLAB SHUTTERING & CONCRETING"}	{"Post Stage"}	{"Defects: Any sign of defect such as honeycombing or spalling is found"}	{Y/N}	{t}	{f}
{"Execution - (Post) Beam, Slab Shuttering and concreting"}	{"PCPL/EXEC/POST/BEAM-SLAB SHUTTERING & CONCRETING"}	{"Post Stage"}	{"Plum : for checking beam sides is plum ok?"}	{Y/N}	{f}	{f}
{"Execution - (Post) Beam, Slab Shuttering and concreting"}	{"PCPL/EXEC/POST/BEAM-SLAB SHUTTERING & CONCRETING"}	{"Post Stage"}	{"Cleaning & grinding : Any grinding is required for any beam joints or slab joints?"}	{Y/N}	{f}	{f}
{"Execution - (Post) Beam, Slab Shuttering and concreting"}	{"PCPL/EXEC/POST/BEAM-SLAB SHUTTERING & CONCRETING"}	{"Post Stage"}	{"Beam sides line level is as per requirement?"}	{Y/N}	{f}	{f}
{"Execution - (Post) Beam, Slab Shuttering and concreting"}	{"PCPL/EXEC/POST/BEAM-SLAB SHUTTERING & CONCRETING"}	{"Post Stage"}	{"Curing of Slab done for 7 days?"}	{Y/N}	{f}	{f}
{"Execution - (Post) Beam, Slab Shuttering and concreting"}	{"PCPL/EXEC/POST/BEAM-SLAB SHUTTERING & CONCRETING"}	{"Post Stage"}	{"Levelness: Level of Concrete slab is same on top of slab and bottom of slab."}	{Y/N}	{f}	{f}
{"Execution - (Post) Beam, Slab Shuttering and concreting"}	{"PCPL/EXEC/POST/BEAM-SLAB SHUTTERING & CONCRETING"}	{"Post Stage"}	{"Cracks: Any surface cracks are found?"}	{Y/N}	{t}	{f}
{"Execution - (Post) Beam, Slab Shuttering and concreting"}	{"PCPL/EXEC/POST/BEAM-SLAB SHUTTERING & CONCRETING"}	{"Post Stage"}	{"Compaction : Is concrete well compacted and ensured that its even in surface?"}	{Y/N}	{t}	{f}
{"Execution - (Post) Beam, Slab Shuttering and concreting"}	{"PCPL/EXEC/POST/BEAM-SLAB SHUTTERING & CONCRETING"}	{"Post Stage"}	{"Electrical points: checked and ensured that all electrical points are in position?"}	{Y/N}	{f}	{f}
{"Execution - (Post) Beam, Slab Shuttering and concreting"}	{"PCPL/EXEC/POST/BEAM-SLAB SHUTTERING & CONCRETING"}	{"Post Stage"}	{"Nails & wire : Checked & ensured that nails & wires are removed properly."}	{Y/N}	{f}	{f}
{"Execution - (Post) Beam, Slab Shuttering and concreting"}	{"PCPL/EXEC/POST/BEAM-SLAB SHUTTERING & CONCRETING"}	{"Post Stage"}	{"Shuttering Ribs : Checked & ensured that shuttering ribs removed or not?"}	{Y/N}	{f}	{f}
{"Execution - (Post) Beam, Slab Shuttering and concreting"}	{"PCPL/EXEC/POST/BEAM-SLAB SHUTTERING & CONCRETING"}	{"Post Stage"}	{"Deshuttering of slab as per cube result attain"}	{Y/N}	{f}	{t}
{"Execution - (Post) Beam, Slab Shuttering and concreting"}	{"PCPL/EXEC/POST/BEAM-SLAB SHUTTERING & CONCRETING"}	{"Post Stage"}	{"Junctions of column & beam in plum"}	{Y/N}	{f}	{f}
{"Execution - Post - Masonry Work"}	{PCPL/EXEC/POST/MASONRY/2024/0001}	{Post}	{"Cleaning of floor after brick work is completed?"}	{Y/N}	{f}	{f}
{"Execution - Post - Masonry Work"}	{PCPL/EXEC/POST/MASONRY/2024/0001}	{Post}	{"Curing for brick wall done as per requirements?"}	{Y/N}	{t}	{f}
{"Execution - Post - Masonry Work"}	{PCPL/EXEC/POST/MASONRY/2024/0001}	{Post}	{"Cutouts to be left as per arch drawing locations?"}	{Y/N}	{t}	{f}
{"Execution - Post - Masonry Work"}	{PCPL/EXEC/POST/MASONRY/2024/0001}	{Post}	{"Verticality of walls & corners checked?"}	{Y/N}	{f}	{f}
{"Execution - Post - Masonry Work"}	{PCPL/EXEC/POST/MASONRY/2024/0001}	{Post}	{"RCC Fastner provided at the junction of beam bottom and brick-work?"}	{Y/N}	{t}	{f}
{"Execution - Pre Stage - Column Sht & Concreting"}	{PCPL/EXEC/PRE/COL-SHT-CONC/2024/0001}	{"Pre Stage"}	{"cover as per the requirement?"}	{Y/N}	{t}	{f}
{"Execution - Pre Stage - Column Sht & Concreting"}	{PCPL/EXEC/PRE/COL-SHT-CONC/2024/0001}	{"Pre Stage"}	{"Plumb on both sides."}	{Y/N}	{t}	{f}
{"Execution - Pre Stage - Column Sht & Concreting"}	{PCPL/EXEC/PRE/COL-SHT-CONC/2024/0001}	{"Pre Stage"}	{"Binding & placing of column reinforcement above upper floor slab as per required height, considering lap length of the bar, as per RCC Drawing"}	{Y/N}	{t}	{f}
{"Execution - Pre Stage - Column Sht & Concreting"}	{PCPL/EXEC/PRE/COL-SHT-CONC/2024/0001}	{"Pre Stage"}	{"Is the quality of shuttering is good?"}	{Y/N}	{t}	{f}
{"Execution - Pre Stage - Column Sht & Concreting"}	{PCPL/EXEC/PRE/COL-SHT-CONC/2024/0001}	{"Pre Stage"}	{"Is shuttering supports are properly introduced at regular intervals?"}	{Y/N}	{t}	{f}
{"Execution - Pre Stage - Column Sht & Concreting"}	{PCPL/EXEC/PRE/COL-SHT-CONC/2024/0001}	{"Pre Stage"}	{"Diagonals as per the sizes of column/lift wall?"}	{Y/N}	{f}	{f}
{"Execution - Pre Stage - Masonry Work"}	{"PCPL/EXEC/PRE/MASONRY WORK/2024/0001"}	{Pre}	{"Confirmed dimensions & diagonals of each room after first layer (line out)?"}	{Y/N}	{t}	{f}
{"Execution - Pre Stage - Masonry Work"}	{"PCPL/EXEC/PRE/MASONRY WORK/2024/0001"}	{Pre}	{"Is entire floor is properly cleaned before commencement work?"}	{Y/N}	{t}	{f}
{"Execution - PT Slab"}	{PCPL/EXEC/PT-SLAB/2024/0001}	{"Post Concrete"}	{"Is stressing of tendons done as per detail (Time/strength) mention in the drawing? Kindly mention detail in remark."}	{Y/N}	{f}	{t}
{"Execution - PT Slab"}	{PCPL/EXEC/PT-SLAB/2024/0001}	{"Post Concrete"}	{"Are all safety measurment taken before stressing of tendons?"}	{Y/N}	{f}	{f}
{"Execution - PT Slab"}	{PCPL/EXEC/PT-SLAB/2024/0001}	{"Pre Concrete"}	{"Is cleaning of slab done after completion of work by PT contractor?"}	{Y/N}	{f}	{f}
{"Execution - PT Slab"}	{PCPL/EXEC/PT-SLAB/2024/0001}	{"Pre Concrete"}	{"Is proper provision for Grouting of conduit done at both ends?"}	{Y/N}	{f}	{f}
{"Execution - PT Slab"}	{PCPL/EXEC/PT-SLAB/2024/0001}	{"Pre Concrete"}	{"Is end support properly done to avoid slurry loss?"}	{Y/N}	{t}	{f}
{"Execution - PT Slab"}	{PCPL/EXEC/PT-SLAB/2024/0001}	{"Pre Concrete"}	{"Are number of tendons laid with correct profiles along with support bars and chairs as per drawings?"}	{Y/N}	{t}	{f}
{"Execution - PT Slab"}	{PCPL/EXEC/PT-SLAB/2024/0001}	{"Post Concrete"}	{"Is measurement of elongation done as per approved methodology?"}	{Y/N}	{f}	{f}
{"Execution - PT Slab"}	{PCPL/EXEC/PT-SLAB/2024/0001}	{"Post Concrete"}	{"Is proper grouting procedure followed as specified in drawing?"}	{Y/N}	{f}	{f}
{"Execution - PT Slab"}	{PCPL/EXEC/PT-SLAB/2024/0001}	{"Post Concrete"}	{"Prior to grouting, Is duct cleaning done by water or compressed air?"}	{Y/N}	{f}	{f}
{"Execution - PT Slab"}	{PCPL/EXEC/PT-SLAB/2024/0001}	{"Post Concrete"}	{"Is grouting material on site as per specification?"}	{Y/N}	{f}	{f}
{"Execution - PT Slab"}	{PCPL/EXEC/PT-SLAB/2024/0001}	{"Post Concrete"}	{"Is log/record for all the stressing operations and difficulties encountered maintained?"}	{Y/N}	{f}	{f}
{"Execution - PT Slab"}	{PCPL/EXEC/PT-SLAB/2024/0001}	{"Post Concrete"}	{"Is Stressing results for each tendon shall be recorded during the stressing operation?"}	{Y/N}	{f}	{f}
{"Execution - PT Slab"}	{PCPL/EXEC/PT-SLAB/2024/0001}	{"Post Concrete"}	{"Is cutting of excess length of strands done after approval from authorised person?"}	{Y/N}	{f}	{f}
{"Execution - PT Slab"}	{PCPL/EXEC/PT-SLAB/2024/0001}	{"Post Concrete"}	{"Is datum line drawing before stressing?"}	{Y/N}	{f}	{f}
{"Execution - PT Slab"}	{PCPL/EXEC/PT-SLAB/2024/0001}	{"Pre Concrete"}	{"Is sheathing properly tie so that there is no movement during concreting?"}	{Y/N}	{f}	{f}
{"Execution - PT Slab"}	{PCPL/EXEC/PT-SLAB/2024/0001}	{"Pre Concrete"}	{"Is sequencing of work finalised with PT contractor and Consultant before start of work?"}	{Y/N}	{f}	{f}
{"Execution - PT Slab"}	{PCPL/EXEC/PT-SLAB/2024/0001}	{"Pre Concrete"}	{"Is PT contractor using latest drawings?"}	{Y/N}	{f}	{f}
{"Execution - PT Slab"}	{PCPL/EXEC/PT-SLAB/2024/0001}	{"Pre Concrete"}	{"Are all the material on site properly handled?"}	{Y/N}	{f}	{f}
{"Execution - PT Slab"}	{PCPL/EXEC/PT-SLAB/2024/0001}	{"Pre Concrete"}	{"Is anchorage part free from corrosion or any other deleterious substances?"}	{Y/N}	{f}	{f}
{"Execution - PT Slab"}	{PCPL/EXEC/PT-SLAB/2024/0001}	{"Pre Concrete"}	{"Is sheathing received on site as per approved specification?"}	{Y/N}	{f}	{f}
{"Execution - PT Slab"}	{PCPL/EXEC/PT-SLAB/2024/0001}	{"Pre Concrete"}	{"Are tendons without sudden bend and kinks?"}	{Y/N}	{f}	{f}
{"Execution - PT Slab"}	{PCPL/EXEC/PT-SLAB/2024/0001}	{"Pre Concrete"}	{"Is Tendons used are free from loose rust, oil, grease, tar, paint or any other deleterious substances?"}	{Y/N}	{t}	{f}
{"Execution - PT Slab"}	{PCPL/EXEC/PT-SLAB/2024/0001}	{"Pre Concrete"}	{"Is Anchor received on site is as per approved specification?"}	{Y/N}	{f}	{t}
{"Execution - PT Slab"}	{PCPL/EXEC/PT-SLAB/2024/0001}	{"Pre Concrete"}	{"Is strands received on site is as per approved specification?"}	{Y/N}	{f}	{f}
{"Execution - Shore Pile"}	{PCPL/EXEC/SHORE-PILE/2024/0001}	{"During Stage"}	{"Length of the cage checked as per actual?"}	{Y/N}	{t}	{f}
{"Execution - Shore Pile"}	{PCPL/EXEC/SHORE-PILE/2024/0001}	{"Pre Stage"}	{"Have all the pile locations are marked on site as per pile layout?"}	{Y/N}	{t}	{f}
{"Execution - Shore Pile"}	{PCPL/EXEC/SHORE-PILE/2024/0001}	{"During Stage"}	{"Pile log register maintained at site?"}	{Y/N}	{t}	{f}
{"Execution - Shore Pile"}	{PCPL/EXEC/SHORE-PILE/2024/0001}	{"Pre Stage"}	{"Start point given by the surveyor is verified by Site Team & Architects?"}	{Y/N}	{t}	{t}
{"Execution - Shore Pile"}	{PCPL/EXEC/SHORE-PILE/2024/0001}	{"Pre Stage"}	{"Set up refrence points in respect to the Arch. Drawings"}	{Y/N}	{t}	{f}
{"Execution - Shore Pile"}	{PCPL/EXEC/SHORE-PILE/2024/0001}	{"During Stage"}	{"Reinforcements as per RCC Drawings Shared?"}	{Y/N}	{t}	{f}
{"Execution - Shore Pile"}	{PCPL/EXEC/SHORE-PILE/2024/0001}	{"During Stage"}	{"All the relevant tests are conducted and reports are shared by contractor?"}	{Y/N}	{t}	{f}
{"Execution - Shore Pile"}	{PCPL/EXEC/SHORE-PILE/2024/0001}	{"During Stage"}	{"The depth achieved is compared with the borehole data and checked by a measurment tape"}	{Y/N}	{t}	{f}
{"Execution - Starter"}	{PCPL/EXEC/STARTER/2024/0001}	{"Single Stage"}	{"Diagonals of the column starter is correctly measured?"}	{Y/N}	{f}	{f}
{"Execution - Starter"}	{PCPL/EXEC/STARTER/2024/0001}	{"Single Stage"}	{"has the reference point transfer from 0.00m to above floor on X and Y axis."}	{Y/N}	{t}	{f}
{"Execution - Starter"}	{PCPL/EXEC/STARTER/2024/0001}	{"Single Stage"}	{"Has column position been verified from centreline?"}	{Y/N}	{t}	{f}
{"Execution - Starter"}	{PCPL/EXEC/STARTER/2024/0001}	{"Single Stage"}	{"Is the dimensions of the column starter as per the drawing?"}	{Y/N}	{t}	{f}
{"Execution - Starter"}	{PCPL/EXEC/STARTER/2024/0001}	{"Single Stage"}	{"Clear cover maintained at the starter level of column?"}	{Y/N}	{t}	{f}
{"Execution - Tile Flooring"}	{PCPL/EXEC/TILING-WORK/2024/0001}	{"Pre Stage"}	{"Dhadha level marked as per the Floor Level Marking mentioned in the drawing."}	{Y/N}	{t}	{f}
{"Execution - Tile Flooring"}	{PCPL/EXEC/TILING-WORK/2024/0001}	{Post}	{"Bubble sheet is placed on the tiles to protect the flooring?"}	{Y/N}	{t}	{f}
{"Execution - Tile Flooring"}	{PCPL/EXEC/TILING-WORK/2024/0001}	{Post}	{"Ensured that upon fixing of skirting & tiles are not chipped or any crack is not formed on the surface?"}	{Y/N}	{t}	{f}
{"Execution - Tile Flooring"}	{PCPL/EXEC/TILING-WORK/2024/0001}	{During}	{"Jade plaster filling done above skirting?"}	{Y/N}	{t}	{f}
{"Execution - Tile Flooring"}	{PCPL/EXEC/TILING-WORK/2024/0001}	{During}	{"Skirting is fixed on the next day with proper chipping on side walls?"}	{Y/N}	{t}	{f}
{"Execution - Tile Flooring"}	{PCPL/EXEC/TILING-WORK/2024/0001}	{During}	{"Ensured that tiles are properly fixed?"}	{Y/N}	{t}	{f}
{"Execution - Tile Flooring"}	{PCPL/EXEC/TILING-WORK/2024/0001}	{During}	{"Ensured that base surface is as per slope and level mentioned in the drawing?"}	{Y/N}	{f}	{f}
{"Execution - Tile Flooring"}	{PCPL/EXEC/TILING-WORK/2024/0001}	{During}	{"Ensured that spreading of cement mortar as per specification to a required thickness , proper levelling & slope?"}	{Y/N}	{f}	{f}
{"Execution - Tile Flooring"}	{PCPL/EXEC/TILING-WORK/2024/0001}	{During}	{"Ensured that bedding sand is thoroughly spread as per thickness"}	{Y/N}	{f}	{f}
{"Execution - Tile Flooring"}	{PCPL/EXEC/TILING-WORK/2024/0001}	{During}	{"Ensured that tiles are soaked in water before the commencement of work?"}	{Y/N}	{t}	{f}
{"Execution - Tile Flooring"}	{PCPL/EXEC/TILING-WORK/2024/0001}	{During}	{"Ensured that tiles are of approved Brand, Shade & Tile Edges are not chipped as well as cazing are not present."}	{Y/N}	{t}	{f}
{"Execution - Tile Flooring"}	{PCPL/EXEC/TILING-WORK/2024/0001}	{During}	{"Start point location marked as per the architectural drawing."}	{Y/N}	{t}	{f}
{"Execution - Tile Flooring"}	{PCPL/EXEC/TILING-WORK/2024/0001}	{"Pre Stage"}	{"Ensured that electrical conduits are placed on the flooring before commencement, if required."}	{Y/N}	{f}	{f}
{"Execution - Tile Flooring"}	{PCPL/EXEC/TILING-WORK/2024/0001}	{"Pre Stage"}	{"Ensure that surface prepartion is done properly and cleaned thoroughly."}	{Y/N}	{t}	{f}
{"Execution - Waterproofing Work"}	{PCPL/EXEC/WATP/2024/0001}	{Post}	{"Provide curing for minimum 3 days with water."}	{Y/N}	{t}	{f}
{"Execution - Waterproofing Work"}	{PCPL/EXEC/WATP/2024/0001}	{Brickbat}	{"Holes in wall for P.V.C./G.I. pipe connection is filled with waterproofing material?"}	{Y/N}	{t}	{f}
{"Execution - Waterproofing Work"}	{PCPL/EXEC/WATP/2024/0001}	{Brickbat}	{"Any leakage in base coat, if Yes (Please note What are the cautionary measures are undertaken in remarks)"}	{Y/N}	{t}	{f}
{"Execution - Waterproofing Work"}	{PCPL/EXEC/WATP/2024/0001}	{Basecoat}	{"Flood the base coat with water, upto slab drop top, for minimum 2 days for curing & testing of leakage, if any."}	{Y/N}	{t}	{f}
{"Execution - Waterproofing Work"}	{PCPL/EXEC/WATP/2024/0001}	{Basecoat}	{"Complete the base coat on walls up to height of 600 mm above toilet finish floor level covering all beam top junction etc. properly."}	{Y/N}	{t}	{f}
{"Execution - Waterproofing Work"}	{PCPL/EXEC/WATP/2024/0001}	{Basecoat}	{"Any leakages found in base slab, if Yes (Please note What are the cautionary measures are undertaken in remarks)"}	{Y/N}	{t}	{f}
{"Execution - Waterproofing Work"}	{PCPL/EXEC/WATP/2024/0001}	{"Chemical Coat"}	{"Flood the chemical coat with water, upto slab drop top, for minimum 2 days for curing & testing of leakage, if any."}	{Y/N}	{t}	{f}
{"Execution - Waterproofing Work"}	{PCPL/EXEC/WATP/2024/0001}	{"Chemical Coat"}	{"Application of first layer chemical coat in Y - Direction after 2 hours"}	{Y/N}	{t}	{f}
{"Execution - Waterproofing Work"}	{PCPL/EXEC/WATP/2024/0001}	{"Chemical Coat"}	{"Application of first layer chemical coat in X - Direction"}	{Y/N}	{t}	{f}
{"Execution - Waterproofing Work"}	{PCPL/EXEC/WATP/2024/0001}	{"Surface Prep"}	{"From the final floor level 600mm of margin left during internal plaster?"}	{Y/N}	{t}	{f}
{"Execution - Waterproofing Work"}	{PCPL/EXEC/WATP/2024/0001}	{"Surface Prep"}	{"Remove all the loose material/debris/nails/bending wires etc from the surface of the slab?"}	{Y/N}	{t}	{f}
{"Execution - Waterproofing Work"}	{PCPL/EXEC/WATP/2024/0001}	{"Surface Prep"}	{"Completion of making holes in external walls for connecting nahani trap, p trap etc. to external drainage line. (Proper packing of drainage holes"}	{Y/N}	{t}	{f}
{"Execution - Waterproofing Work"}	{PCPL/EXEC/WATP/2024/0001}	{"Surface Prep"}	{"Thorough cleaning of bathroom/ toilet with sufficient quantity of water is done."}	{Y/N}	{t}	{f}
{"Execution - Waterproofing Work"}	{PCPL/EXEC/WATP/2024/0001}	{"Chemical Coat"}	{"Before commencement of work, kindly check for any loose debris/material, if any?"}	{Y/N}	{t}	{f}
{"Execution - Waterproofing Work"}	{PCPL/EXEC/WATP/2024/0001}	{Basecoat}	{"Maintain slope of 1:100 from entrance door towards water escape pipe (drainage pipe) with cement mortar 1:4 & thickness 25 mm to 40 mm using approved waterproofing chemical."}	{Y/N}	{t}	{f}
{"Execution - Waterproofing Work"}	{PCPL/EXEC/WATP/2024/0001}	{Brickbat}	{"Lay well burnt brick bats, thoroughly soaked in water, on edge and fill the joint cement mortar in 1:6 proportion with slope of 1:100 ,with approved waterproofing chemical."}	{Y/N}	{t}	{f}
{"Execution - Waterproofing Work"}	{PCPL/EXEC/WATP/2024/0001}	{Brickbat}	{"Curing for 4 days & confirm that there is no leakage is present."}	{Y/N}	{t}	{f}
{"Execution - Waterproofing Work"}	{PCPL/EXEC/WATP/2024/0001}	{Finishing}	{"IPS with 1:4 cement mortar with waterproofing compound and maintain proper slope from entrance to nahani trap & finish with neat cement slurry."}	{Y/N}	{t}	{f}
{"Quality - Block Masonry"}	{PCPL/QUAL/BLOCK-MASONRY/2024/0001}	{"Single Stage"}	{"While fixing of door frames, concrete is properly filled around door hinges?"}	{Y/N}	{t}	{f}
{"Quality - Block Masonry"}	{PCPL/QUAL/BLOCK-MASONRY/2024/0001}	{"Single Stage"}	{"Less wastage of bricks is practiced and left over bricks are lifted to next floor level?"}	{Y/N}	{f}	{f}
{"Quality - Block Masonry"}	{PCPL/QUAL/BLOCK-MASONRY/2024/0001}	{"Single Stage"}	{"Block layers are maintained in line and level?"}	{Y/N}	{f}	{f}
{"Quality - Block Masonry"}	{PCPL/QUAL/BLOCK-MASONRY/2024/0001}	{"Single Stage"}	{"Block work verticality or plumb is checked?"}	{Y/N}	{t}	{f}
{"Quality - Block Masonry"}	{PCPL/QUAL/BLOCK-MASONRY/2024/0001}	{"Single Stage"}	{"Chapkam is checked for line and level, alignment purposes?"}	{Y/N}	{t}	{f}
{"Quality - Block Masonry"}	{PCPL/QUAL/BLOCK-MASONRY/2024/0001}	{"Single Stage"}	{"Chemical joint is filled properly?"}	{Y/N}	{f}	{t}
{"Quality - Block Masonry"}	{PCPL/QUAL/BLOCK-MASONRY/2024/0001}	{"Single Stage"}	{"Is floor surface is properly cleaned before commencement of work?"}	{Y/N}	{t}	{f}
{"Quality - Block Masonry"}	{PCPL/QUAL/BLOCK-MASONRY/2024/0001}	{"Single Stage"}	{"Patchers to be used in top layer of bricks below beam level?"}	{Y/N}	{t}	{f}
{"Quality - Block Masonry"}	{PCPL/QUAL/BLOCK-MASONRY/2024/0001}	{"Single Stage"}	{"Curing of brick work is done for 7 days?"}	{Y/N}	{t}	{f}
{"Quality - Block Masonry"}	{PCPL/QUAL/BLOCK-MASONRY/2024/0001}	{"Single Stage"}	{"Flooring thickness dhada is fixed in lobby area?"}	{Y/N}	{t}	{f}
{"Quality - Block Masonry"}	{PCPL/QUAL/BLOCK-MASONRY/2024/0001}	{"Single Stage"}	{"For Electrical boxes, fixing and conduit pipes & chipping is properly done with machine as well as ensured that hammering hasn't created any cracks in joints of wall."}	{Y/N}	{f}	{f}
{"Quality - Block Masonry"}	{PCPL/QUAL/BLOCK-MASONRY/2024/0001}	{"Single Stage"}	{"After Electrical piping completed, Mortar filling is done properly to ensure pipes in position as per drawings?"}	{Y/N}	{f}	{f}
{"Quality - Block Masonry"}	{PCPL/QUAL/BLOCK-MASONRY/2024/0001}	{"Single Stage"}	{"Loft casting is in line & level in toilet area?"}	{Y/N}	{f}	{t}
{"Quality - Block Masonry"}	{PCPL/QUAL/BLOCK-MASONRY/2024/0001}	{"Single Stage"}	{"Gypsum work is done prior to loft casting in toilet sunk bottom slab."}	{Y/N}	{t}	{t}
{"Quality - Block Masonry"}	{PCPL/QUAL/BLOCK-MASONRY/2024/0001}	{"Single Stage"}	{"After block work completed all the debris is removed?"}	{Y/N}	{t}	{f}
{"Quality - Block Masonry"}	{PCPL/QUAL/BLOCK-MASONRY/2024/0001}	{"Single Stage"}	{"Brick samples are sent to internal lab?"}	{Y/N}	{t}	{f}
{"Quality - Block Masonry"}	{PCPL/QUAL/BLOCK-MASONRY/2024/0001}	{"Single Stage"}	{"Size of bricks samples are as per standsard tests?"}	{Y/N}	{f}	{f}
{"Quality - Block Masonry"}	{PCPL/QUAL/BLOCK-MASONRY/2024/0001}	{"Single Stage"}	{"Compressive test of brick samples are as per standard tests?"}	{Y/N}	{t}	{f}
{"Quality - Block Masonry"}	{PCPL/QUAL/BLOCK-MASONRY/2024/0001}	{"Single Stage"}	{"Block joint mortar is not more than 10mm?"}	{Y/N}	{f}	{t}
{"Quality - Brick Work"}	{PCPL/QUAL/BRICK-MASNRY/2024/0001}	{"Single Stage"}	{"Floor surface is properly cleaned post completion of work?"}	{Y/N}	{t}	{f}
{"Quality - Brick Work"}	{PCPL/QUAL/BRICK-MASNRY/2024/0001}	{"Single Stage"}	{"Brick samples are sent to internal lab for testing?"}	{Y/N}	{t}	{f}
{"Quality - Brick Work"}	{PCPL/QUAL/BRICK-MASNRY/2024/0001}	{"Single Stage"}	{"Size of bricks samples as per standsard tests?"}	{Y/N}	{f}	{f}
{"Quality - Brick Work"}	{PCPL/QUAL/BRICK-MASNRY/2024/0001}	{"Single Stage"}	{"Compressive test of brick samples as per standard tests?"}	{Y/N}	{t}	{f}
{"Quality - Brick Work"}	{PCPL/QUAL/BRICK-MASNRY/2024/0001}	{"Single Stage"}	{"For Electrical boxes fixing and conduit pipes, chipping is properly done with machine & ensured no hammering it has created any cracks in joints of wall."}	{Y/N}	{t}	{f}
{"Quality - Brick Work"}	{PCPL/QUAL/BRICK-MASNRY/2024/0001}	{"Single Stage"}	{"Flooring thickness dhada is fixed in lobby area?"}	{Y/N}	{t}	{f}
{"Quality - Brick Work"}	{PCPL/QUAL/BRICK-MASNRY/2024/0001}	{"Single Stage"}	{"Curing of brick work is done for 7 days?"}	{Y/N}	{t}	{f}
{"Quality - Brick Work"}	{PCPL/QUAL/BRICK-MASNRY/2024/0001}	{"Single Stage"}	{"Brick layers is maintained in line and level?"}	{Y/N}	{t}	{f}
{"Quality - Brick Work"}	{PCPL/QUAL/BRICK-MASNRY/2024/0001}	{"Single Stage"}	{"Tray is available for mixing of CM?"}	{Y/N}	{t}	{f}
{"Quality - Brick Work"}	{PCPL/QUAL/BRICK-MASNRY/2024/0001}	{"Single Stage"}	{"Chapkam is checked for line-level, alignment purposes?"}	{Y/N}	{t}	{f}
{"Quality - Brick Work"}	{PCPL/QUAL/BRICK-MASNRY/2024/0001}	{"Single Stage"}	{"Brick work is done in CM ratio of 1: 6 or 1: 4 and ensured that mortar is mixed in tray only?"}	{Y/N}	{f}	{f}
{"Quality - Brick Work"}	{PCPL/QUAL/BRICK-MASNRY/2024/0001}	{"Single Stage"}	{"Brick work verticality or plumb is checked?"}	{Y/N}	{f}	{f}
{"Quality - Brick Work"}	{PCPL/QUAL/BRICK-MASNRY/2024/0001}	{"Single Stage"}	{"Ensured that Efflorescence on bricks is not present?"}	{Y/N}	{f}	{t}
{"Quality - Brick Work"}	{PCPL/QUAL/BRICK-MASNRY/2024/0001}	{"Single Stage"}	{"On brick face side, brick joints are filled with mortar and racking is done neatly?"}	{Y/N}	{t}	{f}
{"Quality - Brick Work"}	{PCPL/QUAL/BRICK-MASNRY/2024/0001}	{"Single Stage"}	{"Brick joints are properly filled with mortar and brooming is done?"}	{Y/N}	{t}	{f}
{"Quality - Brick Work"}	{PCPL/QUAL/BRICK-MASNRY/2024/0001}	{"Single Stage"}	{"Door frames are fixed in line and level w.r.to floor dhada?"}	{Y/N}	{f}	{f}
{"Quality - Brick Work"}	{PCPL/QUAL/BRICK-MASNRY/2024/0001}	{"Single Stage"}	{"Ensured that brick joint mortar is not more than 10mm?"}	{Y/N}	{f}	{f}
{"Quality - Brick Work"}	{PCPL/QUAL/BRICK-MASNRY/2024/0001}	{"Single Stage"}	{"Door hinges are fixed properly in Concrete 1:2:4?"}	{Y/N}	{t}	{f}
{"Quality - Brick Work"}	{PCPL/QUAL/BRICK-MASNRY/2024/0001}	{"Single Stage"}	{"Less wastage of bricks is practiced and left over bricks are lifted to next floor level?"}	{Y/N}	{f}	{f}
{"Quality - Brick Work"}	{PCPL/QUAL/BRICK-MASNRY/2024/0001}	{"Single Stage"}	{"Patchers to be used in top layer of bricks below beam level?"}	{Y/N}	{t}	{f}
{"Quality - Brick Work"}	{PCPL/QUAL/BRICK-MASNRY/2024/0001}	{"Single Stage"}	{"Cement-mortar ratio is checked?"}	{Y/N}	{f}	{t}
{"Quality - Brick Work"}	{PCPL/QUAL/BRICK-MASNRY/2024/0001}	{"Single Stage"}	{"After Electrical piping completed, Mortar filling is done properly to ensure pipes in position as per drawings?"}	{Y/N}	{f}	{f}
{"Quality - Brick Work"}	{PCPL/QUAL/BRICK-MASNRY/2024/0001}	{"Single Stage"}	{"Loft casting is in line & level in toilet area?"}	{Y/N}	{f}	{f}
{"Quality - Brick Work"}	{PCPL/QUAL/BRICK-MASNRY/2024/0001}	{"Single Stage"}	{"Gypsum work is done prior to loft casting in Toilet sunk bottom slab."}	{Y/N}	{t}	{t}
{"Quality - External Plaster"}	{PCPL/QUAL/EXT-PLST/2024/0001}	{"Single Stage"}	{"Encountered any efflorescence to brick?"}	{Y/N}	{f}	{f}
{"Quality - External Plaster"}	{PCPL/QUAL/EXT-PLST/2024/0001}	{"Single Stage"}	{"Before start of plaster, RCC surface is cleaned and no nails, binding wires, any loose concrete is present?"}	{Y/N}	{t}	{t}
{"Quality - External Plaster"}	{PCPL/QUAL/EXT-PLST/2024/0001}	{"Single Stage"}	{"AC pipe outlets are sealed and maintained properly in line-level to achieve symmetry at all floors?"}	{Y/N}	{t}	{f}
{"Quality - External Plaster"}	{PCPL/QUAL/EXT-PLST/2024/0001}	{"Single Stage"}	{"All electrical points below chajja are at same place to look symmetry in elevation, if any rectification required before start of plaster?"}	{Y/N}	{t}	{f}
{"Quality - External Plaster"}	{PCPL/QUAL/EXT-PLST/2024/0001}	{"Single Stage"}	{"All floors granite/ alluminium windows frames, gaps are filled properly before start of plaster?"}	{Y/N}	{t}	{f}
{"Quality - External Plaster"}	{PCPL/QUAL/EXT-PLST/2024/0001}	{"Single Stage"}	{"Brick bat in the corner of beam and External chajja corners is placed properly?"}	{Y/N}	{f}	{f}
{"Quality - External Plaster"}	{PCPL/QUAL/EXT-PLST/2024/0001}	{"Single Stage"}	{"Is excess mortar used in corner of beam and external chajja top in round portion?"}	{Y/N}	{f}	{f}
{"Quality - External Plaster"}	{PCPL/QUAL/EXT-PLST/2024/0001}	{"Single Stage"}	{"Any cracks on the corner/round portion of external chajja is observed in plaster ?"}	{Y/N}	{f}	{f}
{"Quality - External Plaster"}	{PCPL/QUAL/EXT-PLST/2024/0001}	{"Single Stage"}	{"If any undulations in beams and chajjas in-line and levels?"}	{Y/N}	{f}	{f}
{"Quality - External Plaster"}	{PCPL/QUAL/EXT-PLST/2024/0001}	{"Single Stage"}	{"Brick wall is cleaned properly before commencement of work?"}	{Y/N}	{t}	{f}
{"Quality - External Plaster"}	{PCPL/QUAL/EXT-PLST/2024/0001}	{"Single Stage"}	{"Applied the chemical on RCC surfaces like beams and columns before start of plaster?"}	{Y/N}	{f}	{t}
{"Quality - External Plaster"}	{PCPL/QUAL/EXT-PLST/2024/0001}	{"Single Stage"}	{"Proper fixing of chicken mesh on all columns and beams juctions ?"}	{Y/N}	{f}	{t}
{"Quality - External Plaster"}	{PCPL/QUAL/EXT-PLST/2024/0001}	{"Single Stage"}	{"Ensured that external plaster of chajja in line and level by checking with linedori?"}	{Y/N}	{f}	{f}
{"Quality - External Plaster"}	{PCPL/QUAL/EXT-PLST/2024/0001}	{"Single Stage"}	{"For mixing of plastering materials, trays are compulsory used?"}	{Y/N}	{f}	{f}
{"Quality - External Plaster"}	{PCPL/QUAL/EXT-PLST/2024/0001}	{"Single Stage"}	{"During prepartions and after completion of plaster work, ensured that all the safety norms followed?"}	{Y/N}	{f}	{f}
{"Quality - External Plaster"}	{PCPL/QUAL/EXT-PLST/2024/0001}	{"Single Stage"}	{"Plumbing outlets holes are properly filled with waterproof chemical and checked for any leakages before plaster start?"}	{Y/N}	{t}	{f}
{"Quality - External Plaster"}	{PCPL/QUAL/EXT-PLST/2024/0001}	{"Single Stage"}	{"Check the parapet wall top level dhada to be given pheriphery of around slab ?"}	{Y/N}	{t}	{f}
{"Quality - External Plaster"}	{PCPL/QUAL/EXT-PLST/2024/0001}	{"Single Stage"}	{"External plaster dhada is made to check the thickness of plaster"}	{Y/N}	{t}	{f}
{"Quality - External Plaster"}	{PCPL/QUAL/EXT-PLST/2024/0001}	{"Single Stage"}	{"Ensure scaflodding supports to be kept in brick wall?"}	{Y/N}	{t}	{f}
{"Quality - Gypsum"}	{PCPL/QUAL/GYPSUM/2024/0001}	{"Single Stage"}	{"Checked for hollowness or de-bonding by knocking the surface?"}	{Y/N}	{t}	{f}
{"Quality - Gypsum"}	{PCPL/QUAL/GYPSUM/2024/0001}	{"Single Stage"}	{"Cleaning of ceiling and plastered walls is done properly?"}	{Y/N}	{t}	{f}
{"Quality - Gypsum"}	{PCPL/QUAL/GYPSUM/2024/0001}	{"Single Stage"}	{"Rusting stains due to nails or binding wires is checked?"}	{Y/N}	{t}	{f}
{"Quality - Gypsum"}	{PCPL/QUAL/GYPSUM/2024/0001}	{"Single Stage"}	{"Apply of  hack-aid plast to RCC slab & ceiling, before applying gypsum one day prior only?"}	{Y/N}	{t}	{f}
{"Quality - Gypsum"}	{PCPL/QUAL/GYPSUM/2024/0001}	{"Single Stage"}	{"Line, level and vertical plumb of gypsum done w.r.to dhada?"}	{Y/N}	{t}	{f}
{"Quality - Gypsum"}	{PCPL/QUAL/GYPSUM/2024/0001}	{"Single Stage"}	{"Before the start of gypsum work, all the corners are checked properly?"}	{Y/N}	{t}	{f}
{"Quality - Gypsum"}	{PCPL/QUAL/GYPSUM/2024/0001}	{"Single Stage"}	{"Right Angles of room/flat sizes is checked before the start of gypsum work?"}	{Y/N}	{t}	{f}
{"Quality - Gypsum"}	{PCPL/QUAL/GYPSUM/2024/0001}	{"Single Stage"}	{"Cutting of gypsum at bottom for skirting is done?"}	{Y/N}	{t}	{f}
{"Quality - Gypsum"}	{PCPL/QUAL/GYPSUM/2024/0001}	{"Single Stage"}	{"Checked for dampness or leakages, if any?"}	{Y/N}	{t}	{f}
{"Quality - Gypsum"}	{PCPL/QUAL/GYPSUM/2024/0001}	{"Single Stage"}	{"Checking with tubelight, if any undulations observed needs to be rectified?"}	{Y/N}	{t}	{f}
{"Quality - Internal Painting"}	{PCPL/QUAL/INTERNAL-PAINTING/2024/0001}	{Preparation}	{"All skirting work is completed & checked?"}	{Y/N}	{t}	{f}
{"Quality - Internal Painting"}	{PCPL/QUAL/INTERNAL-PAINTING/2024/0001}	{Preparation}	{"Upon completion of complete skiritng work, jad plaster is done?"}	{Y/N}	{t}	{f}
{"Quality - Internal Painting"}	{PCPL/QUAL/INTERNAL-PAINTING/2024/0001}	{During}	{"After plaster completed, POP/ Neeru / Putty is done in order to get the smooth finished wall?"}	{Y/N}	{t}	{f}
{"Quality - Internal Painting"}	{PCPL/QUAL/INTERNAL-PAINTING/2024/0001}	{During}	{"Scrubbing / rubbing is done for smooth finished surface?"}	{Y/N}	{t}	{f}
{"Quality - Internal Painting"}	{PCPL/QUAL/INTERNAL-PAINTING/2024/0001}	{During}	{"Painting scheme/ approved make / brand approved by Architect consultant."}	{Y/N}	{f}	{f}
{"Quality - Internal Painting"}	{PCPL/QUAL/INTERNAL-PAINTING/2024/0001}	{During}	{"Applied 1st coat of primer on the prepared surface properly?"}	{Y/N}	{t}	{f}
{"Quality - Internal Painting"}	{PCPL/QUAL/INTERNAL-PAINTING/2024/0001}	{During}	{"All opened hair-line cracks are properly filled with 1st Quality of POP paste?"}	{Y/N}	{t}	{f}
{"Quality - Internal Painting"}	{PCPL/QUAL/INTERNAL-PAINTING/2024/0001}	{During}	{"Applied 1st coat of Lambi-Plaster (Putty) to the surface (as touch-up coat)?"}	{Y/N}	{t}	{f}
{"Quality - Internal Painting"}	{PCPL/QUAL/INTERNAL-PAINTING/2024/0001}	{During}	{"Ensured of all dhars & junction in line & wall surface is in level?"}	{Y/N}	{t}	{f}
{"Quality - Internal Painting"}	{PCPL/QUAL/INTERNAL-PAINTING/2024/0001}	{During}	{"Applied 2nd coat of Lambi-Plaster (Putty) to the prepared surface (as finish coat)."}	{Y/N}	{t}	{f}
{"Quality - Internal Painting"}	{PCPL/QUAL/INTERNAL-PAINTING/2024/0001}	{During}	{"Applied 2nd coat of primer to the prepared surface of wall & ceilings?"}	{Y/N}	{t}	{f}
{"Quality - Internal Painting"}	{PCPL/QUAL/INTERNAL-PAINTING/2024/0001}	{During}	{"All electrical accessories are fixed as per specification & covered with glue tape."}	{Y/N}	{t}	{f}
{"Quality - Internal Painting"}	{PCPL/QUAL/INTERNAL-PAINTING/2024/0001}	{During}	{"Applied 1st coat of paint on the prepared surface of the wall."}	{Y/N}	{t}	{f}
{"Quality - Internal Painting"}	{PCPL/QUAL/INTERNAL-PAINTING/2024/0001}	{During}	{"Applied 2nd coat of the paint on prepared surface, after undercoat has dried?"}	{Y/N}	{t}	{f}
{"Quality - Internal Painting"}	{PCPL/QUAL/INTERNAL-PAINTING/2024/0001}	{During}	{"Applied 2nd coat of paint  on prepared surface, after below coat has dried."}	{Y/N}	{t}	{f}
{"Quality - Internal Plaster"}	{PCPL/QUAL/INT-PLSTR/2024/0001}	{"Single Stage"}	{"Before start of plaster, RCC surfaces is cleaned properly and checked for any nails , binding wires , loose concrete etc present on floor surface?"}	{Y/N}	{t}	{f}
{"Quality - Internal Plaster"}	{PCPL/QUAL/INT-PLSTR/2024/0001}	{"Single Stage"}	{"Applied the Chemical on RCC surfaces like beams, columns before start of plaster?"}	{Y/N}	{t}	{f}
{"Quality - Internal Plaster"}	{PCPL/QUAL/INT-PLSTR/2024/0001}	{"Single Stage"}	{"All Electrical pipelines and Electrical boxes are fixed properly?"}	{Y/N}	{t}	{f}
{"Quality - Internal Plaster"}	{PCPL/QUAL/INT-PLSTR/2024/0001}	{"Single Stage"}	{"Is brick wall/surface is properly cleaned before commencement of work?"}	{Y/N}	{t}	{f}
{"Quality - Internal Plaster"}	{PCPL/QUAL/INT-PLSTR/2024/0001}	{"Single Stage"}	{"Observed any efflorescence to brick?"}	{Y/N}	{f}	{t}
{"Quality - Internal Plaster"}	{PCPL/QUAL/INT-PLSTR/2024/0001}	{"Single Stage"}	{"Is gypsum dhada done with line-level (plumb) not exceeding total thickness of 15mm (gypsum+ plaster)?"}	{Y/N}	{t}	{f}
{"Quality - Internal Plaster"}	{PCPL/QUAL/INT-PLSTR/2024/0001}	{"Single Stage"}	{"After Electrical pipelines fixed packing is done with rich mortar?"}	{Y/N}	{t}	{f}
{"Quality - Internal Plaster"}	{PCPL/QUAL/INT-PLSTR/2024/0001}	{"Single Stage"}	{"Chicken mesh to be fixed at all composite junctions properly"}	{Y/N}	{t}	{f}
{"Quality - Internal Plaster"}	{PCPL/QUAL/INT-PLSTR/2024/0001}	{"Single Stage"}	{"Plumbing line pressure is checked, before commencement of toilet internal plaster?"}	{Y/N}	{t}	{f}
{"Quality - Internal Plaster"}	{PCPL/QUAL/INT-PLSTR/2024/0001}	{"Single Stage"}	{"Plastering is done w.r.to gypsum dhada considering gypsum as 6-8mm, in line-level?"}	{Y/N}	{f}	{t}
{"Quality - Internal Plaster"}	{PCPL/QUAL/INT-PLSTR/2024/0001}	{"Single Stage"}	{"Line, level, Edges & offsets of plastering for Beams, columns are checked ?"}	{Y/N}	{t}	{f}
{"Quality - Internal Plaster"}	{PCPL/QUAL/INT-PLSTR/2024/0001}	{"Single Stage"}	{"200mm of gap of skirting is kept from floor level while doing plaster on wall?"}	{Y/N}	{t}	{f}
{"Quality - Internal Plaster"}	{PCPL/QUAL/INT-PLSTR/2024/0001}	{"Single Stage"}	{"Mixing of CM 1: 4 is done in tray only and ensured water content is as per specification?"}	{Y/N}	{t}	{f}
{"Quality - Internal Plaster"}	{PCPL/QUAL/INT-PLSTR/2024/0001}	{"Single Stage"}	{"All the loose and waste plaster materials are cleaned/removed on the same day?"}	{Y/N}	{t}	{f}
{"Quality - Internal Plaster"}	{PCPL/QUAL/INT-PLSTR/2024/0001}	{"Single Stage"}	{"House keeping is done upon completion of plaster work?"}	{Y/N}	{t}	{f}
{"Quality - Internal Plaster"}	{PCPL/QUAL/INT-PLSTR/2024/0001}	{"Single Stage"}	{"Tie rod holes are filled with GP2 at skirting level?"}	{Y/N}	{t}	{f}
{"Quality - RCC"}	{PCPL/QUAL/RCC/2024/0001}	{"Single Stage"}	{"M10 concrete filled in gap at beam junctions of Electrical Items?"}	{Y/N}	{t}	{f}
{"Quality - RCC"}	{PCPL/QUAL/RCC/2024/0001}	{"Single Stage"}	{"Size of element in LxBxH is as per drawing?"}	{Y/N}	{t}	{f}
{"Quality - RCC"}	{PCPL/QUAL/RCC/2024/0001}	{"Single Stage"}	{"Plumb or verticality, twists of alignment of elements"}	{Y/N}	{t}	{f}
{"Quality - RCC"}	{PCPL/QUAL/RCC/2024/0001}	{"Single Stage"}	{"Date of casting written on element with Paint"}	{Y/N}	{t}	{f}
{"Quality - RCC"}	{PCPL/QUAL/RCC/2024/0001}	{"Single Stage"}	{"Hessian cloth wrapped around RCC element for curing?"}	{Y/N}	{t}	{f}
{"Quality - RCC"}	{PCPL/QUAL/RCC/2024/0001}	{"Single Stage"}	{"Steel reinforcement is in position as per drawing in starter?"}	{Y/N}	{f}	{t}
{"Quality - RCC"}	{PCPL/QUAL/RCC/2024/0001}	{"Single Stage"}	{"Any joggling of rebars is observed?"}	{Y/N}	{f}	{t}
{"Quality - RCC"}	{PCPL/QUAL/RCC/2024/0001}	{"Single Stage"}	{"Alignment of electrical boxes in walls is correct?"}	{Y/N}	{t}	{f}
{"Quality - RCC"}	{PCPL/QUAL/RCC/2024/0001}	{"Single Stage"}	{"Column surface affected on the exposed surface due to shuttering oil?"}	{Y/N}	{t}	{f}
{"Quality - RCC"}	{PCPL/QUAL/RCC/2024/0001}	{"Single Stage"}	{"All tie rod, pvc pipes removed?"}	{Y/N}	{f}	{t}
{"Quality - RCC"}	{PCPL/QUAL/RCC/2024/0001}	{"Single Stage"}	{"Grouting of tie rod with GP2 done?"}	{Y/N}	{t}	{f}
{"Quality - RCC"}	{PCPL/QUAL/RCC/2024/0001}	{"Single Stage"}	{"Loose binding wires, shuttering Nails, Masking tapes and any cement bags are removed?"}	{Y/N}	{t}	{f}
{"Quality - RCC"}	{PCPL/QUAL/RCC/2024/0001}	{"Single Stage"}	{"Is bulging encountered in any structure?"}	{Y/N}	{f}	{t}
{"Quality - RCC"}	{PCPL/QUAL/RCC/2024/0001}	{"Single Stage"}	{"Is oil spilled-out in bottom of slab surface?"}	{Y/N}	{f}	{t}
{"Quality - RCC"}	{PCPL/QUAL/RCC/2024/0001}	{"Single Stage"}	{"Grinding of RCC elements at effected area?"}	{Y/N}	{f}	{t}
{"Quality - RCC"}	{PCPL/QUAL/RCC/2024/0001}	{"Single Stage"}	{"Is extra concrete fallen on floor/beams/ chajjas?"}	{Y/N}	{f}	{f}
{"Quality - RCC"}	{PCPL/QUAL/RCC/2024/0001}	{"Single Stage"}	{"Dowels for extension slab left as per drawings?"}	{Y/N}	{t}	{f}
{"Quality - RCC"}	{PCPL/QUAL/RCC/2024/0001}	{"Single Stage"}	{"Exposed dowells are treated with chemical?"}	{Y/N}	{t}	{f}
{"Quality - RCC"}	{PCPL/QUAL/RCC/2024/0001}	{"Single Stage"}	{"Staircase dowels and steps are as per drawings?"}	{Y/N}	{t}	{f}
{"Quality - RCC"}	{PCPL/QUAL/RCC/2024/0001}	{"Single Stage"}	{"Internal dimensions checked for tower crane parking, car lifts and regular lifts?"}	{Y/N}	{f}	{t}
{"Quality - RCC"}	{PCPL/QUAL/RCC/2024/0001}	{"Single Stage"}	{"Any leakages / improper finish of slab is identified?"}	{Y/N}	{f}	{t}
{"Quality - RCC"}	{PCPL/QUAL/RCC/2024/0001}	{"Single Stage"}	{"Any gaps found below beam junction of Eletrical items?"}	{Y/N}	{f}	{t}
{"Quality - RCC"}	{PCPL/QUAL/RCC/2024/0001}	{"Single Stage"}	{"Honeycombing encountered in element?"}	{Y/N}	{t}	{f}
{"Quality - Waterproofing Work"}	{PCPL/QUAL/WATPRFW/2024/0001}	{"Single Stage"}	{"Closing of outlet opening in wall of WC & Nani trap as per slope and plumbing drawing?"}	{Y/N}	{t}	{f}
{"Quality - Waterproofing Work"}	{PCPL/QUAL/WATPRFW/2024/0001}	{"Single Stage"}	{"Curing for 2-3 days"}	{Y/N}	{t}	{f}
{"Quality - Waterproofing Work"}	{PCPL/QUAL/WATPRFW/2024/0001}	{"Single Stage"}	{"Provision of wash basin outlet drop in nani trap provided at correct location?"}	{Y/N}	{t}	{f}
{"Quality - Waterproofing Work"}	{PCPL/QUAL/WATPRFW/2024/0001}	{"Single Stage"}	{"All the joints of plumbing work is checked for leakages if any. (by pressuree testing )"}	{Y/N}	{t}	{f}
{"Quality - Waterproofing Work"}	{PCPL/QUAL/WATPRFW/2024/0001}	{"Single Stage"}	{"Filling of brickbats in wet CM with chemical."}	{Y/N}	{t}	{f}
{"Quality - Waterproofing Work"}	{PCPL/QUAL/WATPRFW/2024/0001}	{"Single Stage"}	{"Curing for first coat is done for atleast 2-3 days?"}	{Y/N}	{t}	{f}
{"Quality - Waterproofing Work"}	{PCPL/QUAL/WATPRFW/2024/0001}	{"Single Stage"}	{"Observed Any leakages after 1st coat i.e Base coat in sunk."}	{Y/N}	{t}	{f}
{"Quality - Waterproofing Work"}	{PCPL/QUAL/WATPRFW/2024/0001}	{"Single Stage"}	{"Upon completion of 3rd coat, curing is done for atleast 2-3 days?"}	{Y/N}	{t}	{f}
{"Quality - Waterproofing Work"}	{PCPL/QUAL/WATPRFW/2024/0001}	{"Single Stage"}	{"Finishing of top layer, 3rd coat with cement mortar (IPS) as per specification."}	{Y/N}	{t}	{f}
{"Quality - Waterproofing Work"}	{PCPL/QUAL/WATPRFW/2024/0001}	{"Single Stage"}	{"Any leakages after 2nd brickbat filling coat in sunk?"}	{Y/N}	{t}	{f}
{"Quality - Waterproofing Work"}	{PCPL/QUAL/WATPRFW/2024/0001}	{"Single Stage"}	{"Before start of water proofing in sunk, rcc surfaces are properly cleaned and ensured that any nails, binding wires, loose concrete etc. is not present?"}	{Y/N}	{t}	{f}
{"Quality - Waterproofing Work"}	{PCPL/QUAL/WATPRFW/2024/0001}	{"Single Stage"}	{"Gadai is done after cleaning of sunk?"}	{Y/N}	{t}	{f}
{"Quality - Waterproofing Work"}	{PCPL/QUAL/WATPRFW/2024/0001}	{"Single Stage"}	{"Ensured mixing of Cement Mortar is done in tray?"}	{Y/N}	{t}	{f}
{"Quality - Waterproofing Work"}	{PCPL/QUAL/WATPRFW/2024/0001}	{"Single Stage"}	{"Ensured mixing of chemical as per quantity of cement mortar in tray?"}	{Y/N}	{t}	{f}
{"Quality - Waterproofing Work"}	{PCPL/QUAL/WATPRFW/2024/0001}	{"Single Stage"}	{"1st coat of waterproofing base-coat is done as per specifications?"}	{Y/N}	{t}	{f}
{"Safety - Bar Bending Machine"}	{PCPL/SAF/BAR-BENDING-MACHINE/2024/0001}	{"Single Stage"}	{"Machine is operated by competent person?"}	{Y/N}	{f}	{f}
{"Safety - Bar Bending Machine"}	{PCPL/SAF/BAR-BENDING-MACHINE/2024/0001}	{"Single Stage"}	{"Operating switch is free from defects? e.g. uninsulated & broken, etc."}	{Y/N}	{f}	{f}
{"Safety - Bar Bending Machine"}	{PCPL/SAF/BAR-BENDING-MACHINE/2024/0001}	{"Single Stage"}	{"Power cable is free from damages?"}	{Y/N}	{f}	{f}
{"Safety - Bar Bending Machine"}	{PCPL/SAF/BAR-BENDING-MACHINE/2024/0001}	{"Single Stage"}	{"Physical condition of body is good & sound?"}	{Y/N}	{t}	{f}
{"Safety - Bar Bending Machine"}	{PCPL/SAF/BAR-BENDING-MACHINE/2024/0001}	{"Single Stage"}	{"Electrical connection is taken through industrial plug in proper manner?"}	{Y/N}	{t}	{f}
{"Safety - Bar Bending Machine"}	{PCPL/SAF/BAR-BENDING-MACHINE/2024/0001}	{"Single Stage"}	{"On/Off or other switches are free from defects? e.g. uninsulated & broken, etc."}	{Y/N}	{t}	{f}
{"Safety - Bar Bending Machine"}	{PCPL/SAF/BAR-BENDING-MACHINE/2024/0001}	{"Single Stage"}	{"Emergency stop button is mushroom headed with red colour?"}	{Y/N}	{t}	{f}
{"Safety - Bar Bending Machine"}	{PCPL/SAF/BAR-BENDING-MACHINE/2024/0001}	{"Single Stage"}	{"Bar support is properly fitted with machine?"}	{Y/N}	{f}	{f}
{"Safety - Bar Bending Machine"}	{PCPL/SAF/BAR-BENDING-MACHINE/2024/0001}	{"Single Stage"}	{"Pins is free from loose fitting?"}	{Y/N}	{f}	{f}
{"Safety - Bar Bending Machine"}	{PCPL/SAF/BAR-BENDING-MACHINE/2024/0001}	{"Single Stage"}	{"Machine is grounded as per IS 3043:1987?"}	{Y/N}	{f}	{f}
{"Safety - Bar Cutting Machine"}	{PCPL/SAF/BAR-CUTTING-MACHINE/2024/0001}	{"Single Stage"}	{"Operating leaver is insulated with non-conductive material?"}	{Y/N}	{t}	{f}
{"Safety - Bar Cutting Machine"}	{PCPL/SAF/BAR-CUTTING-MACHINE/2024/0001}	{"Single Stage"}	{"Physical condition of body is good & sound?"}	{Y/N}	{t}	{f}
{"Safety - Bar Cutting Machine"}	{PCPL/SAF/BAR-CUTTING-MACHINE/2024/0001}	{"Single Stage"}	{"Rotating part of machine is covered by fixed guard?"}	{Y/N}	{t}	{f}
{"Safety - Bar Cutting Machine"}	{PCPL/SAF/BAR-CUTTING-MACHINE/2024/0001}	{"Single Stage"}	{"Junction box of motor is full packed/covered?"}	{Y/N}	{t}	{f}
{"Safety - Bar Cutting Machine"}	{PCPL/SAF/BAR-CUTTING-MACHINE/2024/0001}	{"Single Stage"}	{"Machine is operated by competent person?"}	{Y/N}	{f}	{f}
{"Safety - Bar Cutting Machine"}	{PCPL/SAF/BAR-CUTTING-MACHINE/2024/0001}	{"Single Stage"}	{"Power cable is free from damages and connection taken through industrial plug?"}	{Y/N}	{f}	{f}
{"Safety - Bar Cutting Machine"}	{PCPL/SAF/BAR-CUTTING-MACHINE/2024/0001}	{"Single Stage"}	{"Machine is grounded as per IS 3043:1987?"}	{Y/N}	{f}	{f}
{"Safety - Bar Cutting Machine"}	{PCPL/SAF/BAR-CUTTING-MACHINE/2024/0001}	{"Single Stage"}	{"Bar guard is fixed with machine?"}	{Y/N}	{t}	{f}
{"Safety - Cradle"}	{PCPL/SAF/CRADLE/2024/0001}	{"Single Stage"}	{"Third party inspection done after location change"}	{Y/N}	{f}	{f}
{"Safety - Cradle"}	{PCPL/SAF/CRADLE/2024/0001}	{"Single Stage"}	{"Hoist Wire rope condition is good?"}	{Y/N}	{t}	{f}
{"Safety - Cradle"}	{PCPL/SAF/CRADLE/2024/0001}	{"Single Stage"}	{"Safe wire rope condition is good?"}	{Y/N}	{t}	{f}
{"Safety - Cradle"}	{PCPL/SAF/CRADLE/2024/0001}	{"Single Stage"}	{"Safe device condition is good?"}	{Y/N}	{f}	{f}
{"Safety - Cradle"}	{PCPL/SAF/CRADLE/2024/0001}	{"Single Stage"}	{"Wire rope clamp condition is good?"}	{Y/N}	{f}	{f}
{"Safety - Cradle"}	{PCPL/SAF/CRADLE/2024/0001}	{"Single Stage"}	{"Counter Weight Lockin System"}	{Y/N}	{t}	{f}
{"Safety - Cradle"}	{PCPL/SAF/CRADLE/2024/0001}	{"Single Stage"}	{"Braking System is in good condition and working?"}	{Y/N}	{f}	{f}
{"Safety - Cradle"}	{PCPL/SAF/CRADLE/2024/0001}	{"Single Stage"}	{"Machine Barricating Condition is good?"}	{Y/N}	{t}	{f}
{"Safety - Cradle"}	{PCPL/SAF/CRADLE/2024/0001}	{"Single Stage"}	{"Buffer Wheels Condition is good?"}	{Y/N}	{f}	{f}
{"Safety - Cradle"}	{PCPL/SAF/CRADLE/2024/0001}	{"Single Stage"}	{"Electrical Pannel Condition is good?"}	{Y/N}	{f}	{f}
{"Safety - Cradle"}	{PCPL/SAF/CRADLE/2024/0001}	{"Single Stage"}	{"Boom & Nut Bolts are in good condition?"}	{Y/N}	{t}	{f}
{"Safety - Cradle"}	{PCPL/SAF/CRADLE/2024/0001}	{"Single Stage"}	{"Remote Condition is good?"}	{Y/N}	{t}	{f}
{"Safety - Cradle"}	{PCPL/SAF/CRADLE/2024/0001}	{"Single Stage"}	{"Machine Foundation Supports is good?"}	{Y/N}	{f}	{f}
{"Safety - Cradle"}	{PCPL/SAF/CRADLE/2024/0001}	{"Single Stage"}	{"Gear Box Condition is good?"}	{Y/N}	{f}	{f}
{"Safety - Cradle"}	{PCPL/SAF/CRADLE/2024/0001}	{"Single Stage"}	{"Guard For Moving Parts is good?"}	{Y/N}	{t}	{f}
{"Safety - Cradle"}	{PCPL/SAF/CRADLE/2024/0001}	{"Single Stage"}	{"Pulley Condition is good?"}	{Y/N}	{f}	{f}
{"Safety - Cradle"}	{PCPL/SAF/CRADLE/2024/0001}	{"Single Stage"}	{"Upper Limit Switch is good?"}	{Y/N}	{f}	{f}
{"Safety - Cradle"}	{PCPL/SAF/CRADLE/2024/0001}	{"Single Stage"}	{"Structure Supports From Flooring is good?"}	{Y/N}	{t}	{f}
{"Safety - Cradle"}	{PCPL/SAF/CRADLE/2024/0001}	{"Single Stage"}	{"Overload Cut Off System is good?"}	{Y/N}	{f}	{f}
{"Safety - Cradle"}	{PCPL/SAF/CRADLE/2024/0001}	{"Single Stage"}	{"Electrical Cable Condition is good?"}	{Y/N}	{t}	{f}
{"Safety - Cradle"}	{PCPL/SAF/CRADLE/2024/0001}	{"Single Stage"}	{"Trolley Base Condition is good enogh?"}	{Y/N}	{t}	{f}
{"Safety - Cradle"}	{PCPL/SAF/CRADLE/2024/0001}	{"Single Stage"}	{"Male-Female Joints of Cables is properly done ?"}	{Y/N}	{f}	{f}
{"Safety - Cradle"}	{PCPL/SAF/CRADLE/2024/0001}	{"Single Stage"}	{"Trolley Wheels Condition is good?"}	{Y/N}	{t}	{f}
{"Safety - Excavation"}	{PCPL/SAF/EXCV/2024/0001}	{"Single Stage"}	{"Are utilities and underground services located, marked & protected?"}	{Y/N}	{f}	{f}
{"Safety - Excavation"}	{PCPL/SAF/EXCV/2024/0001}	{"Single Stage"}	{"Are workers provided with & wearing appropriate Personal Protective Equipment?"}	{Y/N}	{f}	{f}
{"Safety - Excavation"}	{PCPL/SAF/EXCV/2024/0001}	{"Single Stage"}	{"Are all open pits or trenches either covered or barricaded?"}	{Y/N}	{f}	{f}
{"Safety - Excavation"}	{PCPL/SAF/EXCV/2024/0001}	{"Single Stage"}	{"Are excavation sites with depths of more than 1.2m provided with access located at suitable intervals & free of obstruction?"}	{Y/N}	{f}	{f}
{"Safety - Excavation"}	{PCPL/SAF/EXCV/2024/0001}	{"Single Stage"}	{"Have ground condition been checked for changes, particularly after rainfall?"}	{Y/N}	{f}	{f}
{"Safety - Excavation"}	{PCPL/SAF/EXCV/2024/0001}	{"Single Stage"}	{"Are sides of excavation made safe by:"}	{OPTION}	{f}	{f}
{"Safety - Excavation"}	{PCPL/SAF/EXCV/2024/0001}	{"Single Stage"}	{"Are all shoring of adequate size and securely located?"}	{Y/N}	{f}	{f}
{"Safety - Excavation"}	{PCPL/SAF/EXCV/2024/0001}	{"Single Stage"}	{"Have workers been informed of procedure & issued safety instructions?"}	{Y/N}	{f}	{f}
{"Safety - Excavation"}	{PCPL/SAF/EXCV/2024/0001}	{"Single Stage"}	{"Are there adequate warning signs posted/ displayed?"}	{Y/N}	{f}	{f}
{"Safety - Fire Extinguisher"}	{PCPL/SAF/FIRE-EXTINGUISHER/2024/0001}	{"Single Stage"}	{"Available fire extinguisher/s are expired?"}	{Y/N}	{t}	{f}
{"Safety - Fire Extinguisher"}	{PCPL/SAF/FIRE-EXTINGUISHER/2024/0001}	{"Single Stage"}	{"Shell of extinguisher is in good condition?"}	{Y/N}	{f}	{f}
{"Safety - Fire Extinguisher"}	{PCPL/SAF/FIRE-EXTINGUISHER/2024/0001}	{"Single Stage"}	{"Hose/ Horn is in good condition?"}	{Y/N}	{t}	{f}
{"Safety - Fire Extinguisher"}	{PCPL/SAF/FIRE-EXTINGUISHER/2024/0001}	{"Single Stage"}	{"Nozzle is perfect and in good condition?"}	{Y/N}	{f}	{f}
{"Safety - Fire Extinguisher"}	{PCPL/SAF/FIRE-EXTINGUISHER/2024/0001}	{"Single Stage"}	{"Servicing tag/sticker is present on the extinguisher?"}	{Y/N}	{t}	{f}
{"Safety - Fire Extinguisher"}	{PCPL/SAF/FIRE-EXTINGUISHER/2024/0001}	{"Single Stage"}	{"Seal of the fire extinguisher is broken?"}	{Y/N}	{t}	{f}
{"Safety - Fire Extinguisher"}	{PCPL/SAF/FIRE-EXTINGUISHER/2024/0001}	{"Single Stage"}	{"Pressure gauge is clearly visible?"}	{Y/N}	{t}	{f}
{"Safety - Fire Extinguisher"}	{PCPL/SAF/FIRE-EXTINGUISHER/2024/0001}	{"Single Stage"}	{Accessibility}	{Y/N}	{f}	{f}
{"Safety - Fire Extinguisher"}	{PCPL/SAF/FIRE-EXTINGUISHER/2024/0001}	{"Single Stage"}	{"Obstruction Free"}	{Y/N}	{t}	{t}
{"Safety - Fire Extinguisher"}	{PCPL/SAF/FIRE-EXTINGUISHER/2024/0001}	{"Single Stage"}	{"Is extinguisher missing on site or not in place ?"}	{Y/N}	{t}	{t}
{"Safety - Fire Extinguisher"}	{PCPL/SAF/FIRE-EXTINGUISHER/2024/0001}	{"Single Stage"}	{"Any extinguisher is empty ?"}	{Y/N}	{f}	{f}
{"Safety - General Site Inspection"}	{PCPL/SAF/GSI/2024/0001}	{"Single Stage"}	{"Are collective measures in place to stop workers and objects from falling – netting, scaffolding etc.?"}	{OPTION}	{f}	{t}
{"Safety - General Site Inspection"}	{PCPL/SAF/GSI/2024/0001}	{"Single Stage"}	{"Have workers been given Tool Box Talks (TBT), instructed and trained on safe manual handling?"}	{Y/N}	{f}	{f}
{"Safety - General Site Inspection"}	{PCPL/SAF/GSI/2024/0001}	{"Single Stage"}	{"Are First-Aid facilities in place and do workers know where they are?"}	{Y/N}	{t}	{f}
{"Safety - General Site Inspection"}	{PCPL/SAF/GSI/2024/0001}	{"Single Stage"}	{"Are appropriate safety signs in place, large and clearly visible at eye-level?"}	{Y/N}	{t}	{f}
{"Safety - General Site Inspection"}	{PCPL/SAF/GSI/2024/0001}	{"Single Stage"}	{"Are vehicles operating in and out of the premises equipped with visual and reversing aids like reversing camera, horns, sensors, convex mirrors?"}	{Y/N}	{t}	{f}
{"Safety - General Site Inspection"}	{PCPL/SAF/GSI/2024/0001}	{"Single Stage"}	{"is the site well laid-out? Do workers have a safe route of entry to and exit from (including emergency exit) their place of work?"}	{Y/N}	{t}	{f}
{"Safety - General Site Inspection"}	{PCPL/SAF/GSI/2024/0001}	{"Single Stage"}	{"Are the public passing by the site and workers within the premises protected from falling materials, moving machines, deep excavations?"}	{Y/N}	{t}	{f}
{"Safety - General Site Inspection"}	{PCPL/SAF/GSI/2024/0001}	{"Single Stage"}	{"Is the project/construction site fenced and secure to restrict public access and unauthorized entry."}	{Y/N}	{t}	{f}
{"Safety - General Site Inspection"}	{PCPL/SAF/GSI/2024/0001}	{"Single Stage"}	{"Is midplatform provided in lift shaft at every 4th floor"}	{Y/N}	{f}	{f}
{"Safety - General Site Inspection"}	{PCPL/SAF/GSI/2024/0001}	{"Single Stage"}	{"Is top plug provided to electrical cable"}	{Y/N}	{t}	{f}
{"Safety - General Site Inspection"}	{PCPL/SAF/GSI/2024/0001}	{"Single Stage"}	{"Is provided RCCB to elecrical board"}	{Y/N}	{t}	{f}
{"Safety - General Site Inspection"}	{PCPL/SAF/GSI/2024/0001}	{"Single Stage"}	{"Is Safety net provided at 6mtr height"}	{Y/N}	{t}	{f}
{"Safety - General Site Inspection"}	{PCPL/SAF/GSI/2024/0001}	{"Single Stage"}	{"Is barricade provided to building edge"}	{Y/N}	{t}	{f}
{"Safety - General Site Inspection"}	{PCPL/SAF/GSI/2024/0001}	{"Single Stage"}	{"All shaft cutout should be close with jali mesh"}	{Y/N}	{f}	{f}
{"Safety - General Site Inspection"}	{PCPL/SAF/GSI/2024/0001}	{"Single Stage"}	{"Are all employees informed and educated about potential risks and control measures in a language and at a level that they understand?"}	{Y/N}	{f}	{f}
{"Safety - General Site Inspection"}	{PCPL/SAF/GSI/2024/0001}	{"Single Stage"}	{"Are suitable protective measures being used to prevent or reduce exposure to dusts like wood, cement, silica, etc.?"}	{Y/N}	{t}	{f}
{"Safety - General Site Inspection"}	{PCPL/SAF/GSI/2024/0001}	{"Single Stage"}	{"Have lifts and hoists been properly installed, certified and checked by competent authorities?"}	{Y/N}	{t}	{f}
{"Safety - General Site Inspection"}	{PCPL/SAF/GSI/2024/0001}	{"Single Stage"}	{"Where collective fall protection measures are not possible, are persons working at height using appropriate fall arrest/restraint equipment?"}	{Y/N}	{f}	{f}
{"Safety - General Site Inspection"}	{PCPL/SAF/GSI/2024/0001}	{"Single Stage"}	{"Are scaffolds erected, altered and dismantled by competent and certified workers/contractors?"}	{Y/N}	{f}	{f}
{"Safety - Labour Camp Inspection"}	{PCPL/SAF/LABC-INSP/2024/0001}	{"Single Stage"}	{"Is proper lighting arrangement provided at labour camps?"}	{Y/N}	{f}	{f}
{"Safety - Labour Camp Inspection"}	{PCPL/SAF/LABC-INSP/2024/0001}	{"Single Stage"}	{"Are pesticides sprayed every fortnight after removing eatables from the place of application?"}	{Y/N}	{f}	{f}
{"Safety - Labour Camp Inspection"}	{PCPL/SAF/LABC-INSP/2024/0001}	{"Single Stage"}	{"Is fogging done every week to prevent mosquitoes?"}	{Y/N}	{t}	{f}
{"Safety - Labour Camp Inspection"}	{PCPL/SAF/LABC-INSP/2024/0001}	{"Single Stage"}	{"Are emergency contact numbers displayed in labour camps?"}	{Y/N}	{t}	{f}
{"Safety - Labour Camp Inspection"}	{PCPL/SAF/LABC-INSP/2024/0001}	{"Single Stage"}	{"Are separate electrical sockets provided for each room at labour camp?"}	{Y/N}	{f}	{f}
{"Safety - Labour Camp Inspection"}	{PCPL/SAF/LABC-INSP/2024/0001}	{"Single Stage"}	{"Authorised vendor is appointed for removal waste food, and pest control?"}	{Y/N}	{t}	{f}
{"Safety - Labour Camp Inspection"}	{PCPL/SAF/LABC-INSP/2024/0001}	{"Single Stage"}	{"Is register maintained for drinking water cleaning,"}	{Y/N}	{t}	{f}
{"Safety - Labour Camp Inspection"}	{PCPL/SAF/LABC-INSP/2024/0001}	{"Single Stage"}	{"Is labour camp safety ensured like sheds are constructed properly, roof sheets are properly locked, Fire Extinguishers availability etc?"}	{Y/N}	{t}	{f}
{"Safety - Labour Camp Inspection"}	{PCPL/SAF/LABC-INSP/2024/0001}	{"Single Stage"}	{"Are welfare facilities such as basic amenities like drinking water, proper sanitation facilities provided at labour camp?"}	{Y/N}	{t}	{f}
{"Safety - Labour Camp Inspection"}	{PCPL/SAF/LABC-INSP/2024/0001}	{"Single Stage"}	{"Are hygienic conditions ensured at labour camps by maintaining cleanliness?"}	{Y/N}	{f}	{f}
{"Safety - Labour Camp Inspection"}	{PCPL/SAF/LABC-INSP/2024/0001}	{"Single Stage"}	{"Are first aid facilities are available in labour camps?"}	{Y/N}	{t}	{f}
{"Safety - Labour Camp Inspection"}	{PCPL/SAF/LABC-INSP/2024/0001}	{"Single Stage"}	{"Are sufficient fire extinguishers are available in the labour camps?"}	{Y/N}	{t}	{f}
{"Safety - Labour Camp Inspection"}	{PCPL/SAF/LABC-INSP/2024/0001}	{"Single Stage"}	{"Is the security and labour contractor sufficiently trained in firefighting in case of a fire outbreak in labour camp?"}	{Y/N}	{f}	{f}
{"Safety - Labour Camp Inspection"}	{PCPL/SAF/LABC-INSP/2024/0001}	{"Single Stage"}	{"Is drainage system found to be efficient in labour camp?"}	{Y/N}	{f}	{f}
{"Safety - Labour Camp Inspection"}	{PCPL/SAF/LABC-INSP/2024/0001}	{"Single Stage"}	{"Is medical check-up done periodically to prevent the spread of diseases?"}	{Y/N}	{t}	{t}
{"Safety - Labour Camp Inspection"}	{PCPL/SAF/LABC-INSP/2024/0001}	{"Single Stage"}	{"Are toilets in labour camp ensured separately for male and female workers and maintained properly?"}	{Y/N}	{t}	{f}
{"Safety - Pre Monsoon Checklist"}	{PCPL/SAF/PRE-MONSOON/2024/0001}	{"Single Stage"}	{"Relocate all switch board located on ground floor and open staircase where possibility of water/water ingress exists."}	{Y/N}	{t}	{f}
{"Safety - Pre Monsoon Checklist"}	{PCPL/SAF/PRE-MONSOON/2024/0001}	{"Single Stage"}	{"Trench/slope should be made for proper flow of water towrds SWD without obstructions."}	{Y/N}	{f}	{t}
{"Safety - Pre Monsoon Checklist"}	{PCPL/SAF/PRE-MONSOON/2024/0001}	{"Single Stage"}	{"Any expose tree which can fallen, take a prior permission for cutting or trimming."}	{Y/N}	{t}	{f}
{"Safety - Pre Monsoon Checklist"}	{PCPL/SAF/PRE-MONSOON/2024/0001}	{"Single Stage"}	{"Compound wall is checked on regular basis?"}	{Y/N}	{t}	{f}
{"Safety - Pre Monsoon Checklist"}	{PCPL/SAF/PRE-MONSOON/2024/0001}	{"Single Stage"}	{"Support of 35 feet metal sheet is checked on regular basis?"}	{Y/N}	{f}	{t}
{"Safety - Pre Monsoon Checklist"}	{PCPL/SAF/PRE-MONSOON/2024/0001}	{"Single Stage"}	{"The labour camp is kept clean and in hygienic condition?"}	{Y/N}	{t}	{f}
{"Safety - Pre Monsoon Checklist"}	{PCPL/SAF/PRE-MONSOON/2024/0001}	{"Single Stage"}	{"Cleaning of all safety net and ensured that it's tied properly?"}	{Y/N}	{t}	{f}
{"Safety - Pre Monsoon Checklist"}	{PCPL/SAF/PRE-MONSOON/2024/0001}	{"Single Stage"}	{"Prevent contamination of drinking water."}	{Y/N}	{t}	{f}
{"Safety - Pre Monsoon Checklist"}	{PCPL/SAF/PRE-MONSOON/2024/0001}	{"Single Stage"}	{"Malaria prevention precaution taken at site?"}	{Y/N}	{t}	{f}
{"Safety - Pre Monsoon Checklist"}	{PCPL/SAF/PRE-MONSOON/2024/0001}	{"Single Stage"}	{"Unserviceable/damage helmet, tin, tea cup, drum, removed from site?"}	{Y/N}	{t}	{f}
{"Safety - Pre Monsoon Checklist"}	{PCPL/SAF/PRE-MONSOON/2024/0001}	{"Single Stage"}	{"Emergency contact numbers of all the personal/ department of local bodies etc. are displayed at important location?"}	{Y/N}	{t}	{f}
{"Safety - Pre Monsoon Checklist"}	{PCPL/SAF/PRE-MONSOON/2024/0001}	{"Single Stage"}	{"Earth position of all electrical boards are checked for its properness?"}	{Y/N}	{f}	{t}
{"Safety - Pre Monsoon Checklist"}	{PCPL/SAF/PRE-MONSOON/2024/0001}	{"Single Stage"}	{"All electrical installations open to weather are covered /shed of bricks work should be constructed for the same."}	{Y/N}	{f}	{f}
{"Safety - Pre Monsoon Checklist"}	{PCPL/SAF/PRE-MONSOON/2024/0001}	{"Single Stage"}	{"All excavated area are is barricaded and proper access made to the area?"}	{Y/N}	{t}	{f}
{"Safety - Pre Monsoon Checklist"}	{PCPL/SAF/PRE-MONSOON/2024/0001}	{"Single Stage"}	{"All chemical/oil/cement store is shifted under the proper roof or confined room to avoid spillage due to rain?"}	{Y/N}	{t}	{f}
{"Safety - Pre Monsoon Checklist"}	{PCPL/SAF/PRE-MONSOON/2024/0001}	{"Single Stage"}	{"Adequate number of pumps for draining out logged water should be arrange and kept ready for use in emergency."}	{Y/N}	{f}	{f}
{"Safety - Pre Monsoon Checklist"}	{PCPL/SAF/PRE-MONSOON/2024/0001}	{"Single Stage"}	{"Any opening to the basements area to be closed or covered properly."}	{Y/N}	{t}	{t}
{"Safety - Pre Monsoon Checklist"}	{PCPL/SAF/PRE-MONSOON/2024/0001}	{"Single Stage"}	{"Ramps to be closed such way that rain water should not enter in to the basements area through it."}	{Y/N}	{t}	{f}
{"Safety - Pre Monsoon Checklist"}	{PCPL/SAF/PRE-MONSOON/2024/0001}	{"Single Stage"}	{"STP tanks open to weather are covered before monsoon arrives?"}	{Y/N}	{f}	{f}
{"Safety - Pre Monsoon Checklist"}	{PCPL/SAF/PRE-MONSOON/2024/0001}	{"Single Stage"}	{"All duct projecting outside the building structure are covered properly?"}	{Y/N}	{f}	{f}
{"Safety - Pre Monsoon Checklist"}	{PCPL/SAF/PRE-MONSOON/2024/0001}	{"Single Stage"}	{"Storm water drainage checked for blockage & require cleaning? if necessary."}	{Y/N}	{f}	{f}
{"Safety - Pre Monsoon Checklist"}	{PCPL/SAF/PRE-MONSOON/2024/0001}	{"Single Stage"}	{"All roads (nearby site) leading to the site are cleaned and dust free."}	{Y/N}	{t}	{f}
{"Safety - Scaffolding"}	{PCPL/SAF/SCAF/2024/0001}	{"Single Stage"}	{"Width of working platform is less than 600mm?"}	{Y/N}	{f}	{f}
{"Safety - Scaffolding"}	{PCPL/SAF/SCAF/2024/0001}	{"Single Stage"}	{"Floor of working platform is fixed with closely placed plank to eliminate the risk of tripping?"}	{Y/N}	{t}	{f}
{"Safety - Scaffolding"}	{PCPL/SAF/SCAF/2024/0001}	{"Single Stage"}	{"Is there a qualified scaffold supervisor around to supervise the erection of the scaffold?"}	{Y/N}	{f}	{f}
{"Safety - Scaffolding"}	{PCPL/SAF/SCAF/2024/0001}	{"Single Stage"}	{"For scaffold erected above building entrance or exit, protective canopy such as rackers or frame support are provided for overhead protection?"}	{Y/N}	{f}	{f}
{"Safety - Scaffolding"}	{PCPL/SAF/SCAF/2024/0001}	{"Single Stage"}	{"Member for construction scaffold are in good condition with sufficient ties and bracings?"}	{Y/N}	{t}	{f}
{"Safety - Scaffolding"}	{PCPL/SAF/SCAF/2024/0001}	{"Single Stage"}	{"Have any overhead hazards such as power transmission lines, telephone wires, etc., in the vicinity of the scaffold been noted and allowed for?"}	{Y/N}	{f}	{f}
{"Safety - Scaffolding"}	{PCPL/SAF/SCAF/2024/0001}	{"Single Stage"}	{"Have precautions been taken to allow for any possible future excavations which may endanger the scaffold or access to it?"}	{Y/N}	{f}	{f}
{"Safety - Scaffolding"}	{PCPL/SAF/SCAF/2024/0001}	{"Single Stage"}	{"Have any open excavation near to the scaffold which may endanger its stability or access to it, been noted and allowed for?"}	{Y/N}	{f}	{f}
{"Safety - Scaffolding"}	{PCPL/SAF/SCAF/2024/0001}	{"Single Stage"}	{"Is the ground where the scaffold is to be erected firm and not water-logged?"}	{Y/N}	{t}	{f}
{"Safety - Scaffolding"}	{PCPL/SAF/SCAF/2024/0001}	{"Single Stage"}	{"No waste and loose material shall be on scaffold"}	{Y/N}	{t}	{f}
{"Safety - Scaffolding"}	{PCPL/SAF/SCAF/2024/0001}	{"Single Stage"}	{"Provision of safe access and egress from scaffold"}	{Y/N}	{t}	{f}
{"Safety - Scaffolding"}	{PCPL/SAF/SCAF/2024/0001}	{"Single Stage"}	{"Are the Bamboo placed at their correct distances from each other and from the structure they are servicing?"}	{Y/N}	{f}	{f}
{"Safety - Scaffolding"}	{PCPL/SAF/SCAF/2024/0001}	{"Single Stage"}	{"Is bamboo truly horizontal and correctly spaced, particularly at decking-out level?"}	{Y/N}	{f}	{f}
{"Safety - Scaffolding"}	{PCPL/SAF/SCAF/2024/0001}	{"Single Stage"}	{"If over-lapping boards are used, are the over-laps at least 300mm and fillet pieces fitted of adequate cross-section so that the change in level is gradual?"}	{Y/N}	{f}	{f}
{"Safety - Scaffolding"}	{PCPL/SAF/SCAF/2024/0001}	{"Single Stage"}	{"Are guardrails fitted and connected to bamboo?"}	{Y/N}	{f}	{f}
{"Safety - Scaffolding"}	{PCPL/SAF/SCAF/2024/0001}	{"Single Stage"}	{"At every floor internal support is giving?"}	{Y/N}	{t}	{f}
{"Safety - Scaffolding"}	{PCPL/SAF/SCAF/2024/0001}	{"Single Stage"}	{"If the scaffold is erected over a public access has a safety net of close-mesh wire or a fan of boards been erected to prevent articles and debris dislodged from the scaffold falling on to the public access?"}	{Y/N}	{f}	{f}
{"Safety - Scaffolding"}	{PCPL/SAF/SCAF/2024/0001}	{"Single Stage"}	{"Fall arresting system and personal protective equipment is sufficient and in good condition?"}	{Y/N}	{f}	{f}
{"Safety - Tower Crane"}	{"PCPL/SAF/TOWER CRANE/2025/0001"}	{"Single Stage"}	{"Brake Mechanism & clutch checked for function"}	{Y/N}	{f}	{f}
{"Safety - Tower Crane"}	{"PCPL/SAF/TOWER CRANE/2025/0001"}	{"Single Stage"}	{"No abnormal sound noticed"}	{Y/N}	{f}	{t}
{"Safety - Tower Crane"}	{"PCPL/SAF/TOWER CRANE/2025/0001"}	{"Single Stage"}	{"Tower Guarding / Fencing checked for wear,  damage, corrosion, cracking"}	{Y/N}	{f}	{f}
{"Safety - Tower Crane"}	{"PCPL/SAF/TOWER CRANE/2025/0001"}	{"Single Stage"}	{"All limit switches are in working condition: Load"}	{Y/N}	{f}	{f}
{"Safety - Tower Crane"}	{"PCPL/SAF/TOWER CRANE/2025/0001"}	{"Single Stage"}	{"Oil level checked for: Gear box oil"}	{Y/N}	{f}	{f}
{"Safety - Tower Crane"}	{"PCPL/SAF/TOWER CRANE/2025/0001"}	{"Single Stage"}	{"All U & D Clamps are in condition & tight"}	{Y/N}	{f}	{f}
{"Safety - Tower Crane"}	{"PCPL/SAF/TOWER CRANE/2025/0001"}	{"Single Stage"}	{"Oil leakages not observed in: Hydraulic system"}	{Y/N}	{f}	{f}
{"Safety - Tower Crane"}	{"PCPL/SAF/TOWER CRANE/2025/0001"}	{"Single Stage"}	{"Oil leakages not observed in: Gear box assembly"}	{Y/N}	{f}	{f}
{"Safety - Tower Crane"}	{"PCPL/SAF/TOWER CRANE/2025/0001"}	{"Single Stage"}	{"Oil level checked for: Hydraulic oil"}	{Y/N}	{f}	{f}
{"Safety - Tower Crane"}	{"PCPL/SAF/TOWER CRANE/2025/0001"}	{"Single Stage"}	{"Lubrication (Oiling/ greasing): Wire rope"}	{Y/N}	{f}	{f}
{"Safety - Tower Crane"}	{"PCPL/SAF/TOWER CRANE/2025/0001"}	{"Single Stage"}	{"Lubrication (Oiling/ greasing): Pulleys"}	{Y/N}	{f}	{f}
{"Safety - Tower Crane"}	{"PCPL/SAF/TOWER CRANE/2025/0001"}	{"Single Stage"}	{"Pulley & Pins checked for damage & alignment"}	{Y/N}	{f}	{f}
{"Safety - Tower Crane"}	{"PCPL/SAF/TOWER CRANE/2025/0001"}	{"Single Stage"}	{"Smooth to & fro motion of trolley"}	{Y/N}	{f}	{f}
{"Safety - Tower Crane"}	{"PCPL/SAF/TOWER CRANE/2025/0001"}	{"Single Stage"}	{"Wire Ropes checked for damage & alignment"}	{Y/N}	{f}	{f}
{"Safety - Tower Crane"}	{"PCPL/SAF/TOWER CRANE/2025/0001"}	{"Single Stage"}	{"All limit switches are in working condition: Swing"}	{Y/N}	{f}	{f}
{"Safety - Tower Crane"}	{"PCPL/SAF/TOWER CRANE/2025/0001"}	{"Single Stage"}	{"All limit switches are in working condition: Travel"}	{Y/N}	{f}	{f}
{"Safety - Tower Crane"}	{"PCPL/SAF/TOWER CRANE/2025/0001"}	{"Single Stage"}	{"Condition of electrical connection & earthing"}	{Y/N}	{f}	{f}
{"Safety - Tower Crane"}	{"PCPL/SAF/TOWER CRANE/2025/0001"}	{"Single Stage"}	{"Smooth functioning of joysticks"}	{Y/N}	{f}	{f}
{"Safety - Winch Machine"}	{PCPL/SAF/WINCH-MACHINE/2024/0001}	{"Single Stage"}	{"Operating liver is free from defects?"}	{Y/N}	{f}	{f}
{"Safety - Winch Machine"}	{PCPL/SAF/WINCH-MACHINE/2024/0001}	{"Single Stage"}	{"Rope drum have sufficient space to roll-in full slings?"}	{Y/N}	{t}	{f}
{"Safety - Winch Machine"}	{PCPL/SAF/WINCH-MACHINE/2024/0001}	{"Single Stage"}	{"Wire sling is free from damages?"}	{Y/N}	{f}	{f}
{"Safety - Winch Machine"}	{PCPL/SAF/WINCH-MACHINE/2024/0001}	{"Single Stage"}	{"Sling is knotted in proper manner?"}	{Y/N}	{f}	{f}
{"Safety - Winch Machine"}	{PCPL/SAF/WINCH-MACHINE/2024/0001}	{"Single Stage"}	{"Safety latch is properly placed in hook?"}	{Y/N}	{f}	{f}
{"Safety - Winch Machine"}	{PCPL/SAF/WINCH-MACHINE/2024/0001}	{"Single Stage"}	{"Winch is grounded as per IS 3043:1987 ?"}	{Y/N}	{f}	{f}
{"Safety - Winch Machine"}	{PCPL/SAF/WINCH-MACHINE/2024/0001}	{"Single Stage"}	{"Winch machine is properly fixed with hard structure?"}	{Y/N}	{f}	{f}
{"Safety - Winch Machine"}	{PCPL/SAF/WINCH-MACHINE/2024/0001}	{"Single Stage"}	{"Power cable is free from damages and connection taken through industrial plug?"}	{Y/N}	{f}	{f}
{"Safety - Winch Machine"}	{PCPL/SAF/WINCH-MACHINE/2024/0001}	{"Single Stage"}	{"SWL should be written."}	{Y/N}	{f}	{f}
{"Safety - Winch Machine"}	{PCPL/SAF/WINCH-MACHINE/2024/0001}	{"Single Stage"}	{"Rotating part is covered with fixed guard?"}	{Y/N}	{t}	{f}
{"Safety - Winch Machine"}	{PCPL/SAF/WINCH-MACHINE/2024/0001}	{"Single Stage"}	{"Winch is in good, working condition and certified by TPI?"}	{Y/N}	{f}	{f}
\.

