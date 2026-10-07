import { query } from '@/lib/db';

export async function ensureMemberSchema() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS public.members (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid,
        name text NOT NULL,
        email text DEFAULT '',
        phone text DEFAULT '',
        access_type text DEFAULT 'Paid',
        active boolean DEFAULT true,
        status text DEFAULT 'pending',
        default_role text DEFAULT 'User',
        teams text DEFAULT '',
        active_projects text DEFAULT '',
        inactive_projects text DEFAULT '',
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );

      ALTER TABLE public.members ADD COLUMN IF NOT EXISTS organization_id uuid;
      ALTER TABLE public.members ADD COLUMN IF NOT EXISTS name text;
      ALTER TABLE public.members ADD COLUMN IF NOT EXISTS email text DEFAULT '';
      ALTER TABLE public.members ADD COLUMN IF NOT EXISTS phone text DEFAULT '';
      ALTER TABLE public.members ADD COLUMN IF NOT EXISTS access_type text DEFAULT 'Paid';
      ALTER TABLE public.members ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;
      ALTER TABLE public.members ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';
      ALTER TABLE public.members ADD COLUMN IF NOT EXISTS default_role text DEFAULT 'User';
      ALTER TABLE public.members ADD COLUMN IF NOT EXISTS teams text DEFAULT '';
      ALTER TABLE public.members ADD COLUMN IF NOT EXISTS active_projects text DEFAULT '';
      ALTER TABLE public.members ADD COLUMN IF NOT EXISTS inactive_projects text DEFAULT '';
      ALTER TABLE public.members ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
      ALTER TABLE public.members ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

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

      ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS organization_id uuid;
      ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS name text;
      ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS type text DEFAULT 'inspection';
      ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS team_lead_name text DEFAULT '';
      ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS spoc_name text DEFAULT '';
      ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS active_projects text DEFAULT '';
      ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS inactive_projects text DEFAULT '';
      ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
      ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
    `);
  } catch (error) {
    console.error('Schema ensureMemberSchema error:', error);
  }
}
