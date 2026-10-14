import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { orgQuery } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
    const { payload, response } = requireAuth(request);
    if (!payload) return response;

    try {
        const filePath = path.join(process.cwd(), 'db', 'migration_checklists_v3.sql');
        const sql = fs.readFileSync(filePath, 'utf8');

        // Split SQL by semicolon to execute multiple statements
        const statements = sql.split(';').filter(s => s.trim());

        for (const statement of statements) {
            await orgQuery(payload.orgId!, statement);
        }

        // Fix for teams table columns if they are missing
        try {
            await orgQuery(payload.orgId!, `
                ALTER TABLE teams
                ADD COLUMN IF NOT EXISTS active_projects text DEFAULT '',
                ADD COLUMN IF NOT EXISTS inactive_projects text DEFAULT '';
            `);
        } catch (e) {
            console.error('Teams migration error:', e);
        }

        // Fix for issues table columns
        try {
            await orgQuery(payload.orgId!, `
                CREATE TABLE IF NOT EXISTS public.issues (
                    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                    project_id uuid NOT NULL,
                    title text DEFAULT '',
                    description text DEFAULT '',
                    location text DEFAULT '',
                    issue_type text DEFAULT 'Quality',
                    severity text NOT NULL DEFAULT 'medium',
                    status text NOT NULL DEFAULT 'open',
                    assignee_id uuid,
                    assignee_name text DEFAULT '',
                    assigned_team text DEFAULT '',
                    reported_by uuid,
                    reported_by_name text DEFAULT '',
                    reported_by_team text DEFAULT '',
                    image_url text DEFAULT '',
                    tags text DEFAULT '',
                    responded_by text DEFAULT '',
                    due_date timestamptz,
                    created_at timestamptz DEFAULT now(),
                    updated_at timestamptz DEFAULT now()
                );
                ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS project_id uuid;
                ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS title text DEFAULT '';
                ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS description text DEFAULT '';
                ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS location text DEFAULT '';
                ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS issue_type text DEFAULT 'Quality';
                ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS severity text DEFAULT 'medium';
                ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS status text DEFAULT 'open';
                ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS assignee_id uuid;
                ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS assignee_name text DEFAULT '';
                ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS assigned_team text DEFAULT '';
                ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS assigned_team_phone text DEFAULT '';
                ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS reported_by uuid;
                ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS reported_by_name text DEFAULT '';
                ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS reported_by_team text DEFAULT '';
                ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS image_url text DEFAULT '';
                ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS photos jsonb DEFAULT '[]'::jsonb;
                ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS tags text DEFAULT '';
                ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS responded_by text DEFAULT '';
                ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS responded_by_name text DEFAULT '';
                ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS responded_by_team text DEFAULT '';
                ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS responded_at timestamptz;
                ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS response_description text DEFAULT '';
                ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS response_photos jsonb DEFAULT '[]'::jsonb;
                ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS responses jsonb DEFAULT '[]'::jsonb;
                ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS closed_by uuid;
                ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS closed_by_name text DEFAULT '';
                ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS closed_by_team text DEFAULT '';
                ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS closed_at timestamptz;
                ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS closed_description text DEFAULT '';
                ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS closed_photos jsonb DEFAULT '[]'::jsonb;
                ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS geo_tag text DEFAULT '';
                ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS rejections text DEFAULT 'R0';
                ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS last_action_by text DEFAULT '';
                ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS last_action_date timestamptz DEFAULT now();
                ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS due_date timestamptz;
                ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
                ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

                DO $$
                DECLARE
                  r RECORD;
                BEGIN
                  IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'issues' AND column_name = 'project'
                  ) THEN
                    BEGIN
                      EXECUTE 'ALTER TABLE public.issues ALTER COLUMN "project" DROP NOT NULL';
                      EXECUTE 'ALTER TABLE public.issues ALTER COLUMN "project" SET DEFAULT NULL';
                    EXCEPTION WHEN OTHERS THEN NULL;
                    END;
                  END IF;

                  IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'issues' AND column_name = 'title'
                  ) THEN
                    BEGIN
                      EXECUTE 'ALTER TABLE public.issues ALTER COLUMN "title" DROP NOT NULL';
                      EXECUTE 'ALTER TABLE public.issues ALTER COLUMN "title" SET DEFAULT ''''';
                    EXCEPTION WHEN OTHERS THEN NULL;
                    END;
                  END IF;

                  FOR r IN (
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = 'issues'
                      AND is_nullable = 'NO'
                      AND column_name NOT IN ('id')
                  ) LOOP
                    BEGIN
                      EXECUTE 'ALTER TABLE public.issues ALTER COLUMN "' || r.column_name || '" DROP NOT NULL';
                    EXCEPTION WHEN OTHERS THEN NULL;
                    END;
                  END LOOP;

                  IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'issues' AND column_name = 'project'
                  ) AND EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'issues' AND column_name = 'project_id'
                  ) THEN
                    BEGIN
                      UPDATE public.issues SET project_id = project::uuid WHERE project_id IS NULL AND project IS NOT NULL;
                    EXCEPTION WHEN OTHERS THEN NULL;
                    END;
                  END IF;
                END $$;
            `);
        } catch (e) {
            console.error('Issues migration error:', e);
        }

        return NextResponse.json({ success: true, message: 'Migration applied successfully' });
    } catch (error) {
        console.error('Migration error:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}