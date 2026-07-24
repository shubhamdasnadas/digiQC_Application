import { Router, Request, Response } from 'express';
import { db, Checklist, ChecklistStage, ChecklistCheckpoint } from '../db';
import { getUserFromHeader } from './auth';
import { randomUUID as uuidv4 } from 'crypto';

const router = Router();

// GET /api/checklists - list checklists (org-scoped + shared library)
router.get('/', (req: Request, res: Response) => {
  const auth = getUserFromHeader(req);
  const orgId = auth.currentOrg?.id || 'org-city-hospital';

  const orgChecklists = db.checklists.filter(c => c.organization_id === orgId || c.project_id === null);

  const enriched = orgChecklists.map(c => {
    const project = db.projects.find(p => p.id === c.project_id);
    const stages = db.stages.filter(s => s.checklist_id === c.id);
    let totalCheckpoints = 0;
    stages.forEach(s => {
      totalCheckpoints += s.checkpoints?.length || 0;
    });

    return {
      ...c,
      project_name: project ? project.name : 'Org Generic Library',
      stages_count: stages.length || c.stages_count || 1,
      checkpoints_count: totalCheckpoints || c.checkpoints_count || 5,
    };
  });

  return res.json(enriched);
});

// POST /api/checklists - create new checklist or import batch
router.post('/', (req: Request, res: Response) => {
  const auth = getUserFromHeader(req);
  const orgId = auth.currentOrg?.id || 'org-city-hospital';

  if (Array.isArray(req.body)) {
    // Bulk import array handler
    const createdList: Checklist[] = [];
    req.body.forEach((item: any) => {
      const newChk: Checklist = {
        id: `chk-${uuidv4().substring(0, 8)}`,
        organization_id: orgId,
        project_id: item.project_id || null,
        name: item.name || item.checklist_name || 'Imported Inspection Checklist',
        reference_number: item.reference_number || `PCPL/IMP/${uuidv4().substring(0, 6).toUpperCase()}`,
        uom: item.uom || 'Nos',
        status: 'active',
        updated_by: auth.user.name,
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        source: 'org',
      };
      db.checklists.unshift(newChk);
      createdList.push(newChk);
    });

    return res.status(201).json({ success: true, count: createdList.length, checklists: createdList });
  }

  const { name, project_id = null, reference_number = '', uom = 'Nos' } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Checklist Name is required' });
  }

  const newChecklist: Checklist = {
    id: `chk-${uuidv4().substring(0, 8)}`,
    organization_id: orgId,
    project_id,
    name,
    reference_number: reference_number || `PCPL/ARCH/${uuidv4().substring(0, 6).toUpperCase()}/2025/001`,
    uom,
    status: 'active',
    stages_count: 1,
    checkpoints_count: 0,
    updated_by: auth.user.name,
    updated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    source: 'org',
  };

  db.checklists.unshift(newChecklist);

  // Default stage for new checklist
  const initialStage: ChecklistStage = {
    id: `stg-${uuidv4().substring(0, 8)}`,
    checklist_id: newChecklist.id,
    sr_no: 1,
    name: 'Stage 1 - Initial Inspection',
    witness_required: true,
    drawing_required: true,
    checkpoints: [],
    created_at: new Date().toISOString(),
  };

  db.stages.push(initialStage);

  return res.status(201).json(newChecklist);
});

// GET /api/checklists/:id - get checklist with stages and checkpoints
router.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const checklist = db.checklists.find(c => c.id === id);

  if (!checklist) {
    return res.status(404).json({ error: 'Checklist template not found' });
  }

  const stages = db.stages.filter(s => s.checklist_id === id).sort((a, b) => a.sr_no - b.sr_no);

  return res.json({
    checklist,
    stages,
  });
});

