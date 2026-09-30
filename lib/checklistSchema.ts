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
