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
        created_at timestamptz DEFAULT now()
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
        created_at timestamptz DEFAULT now()
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

      -- Checklists in public schema
      CREATE TABLE IF NOT EXISTS public.checklists (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id uuid NOT NULL,
        name text NOT NULL,
        reference_number text,
        uom text,
        status text DEFAULT 'draft',
        created_at timestamptz DEFAULT now()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS checklists_project_ref_idx ON public.checklists (project_id, reference_number) WHERE reference_number IS NOT NULL;

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

      -- Super Admins in public schema
      CREATE TABLE IF NOT EXISTS public.super_admins (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid,
        name text NOT NULL,
        email text NOT NULL,
        mobile_no text DEFAULT '',
        roles text[] DEFAULT ARRAY['admin'],
        created_at timestamptz DEFAULT now()
      );

      -- Project Members in public schema
      CREATE TABLE IF NOT EXISTS public.project_members (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id uuid NOT NULL,
        user_id uuid NOT NULL,
        role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member','inspector','approver','viewer')),
        added_at timestamptz DEFAULT now(),
        UNIQUE(project_id, user_id)
      );

      -- Project Teams in public schema
      CREATE TABLE IF NOT EXISTS public.project_teams (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id uuid NOT NULL,
        team_id uuid NOT NULL,
        assigned_checklist text DEFAULT '',
        assigned_user text DEFAULT '',
        added_at timestamptz DEFAULT now(),
        UNIQUE(project_id, team_id)
      );

      -- EQCs in public schema
      CREATE TABLE IF NOT EXISTS public.eqcs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id uuid NOT NULL,
        location text NOT NULL DEFAULT '',
        checklist_id uuid,
        stage_index integer NOT NULL DEFAULT 1,
        total_stages integer NOT NULL DEFAULT 1,
        stage_result text DEFAULT 'pending' CHECK (stage_result IN ('pass','fail','pending')),
        approver_id uuid,
        approver_log text DEFAULT '',
        status text NOT NULL DEFAULT 'pending' CHECK (status IN ('passed','failed','pending','rfi')),
        inspected_by uuid,
        inspected_at timestamptz,
        rfi_id uuid,
        notes text DEFAULT '',
        assigned_user_ids uuid[] NOT NULL DEFAULT '{}',
        assigned_team_ids uuid[] NOT NULL DEFAULT '{}',
        created_at timestamptz DEFAULT now()
      );

      -- Issues in public schema
      CREATE TABLE IF NOT EXISTS public.issues (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id uuid NOT NULL,
        title text NOT NULL,
        description text DEFAULT '',
        severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
        status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed')),
        assignee_id uuid,
        reported_by uuid,
        due_date date,
        created_at timestamptz DEFAULT now()
      );

      -- Register entries in public schema
      CREATE TABLE IF NOT EXISTS public.register_entries (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id uuid NOT NULL,
        document_no text DEFAULT '',
        title text NOT NULL,
        revision text DEFAULT 'R0',
        status text DEFAULT 'active' CHECK (status IN ('active','superseded','void')),
        file_url text DEFAULT '',
        created_at timestamptz DEFAULT now()
      );

      -- Project targets in public schema
      CREATE TABLE IF NOT EXISTS public.project_targets (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id uuid NOT NULL,
        metric text NOT NULL,
        target_value numeric DEFAULT 0,
        current_value numeric DEFAULT 0,
        unit text DEFAULT '',
        period text DEFAULT 'monthly' CHECK (period IN ('daily','weekly','monthly','quarterly','project')),
        created_at timestamptz DEFAULT now()
      );

      -- Nomenclature in public schema
      CREATE TABLE IF NOT EXISTS public.project_nomenclature (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id uuid NOT NULL,
        prefix text NOT NULL,
        description text DEFAULT '',
        example text DEFAULT '',
        created_at timestamptz DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS public.nomenclature (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id uuid NOT NULL,
        parent_id uuid REFERENCES public.nomenclature(id) ON DELETE CASCADE,
        sr_no integer NOT NULL DEFAULT 1,
        name text NOT NULL,
        description text DEFAULT '',
        status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
        created_at timestamptz DEFAULT now()
      );

      -- Shared Library Checklists in public schema
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

      -- Ensure columns exist in case tables were previously created with older schema
      ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS organization_id uuid;
      ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS name text;
      ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS type text DEFAULT 'DEFAULT';
      ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS team_lead_name text DEFAULT '';
      ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS spoc_name text DEFAULT '';
      ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS active_projects text DEFAULT '';
      ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS inactive_projects text DEFAULT '';
      ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

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
