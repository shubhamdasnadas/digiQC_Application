import { Router, Request, Response } from 'express';
import { db, Team } from '../db';
import { getUserFromHeader } from './auth';
import { randomUUID as uuidv4 } from 'crypto';

const router = Router();

// GET /api/teams - list teams for current org
router.get('/', (req: Request, res: Response) => {
  const auth = getUserFromHeader(req);
  const orgId = auth.currentOrg?.id || 'org-city-hospital';

  const teams = db.teams.filter(t => t.organization_id === orgId);
  return res.json(teams);
});

// POST /api/teams - create team
router.post('/', (req: Request, res: Response) => {
  const auth = getUserFromHeader(req);
  const orgId = auth.currentOrg?.id || 'org-city-hospital';

  const { name, type = 'inspection', team_lead_name = '', spoc_name = '', active_projects = '', inactive_projects = '' } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Team Name is required' });
  }

  const newTeam: Team = {
    id: `team-${uuidv4().substring(0, 8)}`,
    organization_id: orgId,
    name,
    type: type as 'inspection' | 'audit' | 'compliance',
    team_lead_name: team_lead_name || auth.user.name,
    spoc_name: spoc_name || auth.user.name,
    active_projects,
    inactive_projects,
    created_at: new Date().toISOString(),
  };

  db.teams.unshift(newTeam);

  // Add creator as initial member
  db.teamMembers.push({
    id: `tm-${uuidv4().substring(0, 8)}`,
    team_id: newTeam.id,
    user_id: auth.user.id,
    name: auth.user.name,
    email: auth.user.email,
    role: 'Team Lead',
    joined_at: new Date().toISOString(),
  });

  return res.status(201).json(newTeam);
});

// GET /api/teams/:id/members - get members of a specific team
router.get('/:id/members', (req: Request, res: Response) => {
  const { id } = req.params;
  const members = db.teamMembers.filter(m => m.team_id === id);

  if (members.length === 0) {
    // Return default members if team was created dynamically
    const team = db.teams.find(t => t.id === id);
    if (team) {
      return res.json([
        {
          id: `tm-auto-1`,
          team_id: id,
          user_id: 'usr-sarvesh',
          name: team.team_lead_name || 'Sarvesh Gupta',
          email: 'sarvesh.gupta@pranavconstructions.com',
          role: 'Team Lead',
          joined_at: team.created_at,
        },
        {
          id: `tm-auto-2`,
          team_id: id,
          user_id: 'usr-mayuresh',
          name: team.spoc_name || 'Mayuresh Jadhav',
          email: 'mayuresh.jadhav@pranavconstructions.com',
          role: 'SPOC / Inspector',
          joined_at: team.created_at,
        },
      ]);
    }
  }

  return res.json(members);
});

export default router;
