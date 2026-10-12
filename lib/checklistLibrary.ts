import { query } from '@/lib/db';
import type { Checklist, ChecklistStage, Checkpoint } from '@/lib/types';

/**
 * A checklist id belongs to exactly one of two stores: a project's own
 * checklist (public.project_checklist) or the shared canonical library
 * (public.library_checklists). Both use real UUIDs, so resolving is a matter of
 * trying one table then the other.
 */
export type ChecklistScope = 'project' | 'library';

export interface ResolvedChecklist {
  scope: ChecklistScope;
  id: string;
  project_id: string | null;
  name: string;
  reference_number: string | null;
  uom: string | null;
  status: string;
  created_at: string;
}

/** Table names for each scope, so callers can build queries without branching. */
export const CHECKLIST_TABLES: Record<ChecklistScope, {
  checklist: string;
  stage: string;
  checkpoint: string;
  checklistFk: string;
  stageFk: string;
}> = {
  project: {
    checklist: 'public.project_checklist',
    stage: 'public.project_stage',
    checkpoint: 'public.project_checkpoints',
    checklistFk: 'project_checklist_id',
    stageFk: 'project_stage_id',
  },
  library: {
    checklist: 'public.library_checklists',
    stage: 'public.library_stages',
    checkpoint: 'public.library_checkpoints',
    checklistFk: 'library_checklist_id',
    stageFk: 'library_stage_id',
  },
};

/**
 * Finds which store a checklist id lives in. Returns null when neither table
 * has it. Project rows win: ids are unique across both stores.
 */
export async function resolveChecklistScope(id: string): Promise<ResolvedChecklist | null> {
  const { rows: projectRows } = await query(
    `SELECT id, project_id, name, reference_number, uom, status, created_at
     FROM public.project_checklist WHERE id = $1`,
    [id]
  ).catch(() => ({ rows: [] as any[] }));

  if (projectRows.length > 0) {
    return { ...projectRows[0], scope: 'project' as const };
  }

  const { rows: libraryRows } = await query(
    `SELECT id, project_id, name, reference_number, uom, status, created_at
     FROM public.library_checklists WHERE id = $1`,
    [id]
  ).catch(() => ({ rows: [] as any[] }));

  if (libraryRows.length > 0) {
    return { ...libraryRows[0], scope: 'library' as const };
  }

  return null;
}

/**
 * Loads a checklist's stages and checkpoints from whichever store holds it.
 * Returned fields keep the `checklist_id` / `stage_id` aliases the API and UI
 * already consume, so the response shape is identical for both scopes.
 */
export async function getChecklistChildren(
  scope: ChecklistScope,
  checklistId: string
): Promise<{ stages: ChecklistStage[]; checkpoints: Checkpoint[] }> {
  const t = CHECKLIST_TABLES[scope];

  const { rows: stages } = await query(
    `SELECT id, ${t.checklistFk} AS checklist_id, ${t.checklistFk},
            COALESCE("index", sr_no, 1) AS index,
            COALESCE(sr_no, "index", 1) AS sr_no,
            name, witness_required, drawing_required, created_at
     FROM ${t.stage}
     WHERE ${t.checklistFk} = $1
     ORDER BY COALESCE("index", sr_no, 1) ASC, created_at ASC`,
    [checklistId]
  ).catch(() => ({ rows: [] }));

  const { rows: checkpoints } = await query(
    `SELECT cp.id, cp.${t.stageFk} AS stage_id, cp.${t.stageFk}, cp.sr_no, cp.question,
            cp.input_type, cp.photo_required, cp.remark_required, cp.created_at
     FROM ${t.checkpoint} cp
     JOIN ${t.stage} s ON cp.${t.stageFk} = s.id
     WHERE s.${t.checklistFk} = $1
     ORDER BY cp.sr_no ASC`,
    [checklistId]
  ).catch(() => ({ rows: [] }));

  return { stages, checkpoints };
}

/**
 * The shared canonical library only — never a project's own checklist.
 * project_id is always NULL here; the filter is explicit so a stale
 * project-scoped row can never leak into the library list.
 */
export async function listLibraryChecklists(): Promise<(Checklist & { source: 'library' })[]> {
  const { rows } = await query(`
    SELECT c.id, c.name, c.reference_number, c.uom, c.status,
           c.updated_by, c.updated_at, c.created_at,
           COALESCE((
             SELECT json_agg(
               json_build_object(
                 'id', s.id,
                 'name', s.name,
                 'witness_required', s.witness_required,
                 'drawing_required', s.drawing_required,
                 'checkpoints', COALESCE((
                   SELECT json_agg(
                     json_build_object(
                       'id', cp.id,
                       'question', cp.question,
                       'input_type', cp.input_type,
                       'photo_required', cp.photo_required,
                       'remark_required', cp.remark_required
                     ) ORDER BY cp.sr_no ASC
                   )
                   FROM public.library_checkpoints cp
                   WHERE cp.library_stage_id = s.id
                 ), '[]'::json)
               ) ORDER BY COALESCE(s."index", s.sr_no, 1), s.created_at
             )
             FROM public.library_stages s
             WHERE s.library_checklist_id = c.id
           ), '[]'::json) AS stages
    FROM public.library_checklists c
    WHERE c.project_id IS NULL
    ORDER BY c.name ASC
  `);

  return rows.map((row) => ({
    id: row.id,
    project_id: null,
    name: row.name,
    reference_number: row.reference_number,
    uom: row.uom,
    status: row.status || 'draft',
    updated_by: row.updated_by || undefined,
    updated_at: row.updated_at || undefined,
    created_at: row.created_at,
    stages: row.stages || [],
    source: 'library' as const,
  }));
}

export async function createLibraryChecklist(
  name: string,
  referenceNumber?: string,
  uom?: string
): Promise<Checklist & { source: 'library' }> {
  const { rows } = await query(
    `INSERT INTO public.library_checklists (project_id, name, reference_number, uom, status)
     VALUES (NULL, $1, $2, $3, 'draft')
     RETURNING id, name, reference_number, uom, status, created_at`,
    [name, referenceNumber || '', uom || '']
  );
  const row = rows[0];
  return {
    id: row.id,
    project_id: null,
    name: row.name,
    reference_number: row.reference_number,
    uom: row.uom,
    status: row.status || 'draft',
    created_at: row.created_at,
    source: 'library',
  };
}

export async function getLibraryChecklistDetail(id: string): Promise<{
  checklist: Checklist & { source?: 'library' };
  stages: ChecklistStage[];
  checkpoints: Checkpoint[];
} | null> {
  const { rows: checklistRows } = await query(
    `SELECT id, project_id, name, reference_number, uom, status, created_at
     FROM public.library_checklists
     WHERE id = $1 AND project_id IS NULL`,
    [id]
  ).catch(() => ({ rows: [] }));

  if (checklistRows.length === 0) return null;
  const checklist = checklistRows[0];

  return {
    checklist: {
      id: checklist.id,
      project_id: null,
      name: checklist.name,
      reference_number: checklist.reference_number,
      uom: checklist.uom,
      status: checklist.status || 'draft',
      created_at: checklist.created_at,
      source: 'library',
    },
    ...(await getChecklistChildren('library', checklist.id)),
  };
}