// PATCH /api/checklists/:id - add stage or checkpoint, or reorder
router.patch('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const auth = getUserFromHeader(req);
  const checklist = db.checklists.find(c => c.id === id);

  if (!checklist) {
    return res.status(404).json({ error: 'Checklist not found' });
  }

  const { add_stage, edit_stage, delete_stage, add_checkpoint, edit_checkpoint, delete_checkpoint, reorder_stages, reorder_checkpoints } = req.body;

  if (add_stage) {
    const stageCount = db.stages.filter(s => s.checklist_id === id).length;
    const newStage: ChecklistStage = {
      id: `stg-${uuidv4().substring(0, 8)}`,
      checklist_id: id,
      sr_no: stageCount + 1,
      name: add_stage.name || `Stage ${stageCount + 1}`,
      witness_required: Boolean(add_stage.witness_required),
      drawing_required: Boolean(add_stage.drawing_required),
      checkpoints: [],
      created_at: new Date().toISOString(),
    };
    db.stages.push(newStage);
  }

  if (edit_stage) {
    const stage = db.stages.find(s => s.id === edit_stage.id);
    if (stage) {
      if (edit_stage.name !== undefined) stage.name = edit_stage.name;
      if (edit_stage.witness_required !== undefined) stage.witness_required = Boolean(edit_stage.witness_required);
      if (edit_stage.drawing_required !== undefined) stage.drawing_required = Boolean(edit_stage.drawing_required);
    }
  }

  if (delete_stage) {
    db.stages = db.stages.filter(s => !(s.id === delete_stage.id && s.checklist_id === id));
  }

  if (add_checkpoint) {
    const { stage_id, question, input_type = 'yes_no', options = [], fail_rule, drawing_required = false, witness_required = false, photo_required = false, remark_required = false } = add_checkpoint;
    const targetStage = db.stages.find(s => s.id === stage_id);

    if (targetStage) {
      const cpCount = targetStage.checkpoints.length;
      const newCp: ChecklistCheckpoint = {
        id: `cp-${uuidv4().substring(0, 8)}`,
        stage_id,
        sr_no: cpCount + 1,
        question,
        input_type,
        options,
        fail_rule,
        drawing_required: Boolean(drawing_required),
        witness_required: Boolean(witness_required),
        photo_required: Boolean(photo_required),
        remark_required: Boolean(remark_required),
        created_at: new Date().toISOString(),
      };
      targetStage.checkpoints.push(newCp);
    }
  }

  if (edit_checkpoint) {
    const { id: cpId, stage_id, question, input_type, options, fail_rule, drawing_required, witness_required, photo_required, remark_required } = edit_checkpoint;
    const targetStage = db.stages.find(s => s.id === stage_id);
    if (targetStage && targetStage.checkpoints) {
      const cpIndex = targetStage.checkpoints.findIndex(c => c.id === cpId);
      if (cpIndex !== -1) {
        targetStage.checkpoints[cpIndex] = {
          ...targetStage.checkpoints[cpIndex],
          ...(question !== undefined && { question }),
          ...(input_type !== undefined && { input_type }),
          ...(options !== undefined && { options }),
          ...(fail_rule !== undefined && { fail_rule }),
          ...(drawing_required !== undefined && { drawing_required: Boolean(drawing_required) }),
          ...(witness_required !== undefined && { witness_required: Boolean(witness_required) }),
          ...(photo_required !== undefined && { photo_required: Boolean(photo_required) }),
          ...(remark_required !== undefined && { remark_required: Boolean(remark_required) }),
        };
      }
    }
  }

  if (delete_checkpoint) {
    const { id: cpId, stage_id } = delete_checkpoint;
    const targetStage = db.stages.find(s => s.id === stage_id);
    if (targetStage && targetStage.checkpoints) {
      targetStage.checkpoints = targetStage.checkpoints.filter(c => c.id !== cpId);
    }
  }

  checklist.updated_by = auth.user.name;
  checklist.updated_at = new Date().toISOString();

  const stages = db.stages.filter(s => s.checklist_id === id);
  return res.json({ checklist, stages });
});

export default router;
