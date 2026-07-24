import { Router, Request, Response } from 'express';
import { pool } from '../pool';
import { getUserFromHeader } from './auth';

const router = Router();

// GET /api/organizations - list all tenant organizations
router.get('/', async (req: Request, res: Response) => {
  const { rows } = await pool.query('SELECT * FROM public.organizations ORDER BY created_at DESC');
  return res.json(rows);
});

// POST /api/organizations - create new organization
router.post('/', async (req: Request, res: Response) => {
  const auth = await getUserFromHeader(req);
  const { name, user_limit = 10, licensing = 'Starter', expiry_date = '2027-12-31', logo_url = '' } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Organization Name is required' });
  }

  const { rows } = await pool.query(
    `INSERT INTO public.organizations (name, user_limit, licensing, expiry_date, logo_url, console_uses)
     VALUES ($1, $2, $3, $4, $5, 1)
     RETURNING *`,
    [name, Number(user_limit), licensing, expiry_date, logo_url || 'https://images.pexels.com/photos/269077/pexels-photo-269077.jpeg']
  );
  const newOrg = rows[0];

  // Provision the org's isolated schema (teams, projects, checklists, etc.)
  await pool.query('SELECT public.create_org_schema($1)', [newOrg.id]);

  // Automatically add creator as admin
  await pool.query(
    `INSERT INTO public.org_members (user_id, organization_id, role, status)
     VALUES ($1, $2, 'admin', 'active')`,
    [auth.user.id, newOrg.id]
  );

  return res.status(201).json(newOrg);
});

export default router;
