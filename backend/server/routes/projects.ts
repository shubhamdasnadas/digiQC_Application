import { Router, Request, Response } from 'express';
import { pool, orgSchema } from '../pool';
import { getUserFromHeader } from './auth';

const router = Router();

// GET /api/projects - list projects for active org
router.get('/', async (req: Request, res: Response) => {
  const auth = await getUserFromHeader(req);
  if (!auth.currentOrg) return res.json([]);

  const schema = await orgSchema(auth.currentOrg.id);

  const { rows: projects } = await pool.query(`SELECT * FROM "${schema}".projects ORDER BY created_at DESC`);

  const result = await Promise.all(
    projects.map(async (p: any) => {
      const { rows: members } = await pool.query(
        `SELECT pm.*, u.name AS user_name, u.email AS user_email
         FROM "${schema}".project_members pm
         JOIN public.users u ON u.id = pm.user_id
         WHERE pm.project_id = $1`,
        [p.id]
      );
      const myMember = members.find((m: any) => m.user_id === auth.user.id);

      return {
        ...p,
        members_count: members.length,
        assigned_users: members.map((m: any) => m.user_name),
        my_role: myMember ? myMember.role : 'admin',
      };
    })
  );

  return res.json(result);
});

// POST /api/projects - create new project
router.post('/', async (req: Request, res: Response) => {
  const auth = await getUserFromHeader(req);
  if (!auth.currentOrg) return res.status(400).json({ error: 'No active organization' });

  const {
    name,
    unique_code,
    client_name,
    nomenclature = '',
    profile = '',
    instruction = '',
    description = '',
    project_admin_id = auth.user.id,
    radius_m = 100,
    timezone = 'Asia/Calcutta',
    latitude = 19.076,
    longitude = 72.8777,
    address = 'Mumbai, Maharashtra',
    perm_location = true,
    perm_authentication = true,
    perm_rfi = true,
    image_url = 'https://images.pexels.com/photos/1216589/pexels-photo-1216589.jpeg',
    status = 'active',
  } = req.body;

  if (!name || !unique_code) {
    return res.status(400).json({ error: 'Project Name and Unique Code are required' });
  }

  const schema = await orgSchema(auth.currentOrg.id);

  const { rows } = await pool.query(
    `INSERT INTO "${schema}".projects
       (organization_id, name, nomenclature, unique_code, client_name, profile, instruction, description,
        project_admin_id, radius_m, timezone, latitude, longitude, address,
        perm_location, perm_authentication, perm_rfi, image_url, status, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
     RETURNING *`,
    [
      auth.currentOrg.id,
      name,
      nomenclature || name.substring(0, 3).toUpperCase() + '-01',
      unique_code,
      client_name || 'Standard Client',
      profile || 'General Civil Construction',
      instruction || 'Strict QC inspection mandatory prior to work progress.',
      description || 'Construction QC project',
      project_admin_id,
      Number(radius_m) || 100,
      timezone || 'Asia/Calcutta',
      Number(latitude) || 19.076,
      Number(longitude) || 72.8777,
      address,
      Boolean(perm_location),
      Boolean(perm_authentication),
      Boolean(perm_rfi),
      image_url || 'https://images.pexels.com/photos/1216589/pexels-photo-1216589.jpeg',
      status,
      auth.user.id,
    ]
  );
  const newProject = rows[0];

  await pool.query(
    `INSERT INTO "${schema}".project_members (project_id, user_id, role) VALUES ($1, $2, 'admin')`,
    [newProject.id, auth.user.id]
  );

  return res.status(201).json(newProject);
});

// GET /api/projects/:id - single project detail
router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const auth = await getUserFromHeader(req);
  if (!auth.currentOrg) return res.status(404).json({ error: 'Project not found' });

  const schema = await orgSchema(auth.currentOrg.id);
  const { rows } = await pool.query(`SELECT * FROM "${schema}".projects WHERE id = $1`, [id]);

  if (!rows[0]) {
    return res.status(404).json({ error: 'Project not found' });
  }

  return res.json(rows[0]);
});

