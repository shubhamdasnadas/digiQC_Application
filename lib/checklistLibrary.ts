import { query } from '@/lib/db';
import type { Checklist, ChecklistStage, Checkpoint } from '@/lib/types';

export async function listLibraryChecklists(): Promise<(Checklist & { source: 'library' })[]> {
  // 1. Fetch from library_checklists
  const { rows: libRows } = await query(`
    SELECT id, name, reference_number, created_at
    FROM public.library_checklists
    ORDER BY name
  `).catch(() => ({ rows: [] }));

  // 2. Fetch master checklists (project_id IS NULL) or all template checklists from public.checklists
  const { rows: clRows } = await query(`
    SELECT id, name, reference_number, uom, status, created_at
    FROM public.checklists
    ORDER BY created_at DESC
  `).catch(() => ({ rows: [] }));

  const map = new Map<string, any>();

  // Add library checklists first
  for (const row of libRows) {
    map.set(row.name.toLowerCase().trim(), {
      id: row.id,
      project_id: null,
      name: row.name,
      reference_number: row.reference_number,
      uom: undefined,
      status: 'draft' as const,
      created_at: row.created_at,
      source: 'library' as const,
    });
  }

  // Add any checklists from public.checklists table that aren't duplicates
  for (const row of clRows) {
    const key = row.name.toLowerCase().trim();
    if (!map.has(key)) {
      map.set(key, {
        id: row.id,
        project_id: null,
        name: row.name,
        reference_number: row.reference_number,
        uom: row.uom,
        status: row.status || 'draft',
        created_at: row.created_at,
        source: 'library' as const,
      });
    }
  }

  return Array.from(map.values());
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
    status: 'draft',
    created_at: row.created_at,
    source: 'library',
  };
}

export async function getLibraryChecklistDetail(id: string): Promise<{
  checklist: Checklist & { source?: 'library' };
  stages: ChecklistStage[];
  checkpoints: Checkpoint[];
} | null> {
  // 1. Try library_checklists
  const { rows: checklistRows } = await query(
    `SELECT id, name, reference_number, created_at FROM public.library_checklists WHERE id = $1`,
    [id]
  ).catch(() => ({ rows: [] }));

  if (checklistRows.length > 0) {
    const checklist = checklistRows[0];
    const { rows: stages } = await query(
      `SELECT id, library_checklist_id AS checklist_id, sr_no, name, witness_required, drawing_required, created_at
       FROM public.library_stages WHERE library_checklist_id = $1 ORDER BY sr_no ASC`,
      [id]
    ).catch(() => ({ rows: [] }));

    const { rows: checkpoints } = await query(
      `SELECT lcp.id, lcp.library_stage_id AS stage_id, lcp.sr_no, lcp.question,
              lcp.input_type, lcp.drawing_required, lcp.witness_required, lcp.photo_required, lcp.remark_required, lcp.created_at
       FROM public.library_checkpoints lcp
       JOIN public.library_stages ls ON lcp.library_stage_id = ls.id
       WHERE ls.library_checklist_id = $1 ORDER BY lcp.sr_no ASC`,
      [id]
    ).catch(() => ({ rows: [] }));

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

  // 2. Try public.checklists
  const { rows: clRows } = await query(
    `SELECT id, name, reference_number, uom, status, created_at FROM public.checklists WHERE id = $1`,
    [id]
  ).catch(() => ({ rows: [] }));

  if (clRows.length === 0) return null;
  const cl = clRows[0];

  const { rows: stages } = await query(
    `SELECT id, checklist_id, sr_no, name, witness_required, drawing_required, created_at
     FROM public.checklist_stages WHERE checklist_id = $1 ORDER BY sr_no ASC`,
    [id]
  ).catch(() => ({ rows: [] }));

  const { rows: checkpoints } = await query(
    `SELECT cp.id, cp.stage_id, cp.sr_no, cp.question, cp.input_type, cp.drawing_required, cp.witness_required, cp.photo_required, cp.remark_required, cp.created_at
     FROM public.checkpoints cp
     JOIN public.checklist_stages cs ON cp.stage_id = cs.id
     WHERE cs.checklist_id = $1 ORDER BY cp.sr_no ASC`,
    [id]
  ).catch(() => ({ rows: [] }));

  return {
    checklist: {
      id: cl.id,
      project_id: null,
      name: cl.name,
      reference_number: cl.reference_number,
      uom: cl.uom,
      status: cl.status,
      created_at: cl.created_at,
    },
    stages,
    checkpoints,
  };
}
