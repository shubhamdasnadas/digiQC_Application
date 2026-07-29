import { Router, Request, Response } from 'express';
import { pool } from '../pool';

const router = Router();

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
}

export interface AuthOrg {
  id: string;
  name: string;
  role: string;
  licensing: string;
}

export interface AuthData {
  user: AuthUser;
  orgs: AuthOrg[];
  currentOrg: AuthOrg | null;
}

async function loadOrgsForUser(userId: string): Promise<AuthOrg[]> {
  const { rows } = await pool.query(
    `SELECT om.organization_id AS id, o.name, om.role, o.licensing
     FROM public.org_members om
     JOIN public.organizations o ON o.id = om.organization_id
     WHERE om.user_id = $1 AND om.status = 'active'
     ORDER BY o.created_at`,
    [userId]
  );
  return rows;
}

// Helper: strict UUID check so we never pass a non-UUID string to a uuid column.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v);

// Helper to extract session or header user info
export const getUserFromHeader = async (req: Request): Promise<AuthData> => {
  const rawUserId = req.headers['x-user-id'] as string | undefined;
  const rawOrgId = req.headers['x-org-id'] as string | undefined;
  const userId = isUuid(rawUserId) ? rawUserId : undefined;
  const orgId = isUuid(rawOrgId) ? rawOrgId : undefined;

  let user: AuthUser | undefined;
  if (userId) {
    const { rows } = await pool.query(
      'SELECT id, name, email, avatar_url FROM public.users WHERE id = $1',
      [userId]
    );
    user = rows[0];
  }

  if (!user) {
    // Fallback to the first user for quick testing
    const { rows } = await pool.query(
      'SELECT id, name, email, avatar_url FROM public.users ORDER BY created_at LIMIT 1'
    );
    user = rows[0];
  }

  if (!user) {
    throw new Error('No users found in the database');
  }

  const orgs = await loadOrgsForUser(user.id);
  const currentOrg = orgs.find(o => o.id === orgId) || orgs[0] || null;

  return { user, orgs, currentOrg };
};

// Login Route
router.post('/login', async (req: Request, res: Response) => {
  const { email } = req.body;

  const { rows } = await pool.query(
    'SELECT id, name, email, avatar_url FROM public.users WHERE lower(email) = lower($1)',
    [(email || '').trim()]
  );
  const user = rows[0];

  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const orgs = await loadOrgsForUser(user.id);
  const currentOrg = orgs[0] || null;

  return res.json({
    user,
    orgs,
    currentOrg,
    token: `token-${user.id}`,
  });
});

// Register Route
router.post('/register', async (req: Request, res: Response) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }

  const { rows: existingRows } = await pool.query('SELECT id FROM public.users WHERE lower(email) = lower($1)', [email]);
  if (existingRows[0]) {
    return res.status(400).json({ error: 'Email already registered' });
  }

  const { rows } = await pool.query(
    'INSERT INTO public.users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email',
    [name, email, password]
  );
  const newUser = rows[0];

  return res.json({
    user: newUser,
    orgs: [],
    currentOrg: null,
    token: `token-${newUser.id}`,
  });
});

// Me Route
router.get('/me', async (req: Request, res: Response) => {
  const authData = await getUserFromHeader(req);
  return res.json(authData);
});

// Switch Org Route
router.post('/switch-org', async (req: Request, res: Response) => {
  const { orgId } = req.body;
  const authData = await getUserFromHeader(req);

  const targetOrg = authData.orgs.find(o => o.id === orgId);
  if (!targetOrg) {
    return res.status(403).json({ error: 'You are not a member of this organization' });
  }

  return res.json({
    user: authData.user,
    orgs: authData.orgs,
    currentOrg: targetOrg,
    token: `token-${authData.user.id}`,
  });
});

// Join Org Route
router.post('/join-org', async (req: Request, res: Response) => {
  const { organizationId, role = 'admin' } = req.body;
  const authData = await getUserFromHeader(req);

  await pool.query(
    `INSERT INTO public.org_members (user_id, organization_id, role, status)
     VALUES ($1, $2, $3, 'active')
     ON CONFLICT (user_id, organization_id) DO NOTHING`,
    [authData.user.id, organizationId, role]
  );

  const updatedAuth = await getUserFromHeader(req);
  return res.json(updatedAuth);
});

// Logout Route
router.post('/logout', (req: Request, res: Response) => {
  return res.json({ success: true });
});

export default router;
