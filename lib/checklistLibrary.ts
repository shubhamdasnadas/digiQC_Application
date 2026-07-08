import { query } from '@/lib/db';
import type { Checklist, ChecklistStage, Checkpoint } from '@/lib/types';

export async function listLibraryChecklists(): Promise<(Checklist & { source: 'library' })[]> {
  const { rows } = await query(`
    SELECT id, name, reference_number, created_at
    FROM public.library_checklists
    ORDER BY name
  `);

  return rows.map(row => ({
    id: row.id,
    project_id: null,
    name: row.name,
    reference_number: row.reference_number,
    uom: undefined,
    status: 'active' as const,
    updated_by: undefined,
    updated_at: undefined,
    created_at: row.created_at,
    project: undefined,
    source: 'library' as const,
  }));
}

export async function createLibraryChecklist(name: string, referenceNumber: string): Promise<Checklist & { source: 'library' }> {
  const { rows } = await query(
    `INSERT INTO public.library_checklists (name, reference_number)
     VALUES ($1, $2)
     RETURNING id, name, reference_number, created_at`,
    [name, referenceNumber]
  );
  const row = rows[0];
  return {
    id: row.id,
    project_id: null,
    name: row.name,
    reference_number: row.reference_number,
    status: 'active',
    created_at: row.created_at,
    source: 'library',
  };
}

export async function getLibraryChecklistDetail(id: string): Promise<{
  checklist: Checklist & { source: 'library' };
  stages: ChecklistStage[];
  checkpoints: Checkpoint[];
} | null> {
  const { rows: checklistRows } = await query(
    `SELECT id, name, reference_number, created_at FROM public.library_checklists WHERE id = $1`,
    [id]
  );
  if (checklistRows.length === 0) return null;
  const checklist = checklistRows[0];

  const { rows: stages } = await query(
    `SELECT id, library_checklist_id AS checklist_id, sr_no, name, created_at
     FROM public.library_stages WHERE library_checklist_id = $1 ORDER BY sr_no ASC`,
    [id]
  );

  const { rows: checkpoints } = await query(
    `SELECT lcp.id, lcp.library_stage_id AS stage_id, lcp.sr_no, lcp.question,
            lcp.input_type, lcp.drawing_required, lcp.witness_required, lcp.created_at
     FROM public.library_checkpoints lcp
     JOIN public.library_stages ls ON lcp.library_stage_id = ls.id
     WHERE ls.library_checklist_id = $1 ORDER BY lcp.sr_no ASC`,
    [id]
  );

  return {
    checklist: {
      id: checklist.id,
      project_id: null,
      name: checklist.name,
      reference_number: checklist.reference_number,
      created_at: checklist.created_at,
      source: 'library',
    },
    stages,
    checkpoints,
  };
}
