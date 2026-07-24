import { Router, Request, Response } from 'express';
import { db, Organization } from '../db';
import { getUserFromHeader } from './auth';
import { randomUUID as uuidv4 } from 'crypto';

const router = Router();

// GET /api/organizations - list all tenant organizations
router.get('/', (req: Request, res: Response) => {
  return res.json(db.organizations);
});

// POST /api/organizations - create new organization
router.post('/', (req: Request, res: Response) => {
  const auth = getUserFromHeader(req);
  const { name, user_limit = 10, licensing = 'Starter', expiry_date = '2027-12-31', logo_url = '' } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Organization Name is required' });
  }

  const newOrg: Organization = {
    id: `org-${uuidv4().substring(0, 8)}`,
    name,
    user_limit: Number(user_limit),
    licensing: licensing as 'Starter' | 'Professional' | 'Enterprise',
    expiry_date,
    logo_url: logo_url || 'https://images.pexels.com/photos/269077/pexels-photo-269077.jpeg',
    console_uses: 1,
    created_at: new Date().toISOString(),
  };

  db.organizations.unshift(newOrg);

  // Automatically add creator as admin
  db.orgMembers.push({
    id: `om-${uuidv4().substring(0, 8)}`,
    user_id: auth.user.id,
    organization_id: newOrg.id,
    role: 'admin',
    status: 'active',
    created_at: new Date().toISOString(),
  });

  return res.status(201).json(newOrg);
});

export default router;
