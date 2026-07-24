import { Router, Request, Response } from 'express';
import { pool, orgSchema } from '../pool';
import { getUserFromHeader } from './auth';

const router = Router();

// GET /api/teams - list teams for current org
router.get('/', async (req: Request, res: Response) => {
  const auth = await getUserFromHeader(req);
  if (!auth.currentOrg) return res.json([]);

  const schema = await orgSchema(auth.currentOrg.id);
  const { rows } = await pool.query(`SELECT * FROM "${schema}".teams ORDER BY created_at DESC`);
  return res.json(rows);
});

// POST /api/teams - create team
router.post('/', async (req: Request, res: Response) => {
  const auth = await getUserFromHeader(req);
  if (!auth.currentOrg) return res.status(400).json({ error: 'No active organization' });

  const { name, type = 'inspection', team_lead_name = '', spoc_name = '', active_projects = '', inactive_projects = '' } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Team Name is required' });
  }

  const schema = await orgSchema(auth.currentOrg.id);
  const { rows } = await pool.query(
    `INSERT INTO "${schema}".teams
       (organization_id, name, type, team_lead_name, spoc_name, active_projects, inactive_projects)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [auth.currentOrg.id, name, type, team_lead_name || auth.user.name, spoc_name || auth.user.name, active_projects, inactive_projects]
  );

  return res.status(201).json(rows[0]);
});

// GET /api/teams/:id/members - get members of a specific team
router.get('/:id/members', async (req: Request, res: Response) => {
  const { id } = req.params;
  const auth = await getUserFromHeader(req);
  if (!auth.currentOrg) return res.json([]);

  const schema = await orgSchema(auth.currentOrg.id);

  const { rows: teamRows } = await pool.query(`SELECT * FROM "${schema}".teams WHERE id = $1`, [id]);
  const team = teamRows[0];
  if (!team) {
    return res.status(404).json({ error: 'Team not found' });
  }

  // Org staff members carry a comma-separated `teams` text field naming which teams they belong to.
  const { rows: memberRows } = await pool.query(`SELECT * FROM "${schema}".members`);
  const members = memberRows.filter((m: any) =>
    (m.teams || '').split(',').map((t: string) => t.trim()).includes(team.name)
  );

  return res.json(members);
});

export default router;
