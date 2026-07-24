import { Router, Request, Response } from 'express';
import { pool, orgSchema } from '../pool';
import { getUserFromHeader } from './auth';

const router = Router();

async function countsFor(schema: string, checklistId: string) {
  const { rows } = await pool.query(
    `SELECT count(DISTINCT cs.id)::int AS stages_count, count(cp.id)::int AS checkpoints_count
     FROM "${schema}".checklist_stages cs
     LEFT JOIN "${schema}".checkpoints cp ON cp.stage_id = cs.id
     WHERE cs.checklist_id = $1`,
    [checklistId]
  );
  return rows[0] || { stages_count: 0, checkpoints_count: 0 };
}

// GET /api/checklists - list checklists (org-scoped + shared library)
router.get('/', async (req: Request, res: Response) => {
  const auth = await getUserFromHeader(req);
  if (!auth.currentOrg) return res.json([]);

  const schema = await orgSchema(auth.currentOrg.id);

  const { rows: orgChecklists } = await pool.query(
    `SELECT c.*, p.name AS project_name
     FROM "${schema}".checklists c
     JOIN "${schema}".projects p ON p.id = c.project_id
     ORDER BY c.created_at DESC`
  );

  const orgEnriched = await Promise.all(
    orgChecklists.map(async (c: any) => ({
      ...c,
      ...(await countsFor(schema, c.id)),
      organization_id: auth.currentOrg!.id,
      source: 'org',
    }))
  );

  const { rows: libraryChecklists } = await pool.query(
    `SELECT lc.*,
            (SELECT count(*)::int FROM public.library_stages ls WHERE ls.library_checklist_id = lc.id) AS stages_count,
            (SELECT count(*)::int FROM public.library_checkpoints lcp
               JOIN public.library_stages ls ON ls.id = lcp.library_stage_id
               WHERE ls.library_checklist_id = lc.id) AS checkpoints_count
     FROM public.library_checklists lc
     ORDER BY lc.created_at DESC`
  );

  const libraryEnriched = libraryChecklists.map((c: any) => ({
    ...c,
    organization_id: auth.currentOrg!.id,
    project_id: null,
    project_name: 'Org Generic Library',
    uom: c.uom || '',
    status: 'active',
    source: 'library',
  }));

  return res.json([...orgEnriched, ...libraryEnriched]);
});

// POST /api/checklists - create new checklist (project-scoped)
router.post('/', async (req: Request, res: Response) => {
  const auth = await getUserFromHeader(req);
  if (!auth.currentOrg) return res.status(400).json({ error: 'No active organization' });

  const schema = await orgSchema(auth.currentOrg.id);

  const items = Array.isArray(req.body) ? req.body : [req.body];
  const created = [];

  for (const item of items) {
    const { name, checklist_name, project_id, reference_number, uom = '' } = item;
    const finalName = name || checklist_name;

    if (!finalName || !project_id) {
      return res.status(400).json({ error: 'Checklist Name and Project are required' });
    }

    const { rows } = await pool.query(
      `INSERT INTO "${schema}".checklists (project_id, name, reference_number, uom, status)
       VALUES ($1, $2, $3, $4, 'draft')
       RETURNING *`,
      [project_id, finalName, reference_number || null, uom]
    );
    const newChecklist = rows[0];

    if (!Array.isArray(req.body)) {
      // Default stage for interactively-created checklists (not bulk imports)
      await pool.query(
        `INSERT INTO "${schema}".checklist_stages (checklist_id, sr_no, name, witness_required, drawing_required)
         VALUES ($1, 1, 'Stage 1 - Initial Inspection', true, true)`,
        [newChecklist.id]
      );
    }

    created.push(newChecklist);
  }

  if (Array.isArray(req.body)) {
    return res.status(201).json({ success: true, count: created.length, checklists: created });
  }
  return res.status(201).json(created[0]);
});

// GET /api/checklists/:id - get checklist with stages and checkpoints
router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const auth = await getUserFromHeader(req);
  if (!auth.currentOrg) return res.status(400).json({ error: 'No active organization' });

  const schema = await orgSchema(auth.currentOrg.id);

  const { rows: checklistRows } = await pool.query(`SELECT * FROM "${schema}".checklists WHERE id = $1`, [id]);
  const checklist = checklistRows[0];

  if (!checklist) {
    return res.status(404).json({ error: 'Checklist template not found' });
  }

  const { rows: stages } = await pool.query(
    `SELECT * FROM "${schema}".checklist_stages WHERE checklist_id = $1 ORDER BY sr_no`,
    [id]
  );
  const { rows: checkpoints } = await pool.query(
    `SELECT cp.* FROM "${schema}".checkpoints cp
     JOIN "${schema}".checklist_stages cs ON cs.id = cp.stage_id
     WHERE cs.checklist_id = $1
     ORDER BY cp.sr_no`,
    [id]
  );

  const stagesWithCheckpoints = stages.map((s: any) => ({
    ...s,
    checkpoints: checkpoints.filter((cp: any) => cp.stage_id === s.id),
  }));

  return res.json({ checklist, stages: stagesWithCheckpoints });
});

