import { orgQuery } from '@/lib/db';

export async function ensureChecklistSchema(_orgId?: string) {
  try {
    // 1. Ensure columns exist in checklists
    await orgQuery(`ALTER TABLE public.checklists ALTER COLUMN project_id DROP NOT NULL`).catch(() => {});
    await orgQuery(`ALTER TABLE public.checklists ADD COLUMN IF NOT EXISTS reference_number TEXT`).catch(() => {});
    await orgQuery(`ALTER TABLE public.checklists ADD COLUMN IF NOT EXISTS uom TEXT`).catch(() => {});
    await orgQuery(`ALTER TABLE public.checklists ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft'`).catch(() => {});
    await orgQuery(`ALTER TABLE public.checklists ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`).catch(() => {});
    await orgQuery(`ALTER TABLE public.checklists ADD COLUMN IF NOT EXISTS updated_by UUID`).catch(() => {});

    // 2. Ensure columns and constraints in checklist_stages
    await orgQuery(`ALTER TABLE public.checklist_stages ADD COLUMN IF NOT EXISTS sr_no INTEGER DEFAULT 1`).catch(() => {});
    await orgQuery(`ALTER TABLE public.checklist_stages ADD COLUMN IF NOT EXISTS witness_required BOOLEAN DEFAULT false`).catch(() => {});
    await orgQuery(`ALTER TABLE public.checklist_stages ADD COLUMN IF NOT EXISTS drawing_required BOOLEAN DEFAULT false`).catch(() => {});

    // 3. Ensure columns in checkpoints
    await orgQuery(`ALTER TABLE public.checkpoints ADD COLUMN IF NOT EXISTS sr_no INTEGER DEFAULT 0`).catch(() => {});
    await orgQuery(`ALTER TABLE public.checkpoints ADD COLUMN IF NOT EXISTS input_type TEXT DEFAULT 'yes_no'`).catch(() => {});
    await orgQuery(`ALTER TABLE public.checkpoints ADD COLUMN IF NOT EXISTS photo_required BOOLEAN DEFAULT false`).catch(() => {});
    await orgQuery(`ALTER TABLE public.checkpoints ADD COLUMN IF NOT EXISTS remark_required BOOLEAN DEFAULT false`).catch(() => {});
    await orgQuery(`ALTER TABLE public.checkpoints ADD COLUMN IF NOT EXISTS drawing_required BOOLEAN DEFAULT false`).catch(() => {});
    await orgQuery(`ALTER TABLE public.checkpoints ADD COLUMN IF NOT EXISTS witness_required BOOLEAN DEFAULT false`).catch(() => {});

    // 4. Ensure foreign keys with ON DELETE CASCADE if not present
    await orgQuery(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'checklist_stages_checklist_id_fkey'
        ) THEN
          ALTER TABLE public.checklist_stages
          ADD CONSTRAINT checklist_stages_checklist_id_fkey
          FOREIGN KEY (checklist_id) REFERENCES public.checklists(id) ON DELETE CASCADE;
        END IF;
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;
    `).catch(() => {});

    await orgQuery(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'checkpoints_stage_id_fkey'
        ) THEN
          ALTER TABLE public.checkpoints
          ADD CONSTRAINT checkpoints_stage_id_fkey
          FOREIGN KEY (stage_id) REFERENCES public.checklist_stages(id) ON DELETE CASCADE;
        END IF;
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;
    `).catch(() => {});

    // 5. Sync/Migrate any library_checklists into checklists table
    await orgQuery(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'library_checklists') THEN
          INSERT INTO public.checklists (id, project_id, name, reference_number, status, created_at)
          SELECT lc.id, NULL, lc.name, lc.reference_number, 'draft', lc.created_at
          FROM public.library_checklists lc
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            reference_number = COALESCE(EXCLUDED.reference_number, public.checklists.reference_number);

          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'library_stages') THEN
            INSERT INTO public.checklist_stages (id, checklist_id, sr_no, name, created_at)
            SELECT ls.id, ls.library_checklist_id, COALESCE(ls.sr_no, 1), ls.name, ls.created_at
            FROM public.library_stages ls
            WHERE EXISTS (SELECT 1 FROM public.checklists c WHERE c.id = ls.library_checklist_id)
            ON CONFLICT (id) DO NOTHING;

            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'library_checkpoints') THEN
              INSERT INTO public.checkpoints (id, stage_id, sr_no, question, input_type, drawing_required, witness_required, photo_required, remark_required, created_at)
              SELECT lcp.id, lcp.library_stage_id, COALESCE(lcp.sr_no, 0), lcp.question, COALESCE(lcp.input_type, 'yes_no'), COALESCE(lcp.drawing_required, false), COALESCE(lcp.witness_required, false), false, false, lcp.created_at
              FROM public.library_checkpoints lcp
              WHERE EXISTS (SELECT 1 FROM public.checklist_stages cs WHERE cs.id = lcp.library_stage_id)
              ON CONFLICT (id) DO NOTHING;
            END IF;
          END IF;
        END IF;
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;
    `).catch(() => {});

  } catch (error) {
    console.error('Schema ensureChecklistSchema error:', error);
  }
}