// PATCH /api/projects/:id - update project
router.patch('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const auth = await getUserFromHeader(req);
  if (!auth.currentOrg) return res.status(404).json({ error: 'Project not found' });

  const schema = await orgSchema(auth.currentOrg.id);

  const editable = [
    'name', 'nomenclature', 'instruction', 'profile', 'image_url', 'status', 'unique_code',
    'client_name', 'description', 'project_admin_id', 'radius_m', 'timezone', 'latitude',
    'longitude', 'address', 'perm_location', 'perm_authentication', 'perm_rfi',
  ];
  const sets: string[] = [];
  const values: any[] = [];
  editable.forEach((key) => {
    if (req.body[key] !== undefined) {
      values.push(req.body[key]);
      sets.push(`${key} = $${values.length}`);
    }
  });
  values.push(auth.user.id);
  sets.push(`updated_by = $${values.length}`);
  sets.push('updated_at = now()');
  values.push(id);

  const { rows } = await pool.query(
    `UPDATE "${schema}".projects SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING *`,
    values
  );

  if (!rows[0]) {
    return res.status(404).json({ error: 'Project not found' });
  }

  return res.json(rows[0]);
});

// DELETE /api/projects/:id - delete project
router.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const auth = await getUserFromHeader(req);
  if (!auth.currentOrg) return res.json({ success: true });

  const schema = await orgSchema(auth.currentOrg.id);
  await pool.query(`DELETE FROM "${schema}".projects WHERE id = $1`, [id]);

  return res.json({ success: true });
});

// === SUB-RESOURCES FOR PROJECT DETAIL WORKSPACE ===

// EQCs
router.get('/:id/eqcs', async (req: Request, res: Response) => {
  const { id } = req.params;
  const auth = await getUserFromHeader(req);
  if (!auth.currentOrg) return res.json([]);

  const schema = await orgSchema(auth.currentOrg.id);
  const { rows } = await pool.query(
    `SELECT e.*, c.name AS checklist_name, u.name AS inspected_by_name, a.name AS approver_name
     FROM "${schema}".eqcs e
     LEFT JOIN "${schema}".checklists c ON c.id = e.checklist_id
     LEFT JOIN public.users u ON u.id = e.inspected_by
     LEFT JOIN public.users a ON a.id = e.approver_id
     WHERE e.project_id = $1
     ORDER BY e.created_at DESC`,
    [id]
  );
  return res.json(rows);
});

router.post('/:id/eqcs', async (req: Request, res: Response) => {
  const { id } = req.params;
  const auth = await getUserFromHeader(req);
  if (!auth.currentOrg) return res.status(400).json({ error: 'No active organization' });

  const { location, checklist_id, stage_index = 1, total_stages = 3, status = 'passed', notes = '' } = req.body;

  if (!location || !checklist_id) {
    return res.status(400).json({ error: 'Location and Checklist selection are required' });
  }

  const stageResult = status === 'passed' ? 'pass' : status === 'failed' ? 'fail' : 'pending';
  const schema = await orgSchema(auth.currentOrg.id);

  const { rows } = await pool.query(
    `INSERT INTO "${schema}".eqcs
       (project_id, location, checklist_id, stage_index, total_stages, stage_result, status,
        approver_id, approver_log, inspected_by, inspected_at, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now(), $11)
     RETURNING *`,
    [
      id, location, checklist_id, Number(stage_index), Number(total_stages), stageResult, status,
      auth.user.id, 'QC Inspection logged and evaluated by field engineer.', auth.user.id, notes,
    ]
  );

  return res.status(201).json(rows[0]);
});

// Issues
router.get('/:id/issues', async (req: Request, res: Response) => {
  const { id } = req.params;
  const auth = await getUserFromHeader(req);
  if (!auth.currentOrg) return res.json([]);

  const schema = await orgSchema(auth.currentOrg.id);
  const { rows } = await pool.query(
    `SELECT i.*, u.name AS assignee_name
     FROM "${schema}".issues i
     LEFT JOIN public.users u ON u.id = i.assignee_id
     WHERE i.project_id = $1
     ORDER BY i.created_at DESC`,
    [id]
  );
  return res.json(rows);
});

