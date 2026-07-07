import { orgQuery } from '@/lib/db';

export async function ensureProjectSchema(orgId: string) {
  try {
    // 1. Ensure projects table exists
    await orgQuery(orgId, `
      CREATE TABLE IF NOT EXISTS projects (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid NOT NULL,
        name text NOT NULL,
        unique_code text,
        client_name text DEFAULT '',
        description text DEFAULT '',
        project_admin_id uuid,
        radius_m integer DEFAULT 100,
        timezone text DEFAULT 'Asia/Calcutta',
        latitude numeric,
        longitude numeric,
        address text DEFAULT '',
        perm_location boolean DEFAULT false,
        perm_authentication boolean DEFAULT false,
        perm_rfi boolean DEFAULT false,
        nomenclature text DEFAULT '',
        instruction text DEFAULT '',
        profile text DEFAULT '',
        image_url text DEFAULT '',
        status text DEFAULT 'active',
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now(),
        updated_by uuid
      )
    `);

    // 2. Ensure project_members table exists
    await orgQuery(orgId, `
      CREATE TABLE IF NOT EXISTS project_members (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id uuid NOT NULL,
        user_id uuid NOT NULL,
        role text DEFAULT 'member',
        added_at timestamptz DEFAULT now(),
        UNIQUE(project_id, user_id)
      )
    `);
  } catch (error) {
    console.error('Schema ensureProjectSchema error:', error);
  }
}