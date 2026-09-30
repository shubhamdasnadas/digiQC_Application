import { query } from '@/lib/db';
import type { Checklist, ChecklistStage, Checkpoint } from '@/lib/types';

export async function listLibraryChecklists(): Promise<(Checklist & { source: 'library' })[]> {
  const { rows } = await query(`
    SELECT id, project_id, name, reference_number, uom, status, created_at
    FROM public.library_checklists
    WHERE project_id IS NULL
    ORDER BY name ASC
  `).catch(() => ({ rows: [] }));

  return rows.map((r: any) => ({
    id: r.id,
    project_id: null,
    name: r.name,
    reference_number: r.reference_number,
    uom: r.uom,
    status: r.status || 'draft',
    created_at: r.created_at,
    source: 'library' as const,
  }));
}

export async function createLibraryChecklist(name: string, referenceNumber: string): Promise<Checklist & { source: 'library' }> {
  const { rows } = await query(
    `INSERT INTO public.library_checklists (name, reference_number, status)
     VALUES ($1, $2, 'draft')
     RETURNING id, name, reference_number, uom, status, created_at`,
    [name, referenceNumber]
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
     WHERE id = $1`,
    [id]
  ).catch(() => ({ rows: [] }));

  if (checklistRows.length === 0) return null;
  const checklist = checklistRows[0];

  const { rows: stages } = await query(
    `SELECT id, library_checklist_id AS checklist_id, sr_no, name, witness_required, drawing_required, created_at
     FROM public.library_stages
     WHERE library_checklist_id = $1
     ORDER BY sr_no ASC`,
    [id]
  ).catch(() => ({ rows: [] }));

  const { rows: checkpoints } = await query(
    `SELECT lcp.id, lcp.library_stage_id AS stage_id, lcp.sr_no, lcp.question,
            lcp.input_type, lcp.drawing_required, lcp.witness_required, lcp.photo_required, lcp.remark_required, lcp.created_at
     FROM public.library_checkpoints lcp
     JOIN public.library_stages ls ON lcp.library_stage_id = ls.id
     WHERE ls.library_checklist_id = $1
     ORDER BY lcp.sr_no ASC`,
    [id]
  ).catch(() => ({ rows: [] }));

  return {
    checklist: {
      id: checklist.id,
      project_id: checklist.project_id,
      name: checklist.name,
      reference_number: checklist.reference_number,
      uom: checklist.uom,
      status: checklist.status || 'draft',
      created_at: checklist.created_at,
      source: 'library',
    },
    stages,
    checkpoints,
  };
}