router.post('/:id/issues', async (req: Request, res: Response) => {
  const { id } = req.params;
  const auth = await getUserFromHeader(req);
  if (!auth.currentOrg) return res.status(400).json({ error: 'No active organization' });

  const { title, description = '', severity = 'medium', status = 'open', assignee_id, due_date } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Issue Title is required' });
  }

  const schema = await orgSchema(auth.currentOrg.id);
  const { rows } = await pool.query(
    `INSERT INTO "${schema}".issues (project_id, title, description, severity, status, assignee_id, reported_by, due_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      id, title, description, severity, status, assignee_id || null, auth.user.id,
      due_date || new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().split('T')[0],
    ]
  );

  return res.status(201).json(rows[0]);
});

// Register (Documents & Drawings)
router.get('/:id/register', async (req: Request, res: Response) => {
  const { id } = req.params;
  const auth = await getUserFromHeader(req);
  if (!auth.currentOrg) return res.json([]);

  const schema = await orgSchema(auth.currentOrg.id);
  const { rows } = await pool.query(
    `SELECT * FROM "${schema}".register_entries WHERE project_id = $1 ORDER BY created_at DESC`,
    [id]
  );
  return res.json(rows);
});

router.post('/:id/register', async (req: Request, res: Response) => {
  const { id } = req.params;
  const auth = await getUserFromHeader(req);
  if (!auth.currentOrg) return res.status(400).json({ error: 'No active organization' });

  const { document_no, title, revision = 'R0', status = 'active', file_url = '' } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Document Title is required' });
  }

  const schema = await orgSchema(auth.currentOrg.id);
  const { rows } = await pool.query(
    `INSERT INTO "${schema}".register_entries (project_id, document_no, title, revision, status, file_url)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [id, document_no || '', title, revision, status, file_url]
  );

  return res.status(201).json(rows[0]);
});

// Members
router.get('/:id/members', async (req: Request, res: Response) => {
  const { id } = req.params;
  const auth = await getUserFromHeader(req);
  if (!auth.currentOrg) return res.json([]);

  const schema = await orgSchema(auth.currentOrg.id);
  const { rows } = await pool.query(
    `SELECT pm.*, u.name AS user_name, u.email AS user_email
     FROM "${schema}".project_members pm
     JOIN public.users u ON u.id = pm.user_id
     WHERE pm.project_id = $1`,
    [id]
  );
  return res.json(rows);
});

router.post('/:id/members', async (req: Request, res: Response) => {
  const { id } = req.params;
  const auth = await getUserFromHeader(req);
  if (!auth.currentOrg) return res.status(400).json({ error: 'No active organization' });

  const { user_id, role = 'member' } = req.body;

  const { rows: userRows } = await pool.query('SELECT id, name, email FROM public.users WHERE id = $1', [user_id]);
  const targetUser = userRows[0];
  if (!targetUser) {
    return res.status(404).json({ error: 'User not found' });
  }

  const schema = await orgSchema(auth.currentOrg.id);
  const { rows } = await pool.query(
    `INSERT INTO "${schema}".project_members (project_id, user_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role
     RETURNING *`,
    [id, targetUser.id, role]
  );

  return res.status(201).json({ ...rows[0], user_name: targetUser.name, user_email: targetUser.email });
});

// Targets
router.get('/:id/targets', async (req: Request, res: Response) => {
  const { id } = req.params;
  const auth = await getUserFromHeader(req);
  if (!auth.currentOrg) return res.json([]);

  const schema = await orgSchema(auth.currentOrg.id);
  const { rows } = await pool.query(
    `SELECT * FROM "${schema}".project_targets WHERE project_id = $1 ORDER BY created_at DESC`,
    [id]
  );
  return res.json(rows);
});

router.post('/:id/targets', async (req: Request, res: Response) => {
  const { id } = req.params;
  const auth = await getUserFromHeader(req);
  if (!auth.currentOrg) return res.status(400).json({ error: 'No active organization' });

  const { metric, target_value = 100, current_value = 0, unit = 'Units', period = 'monthly' } = req.body;

  if (!metric) {
    return res.status(400).json({ error: 'Metric title is required' });
  }

  const schema = await orgSchema(auth.currentOrg.id);
  const { rows } = await pool.query(
    `INSERT INTO "${schema}".project_targets (project_id, metric, target_value, current_value, unit, period)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [id, metric, Number(target_value), Number(current_value), unit, period]
  );

  return res.status(201).json(rows[0]);
});

export default router;
