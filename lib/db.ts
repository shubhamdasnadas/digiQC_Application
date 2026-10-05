import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || '5432'),
  database: process.env.PG_DATABASE || 'digiqc_new',
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || 'root',
});

let publicSchemaInitialized = false;

export async function ensurePublicSchemaTables() {
  if (publicSchemaInitialized) return;
  try {
    await pool.query(`
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";

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

      ALTER TABLE public.users ADD COLUMN IF NOT EXISTS name text DEFAULT '';
      ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email text;
      ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_hash text DEFAULT '';
      ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url text DEFAULT '';
      ALTER TABLE public.users ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
      ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

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

      -- Teams in public schema
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

      -- Members in public schema
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
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );

      -- Projects in public schema
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

      -- Shared Library Checklists in public schema (Canonical checklists)
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
        name text NOT NULL,
        witness_required boolean DEFAULT false,
        drawing_required boolean DEFAULT false,
        created_at timestamptz DEFAULT now()
      );

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

      -- Migrate any data from legacy checklist tables into library_* tables before dropping
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'checklists') THEN
          INSERT INTO public.library_checklists (id, project_id, name, reference_number, uom, status, created_at)
          SELECT id, project_id, name, reference_number, uom, COALESCE(status, 'draft'), created_at
          FROM public.checklists
          ON CONFLICT (id) DO UPDATE SET
            project_id = EXCLUDED.project_id,
            name = EXCLUDED.name,
            reference_number = COALESCE(EXCLUDED.reference_number, public.library_checklists.reference_number),
            uom = COALESCE(EXCLUDED.uom, public.library_checklists.uom),
            status = COALESCE(EXCLUDED.status, public.library_checklists.status);
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'checklist_stages') THEN
          INSERT INTO public.library_stages (id, library_checklist_id, sr_no, name, witness_required, drawing_required, created_at)
          SELECT cs.id, cs.checklist_id, COALESCE(cs.sr_no, 1), cs.name, COALESCE(cs.witness_required, false), COALESCE(cs.drawing_required, false), cs.created_at
          FROM public.checklist_stages cs
          WHERE EXISTS (SELECT 1 FROM public.library_checklists lc WHERE lc.id = cs.checklist_id)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            sr_no = EXCLUDED.sr_no,
            witness_required = EXCLUDED.witness_required,
            drawing_required = EXCLUDED.drawing_required;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'checkpoints') THEN
          INSERT INTO public.library_checkpoints (id, library_stage_id, sr_no, question, input_type, photo_required, remark_required, created_at)
          SELECT cp.id, cp.stage_id, COALESCE(cp.sr_no, 1), cp.question, COALESCE(cp.input_type, 'yes_no'), COALESCE(cp.photo_required, false), COALESCE(cp.remark_required, false), cp.created_at
          FROM public.checkpoints cp
          WHERE EXISTS (SELECT 1 FROM public.library_stages ls WHERE ls.id = cp.stage_id)
          ON CONFLICT (id) DO UPDATE SET
            question = EXCLUDED.question,
            sr_no = EXCLUDED.sr_no,
            input_type = EXCLUDED.input_type,
            photo_required = EXCLUDED.photo_required,
            remark_required = EXCLUDED.remark_required;
        END IF;

        -- Remove legacy tables
        DROP TABLE IF EXISTS public.checkpoints CASCADE;
        DROP TABLE IF EXISTS public.checklist_stages CASCADE;
        DROP TABLE IF EXISTS public.checklists CASCADE;
        DROP TABLE IF EXISTS public.checklist CASCADE;
        DROP TABLE IF EXISTS public.eqc_items CASCADE;
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END $$;

      -- Ensure columns exist in case tables were previously created with older schema
      ALTER TABLE public.library_checklists ADD COLUMN IF NOT EXISTS project_id uuid;
      ALTER TABLE public.library_checklists ADD COLUMN IF NOT EXISTS reference_number text;
      ALTER TABLE public.library_checklists ADD COLUMN IF NOT EXISTS uom text DEFAULT '';
      ALTER TABLE public.library_checklists ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft';
      ALTER TABLE public.library_checklists ADD COLUMN IF NOT EXISTS updated_by uuid;
      ALTER TABLE public.library_checklists ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
      ALTER TABLE public.library_checklists ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

      ALTER TABLE public.library_stages ADD COLUMN IF NOT EXISTS witness_required boolean DEFAULT false;
      ALTER TABLE public.library_stages ADD COLUMN IF NOT EXISTS drawing_required boolean DEFAULT false;
      ALTER TABLE public.library_stages ADD COLUMN IF NOT EXISTS sr_no integer DEFAULT 1;

      ALTER TABLE public.library_checkpoints ADD COLUMN IF NOT EXISTS input_type text DEFAULT 'yes_no';
      ALTER TABLE public.library_checkpoints ADD COLUMN IF NOT EXISTS photo_required boolean DEFAULT false;
      ALTER TABLE public.library_checkpoints ADD COLUMN IF NOT EXISTS remark_required boolean DEFAULT false;
      ALTER TABLE public.library_checkpoints ADD COLUMN IF NOT EXISTS sr_no integer DEFAULT 1;
      ALTER TABLE public.library_checkpoints DROP COLUMN IF EXISTS drawing_required;
      ALTER TABLE public.library_checkpoints DROP COLUMN IF EXISTS witness_required;

      -- Drop unique constraint and not-null on reference_number so multiple projects can share reference numbers or have optional reference numbers
      ALTER TABLE public.library_checklists DROP CONSTRAINT IF EXISTS library_checklists_reference_number_key;
      ALTER TABLE public.library_checklists DROP CONSTRAINT IF EXISTS library_checklists_name_key;
      DROP INDEX IF EXISTS public.library_checklists_reference_number_key;
      ALTER TABLE public.library_checklists ALTER COLUMN reference_number DROP NOT NULL;
      ALTER TABLE public.library_checklists ALTER COLUMN reference_number SET DEFAULT '';
      ALTER TABLE public.library_checklists ALTER COLUMN uom DROP NOT NULL;
      ALTER TABLE public.library_checklists ALTER COLUMN uom SET DEFAULT '';
      ALTER TABLE public.library_checklists ALTER COLUMN status DROP NOT NULL;
      ALTER TABLE public.library_checklists ALTER COLUMN status SET DEFAULT 'draft';

      ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS organization_id uuid;
      ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS name text;
      ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS type text DEFAULT 'DEFAULT';
      ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS team_lead_name text DEFAULT '';
      ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS spoc_name text DEFAULT '';
      ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS active_projects text DEFAULT '';
      ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS inactive_projects text DEFAULT '';
      ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
      ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

      ALTER TABLE public.members ADD COLUMN IF NOT EXISTS organization_id uuid;
      ALTER TABLE public.members ADD COLUMN IF NOT EXISTS name text;
      ALTER TABLE public.members ADD COLUMN IF NOT EXISTS email text DEFAULT '';
      ALTER TABLE public.members ADD COLUMN IF NOT EXISTS phone text DEFAULT '';
      ALTER TABLE public.members ADD COLUMN IF NOT EXISTS access_type text DEFAULT '';
      ALTER TABLE public.members ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;
      ALTER TABLE public.members ADD COLUMN IF NOT EXISTS default_role text DEFAULT '';
      ALTER TABLE public.members ADD COLUMN IF NOT EXISTS teams text DEFAULT '';
      ALTER TABLE public.members ADD COLUMN IF NOT EXISTS active_projects text DEFAULT '';
      ALTER TABLE public.members ADD COLUMN IF NOT EXISTS inactive_projects text DEFAULT '';
      ALTER TABLE public.members ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
      ALTER TABLE public.members ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

      ALTER TABLE public.eqcs ADD COLUMN IF NOT EXISTS maker_team text DEFAULT '';
      ALTER TABLE public.eqcs ADD COLUMN IF NOT EXISTS witness_types text[] DEFAULT '{}';
      ALTER TABLE public.eqcs ADD COLUMN IF NOT EXISTS witness_photos text[] DEFAULT '{}';
      ALTER TABLE public.eqcs ADD COLUMN IF NOT EXISTS drawing_photos text[] DEFAULT '{}';
      ALTER TABLE public.eqcs ADD COLUMN IF NOT EXISTS inspection_data jsonb DEFAULT '[]'::jsonb;
      ALTER TABLE public.eqcs ADD COLUMN IF NOT EXISTS geo_tag text DEFAULT '';
      ALTER TABLE public.eqcs ADD COLUMN IF NOT EXISTS time_taken text DEFAULT '';
      ALTER TABLE public.eqcs ADD COLUMN IF NOT EXISTS completed_at timestamptz;
      ALTER TABLE public.eqcs ADD COLUMN IF NOT EXISTS synced_at timestamptz;
      ALTER TABLE public.eqcs ADD COLUMN IF NOT EXISTS inspector_name text DEFAULT '';
      ALTER TABLE public.eqcs ADD COLUMN IF NOT EXISTS inspector_team text DEFAULT '';
    `);
    publicSchemaInitialized = true;
  } catch (err) {
    console.error('Error ensuring public schema tables:', err);
  }
}

/**
 * Get a client set to the public schema.
 */
export async function getSchemaClient(_orgId?: string | null) {
  await ensurePublicSchemaTables();
  const client = await pool.connect();
  await client.query(`SET search_path TO public`);
  return client;
}

/**
 * Execute a raw query on the pool (public schema).
 */
export async function query(text: string, params?: any[]) {
  await ensurePublicSchemaTables();
  return pool.query(text, params);
}

/**
 * Execute a query directly on the public schema.
 * Supports calling as orgQuery(orgId, text, params) or orgQuery(text, params).
 */
export async function orgQuery(
  orgIdOrText?: string | null,
  textOrParams?: string | any[],
  optionalParams?: any[]
) {
  await ensurePublicSchemaTables();

  let queryText: string;
  let params: any[] | undefined;

  if (typeof textOrParams === 'string') {
    // Called as orgQuery(orgId, text, params)
    queryText = textOrParams;
    params = optionalParams;
  } else {
    // Called as orgQuery(text, params)
    queryText = orgIdOrText || '';
    params = textOrParams as any[] | undefined;
  }

  return pool.query(queryText, params);
}

export default pool;
