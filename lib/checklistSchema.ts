import { query } from '@/lib/db';

export async function ensureChecklistSchema(_orgId?: string) {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS public.library_checklists (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id uuid,
        name text NOT NULL,
        reference_number text,
        uom text DEFAULT '',
        status text DEFAULT 'draft',
        updated_by text,
        updated_at timestamptz DEFAULT now(),
        created_at timestamptz DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS public.library_stages (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        library_checklist_id uuid NOT NULL REFERENCES public.library_checklists(id) ON DELETE CASCADE,
        sr_no integer NOT NULL DEFAULT 1,
        "index" integer NOT NULL DEFAULT 1,
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

      ALTER TABLE public.library_checklists ADD COLUMN IF NOT EXISTS project_id uuid;
      ALTER TABLE public.library_checklists ADD COLUMN IF NOT EXISTS reference_number text;
      ALTER TABLE public.library_checklists ADD COLUMN IF NOT EXISTS uom text DEFAULT '';
      ALTER TABLE public.library_checklists ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft';
      ALTER TABLE public.library_checklists ADD COLUMN IF NOT EXISTS updated_by text;
      ALTER TABLE public.library_checklists ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
      ALTER TABLE public.library_checklists ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
      DO $$
      BEGIN
        BEGIN
          ALTER TABLE public.library_checklists ALTER COLUMN updated_by TYPE text USING updated_by::text;
        EXCEPTION
          WHEN others THEN NULL;
        END;
      END $$;

      ALTER TABLE public.library_stages ADD COLUMN IF NOT EXISTS witness_required boolean DEFAULT false;
      ALTER TABLE public.library_stages ADD COLUMN IF NOT EXISTS drawing_required boolean DEFAULT false;
      ALTER TABLE public.library_stages ADD COLUMN IF NOT EXISTS sr_no integer DEFAULT 1;
      ALTER TABLE public.library_stages ADD COLUMN IF NOT EXISTS "index" integer DEFAULT 1;

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

      -- Project-owned checklists. library_checklists / library_stages /
      -- library_checkpoints hold only the shared canonical library
      -- (project_id IS NULL); every checklist that belongs to a project lives in
      -- these three tables instead. The column sets mirror library_* so the API
      -- can return the same JSON from either source.
      CREATE TABLE IF NOT EXISTS public.project_checklist (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id uuid NOT NULL,
        name text NOT NULL,
        reference_number text DEFAULT '',
        uom text DEFAULT '',
        status text NOT NULL DEFAULT 'draft',
        updated_by uuid,
        updated_at timestamptz DEFAULT now(),
        created_at timestamptz DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS public.project_stage (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        project_checklist_id uuid NOT NULL REFERENCES public.project_checklist(id) ON DELETE CASCADE,
        sr_no integer NOT NULL DEFAULT 1,
        "index" integer NOT NULL DEFAULT 1,
        name text NOT NULL,
        witness_required boolean DEFAULT false,
        drawing_required boolean DEFAULT false,
        created_at timestamptz DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS public.project_checkpoints (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        project_stage_id uuid NOT NULL REFERENCES public.project_stage(id) ON DELETE CASCADE,
        sr_no integer NOT NULL DEFAULT 1,
        question text NOT NULL,
        input_type text NOT NULL DEFAULT 'yes_no',
        photo_required boolean DEFAULT false,
        remark_required boolean DEFAULT false,
        created_at timestamptz DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS project_checklist_project_idx
        ON public.project_checklist (project_id);
      CREATE INDEX IF NOT EXISTS project_stage_checklist_idx
        ON public.project_stage (project_checklist_id);
      CREATE INDEX IF NOT EXISTS project_checkpoints_stage_idx
        ON public.project_checkpoints (project_stage_id);

      -- Move every project-scoped row out of the shared library tables and into
      -- the project_* tables, preserving the original UUIDs. eqcs.checklist_id and
      -- the stage_id / checkpoint_id values stored inside eqcs.stages_data and
      -- eqcs.inspection_data (jsonb) reference these ids, so they must not change.
      -- Safe to re-run: once the rows have moved, the WHERE clauses match nothing.
      DO $$
      BEGIN
        INSERT INTO public.project_checklist
          (id, project_id, name, reference_number, uom, status, updated_by, updated_at, created_at)
        SELECT id, project_id, name, COALESCE(reference_number, ''), COALESCE(uom, ''),
               COALESCE(status, 'draft'),
               CASE WHEN updated_by::text ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
                    THEN updated_by::text::uuid ELSE NULL END,
               updated_at, created_at
        FROM public.library_checklists
        WHERE project_id IS NOT NULL
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO public.project_stage
          (id, project_checklist_id, sr_no, "index", name, witness_required, drawing_required, created_at)
        SELECT ls.id, ls.library_checklist_id, ls.sr_no, COALESCE(ls."index", ls.sr_no, 1),
               ls.name, COALESCE(ls.witness_required, false), COALESCE(ls.drawing_required, false),
               ls.created_at
        FROM public.library_stages ls
        WHERE EXISTS (SELECT 1 FROM public.project_checklist pc WHERE pc.id = ls.library_checklist_id)
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO public.project_checkpoints
          (id, project_stage_id, sr_no, question, input_type, photo_required, remark_required, created_at)
        SELECT lcp.id, lcp.library_stage_id, lcp.sr_no, lcp.question,
               COALESCE(lcp.input_type, 'yes_no'), COALESCE(lcp.photo_required, false),
               COALESCE(lcp.remark_required, false), lcp.created_at
        FROM public.library_checkpoints lcp
        WHERE EXISTS (SELECT 1 FROM public.project_stage ps WHERE ps.id = lcp.library_stage_id)
        ON CONFLICT (id) DO NOTHING;

        DELETE FROM public.library_checklists WHERE project_id IS NOT NULL;
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END $$;

      -- Remove legacy tables
      DROP TABLE IF EXISTS public.checkpoints CASCADE;
      DROP TABLE IF EXISTS public.checklist_stages CASCADE;
      DROP TABLE IF EXISTS public.checklists CASCADE;
      DROP TABLE IF EXISTS public.checklist CASCADE;
      DROP TABLE IF EXISTS public.eqc_items CASCADE;
    `);
  } catch (error) {
    console.error('Schema ensureChecklistSchema error:', error);
  }
}
