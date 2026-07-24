import { Router, Request, Response } from 'express';
import { db } from '../db';
import { randomUUID as uuidv4 } from 'crypto';

const router = Router();

// Helper to extract session or header user info
export const getUserFromHeader = (req: Request) => {
  const userId = req.headers['x-user-id'] as string;
  const orgId = req.headers['x-org-id'] as string;

  if (userId) {
    const user = db.users.find(u => u.id === userId);
    if (user) {
      const memberOrgs = db.orgMembers
        .filter(m => m.user_id === user.id && m.status === 'active')
        .map(m => {
          const org = db.organizations.find(o => o.id === m.organization_id);
          return {
            id: m.organization_id,
            name: org ? org.name : 'Unknown Org',
            role: m.role,
            licensing: org ? org.licensing : 'Starter',
          };
        });

      const currentOrg = memberOrgs.find(o => o.id === orgId) || memberOrgs[0] || null;

      return { user, orgs: memberOrgs, currentOrg };
    }
  }

  // Fallback default user (Sarvesh) for quick testing
  const defaultUser = db.users[0];
  const memberOrgs = db.orgMembers
    .filter(m => m.user_id === defaultUser.id)
    .map(m => {
      const org = db.organizations.find(o => o.id === m.organization_id);
      return {
        id: m.organization_id,
        name: org ? org.name : 'Unknown Org',
        role: m.role,
        licensing: org ? org.licensing : 'Starter',
      };
    });

  const currentOrg = memberOrgs.find(o => o.id === orgId) || memberOrgs[0];
  return { user: defaultUser, orgs: memberOrgs, currentOrg };
};

// Login Route
router.post('/login', (req: Request, res: Response) => {
  const { email, password } = req.body;

  const user = db.users.find(u => u.email.toLowerCase() === (email || '').toLowerCase().trim());

  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const memberOrgs = db.orgMembers
    .filter(m => m.user_id === user.id && m.status === 'active')
    .map(m => {
      const org = db.organizations.find(o => o.id === m.organization_id);
      return {
        id: m.organization_id,
        name: org ? org.name : 'Unknown Org',
        role: m.role,
        licensing: org ? org.licensing : 'Starter',
      };
    });

  const currentOrg = memberOrgs[0] || null;

  return res.json({
    user: { id: user.id, name: user.name, email: user.email, mobile_no: user.mobile_no },
    orgs: memberOrgs,
    currentOrg,
    token: `token-${user.id}`,
  });
});

// Register Route
router.post('/register', (req: Request, res: Response) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }

  const existing = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    return res.status(400).json({ error: 'Email already registered' });
  }

  const newUser = {
    id: `usr-${uuidv4().substring(0, 8)}`,
    name,
    email,
    password_hash: '$2a$12$eImiTXuWVxfM37uY4JANjO9K8N9h0U0G83k0g8b2Z5kXgO5z9bKiu',
    created_at: new Date().toISOString(),
  };

  db.users.push(newUser);

  return res.json({
    user: { id: newUser.id, name: newUser.name, email: newUser.email },
    orgs: [],
    currentOrg: null,
    token: `token-${newUser.id}`,
  });
});

// Me Route
router.get('/me', (req: Request, res: Response) => {
  const authData = getUserFromHeader(req);
  if (!authData.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  return res.json({
    user: { id: authData.user.id, name: authData.user.name, email: authData.user.email },
    orgs: authData.orgs,
    currentOrg: authData.currentOrg,
  });
});

// Switch Org Route
router.post('/switch-org', (req: Request, res: Response) => {
  const { orgId } = req.body;
  const authData = getUserFromHeader(req);

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
router.post('/join-org', (req: Request, res: Response) => {
  const { organizationId, role = 'admin' } = req.body;
  const authData = getUserFromHeader(req);

  const existing = db.orgMembers.find(m => m.user_id === authData.user.id && m.organization_id === organizationId);
  if (!existing) {
    db.orgMembers.push({
      id: `om-${uuidv4().substring(0, 8)}`,
      user_id: authData.user.id,
      organization_id: organizationId,
      role: role as 'admin' | 'member',
      status: 'active',
      created_at: new Date().toISOString(),
    });
  }

  const updatedAuth = getUserFromHeader(req);
  return res.json(updatedAuth);
});

// Logout Route
router.post('/logout', (req: Request, res: Response) => {
  return res.json({ success: true });
});

export default router;