// PATCH /api/checklists/:id - add stage or checkpoint, or reorder
router.patch('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const auth = await getUserFromHeader(req);
  if (!auth.currentOrg) return res.status(400).json({ error: 'No active organization' });

  const schema = await orgSchema(auth.currentOrg.id);

  const { rows: checklistRows } = await pool.query(`SELECT * FROM "${schema}".checklists WHERE id = $1`, [id]);
  const checklist = checklistRows[0];
  if (!checklist) {
    return res.status(404).json({ error: 'Checklist not found' });
  }

  const { add_stage, edit_stage, delete_stage, add_checkpoint, edit_checkpoint, delete_checkpoint } = req.body;

  if (add_stage) {
    const { rows } = await pool.query(
      `SELECT count(*)::int AS n FROM "${schema}".checklist_stages WHERE checklist_id = $1`,
      [id]
    );
    await pool.query(
      `INSERT INTO "${schema}".checklist_stages (checklist_id, sr_no, name, witness_required, drawing_required)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, rows[0].n + 1, add_stage.name || `Stage ${rows[0].n + 1}`, Boolean(add_stage.witness_required), Boolean(add_stage.drawing_required)]
    );
  }

  if (edit_stage) {
    await pool.query(
      `UPDATE "${schema}".checklist_stages
       SET name = COALESCE($2, name),
           witness_required = COALESCE($3, witness_required),
           drawing_required = COALESCE($4, drawing_required)
       WHERE id = $1`,
      [edit_stage.id, edit_stage.name ?? null, edit_stage.witness_required ?? null, edit_stage.drawing_required ?? null]
    );
  }

  if (delete_stage) {
    await pool.query(
      `DELETE FROM "${schema}".checklist_stages WHERE id = $1 AND checklist_id = $2`,
      [delete_stage.id, id]
    );
  }

  if (add_checkpoint) {
    const { stage_id, question, input_type = 'yes_no', drawing_required = false, witness_required = false, photo_required = false, remark_required = false } = add_checkpoint;
    const { rows } = await pool.query(
      `SELECT count(*)::int AS n FROM "${schema}".checkpoints WHERE stage_id = $1`,
      [stage_id]
    );
    await pool.query(
      `INSERT INTO "${schema}".checkpoints
         (stage_id, sr_no, question, input_type, drawing_required, witness_required, photo_required, remark_required)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [stage_id, rows[0].n + 1, question, input_type, Boolean(drawing_required), Boolean(witness_required), Boolean(photo_required), Boolean(remark_required)]
    );
  }

  if (edit_checkpoint) {
    const { id: cpId, question, input_type, drawing_required, witness_required, photo_required, remark_required } = edit_checkpoint;
    await pool.query(
      `UPDATE "${schema}".checkpoints
       SET question = COALESCE($2, question),
           input_type = COALESCE($3, input_type),
           drawing_required = COALESCE($4, drawing_required),
           witness_required = COALESCE($5, witness_required),
           photo_required = COALESCE($6, photo_required),
           remark_required = COALESCE($7, remark_required)
       WHERE id = $1`,
      [cpId, question ?? null, input_type ?? null, drawing_required ?? null, witness_required ?? null, photo_required ?? null, remark_required ?? null]
    );
  }

  if (delete_checkpoint) {
    await pool.query(`DELETE FROM "${schema}".checkpoints WHERE id = $1`, [delete_checkpoint.id]);
  }

  const { rows: stages } = await pool.query(
    `SELECT * FROM "${schema}".checklist_stages WHERE checklist_id = $1 ORDER BY sr_no`,
    [id]
  );
  const { rows: checkpoints } = await pool.query(
    `SELECT cp.* FROM "${schema}".checkpoints cp
     JOIN "${schema}".checklist_stages cs ON cs.id = cp.stage_id
     WHERE cs.checklist_id = $1
     ORDER BY cp.sr_no`,
    [id]
  );
  const stagesWithCheckpoints = stages.map((s: any) => ({
    ...s,
    checkpoints: checkpoints.filter((cp: any) => cp.stage_id === s.id),
  }));

  return res.json({ checklist, stages: stagesWithCheckpoints });
});

export default router;
