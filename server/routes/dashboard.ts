import { Router, Request, Response } from 'express';
import { db } from '../db';
import { getUserFromHeader } from './auth';

const router = Router();

// GET /api/dashboard - stats & recent activities
router.get('/', (req: Request, res: Response) => {
  const auth = getUserFromHeader(req);
  const orgId = auth.currentOrg?.id || 'org-city-hospital';

  const projects = db.projects.filter(p => p.organization_id === orgId);
  const teams = db.teams.filter(t => t.organization_id === orgId);
  const checklists = db.checklists.filter(c => c.organization_id === orgId || c.project_id === null);

  const orgProjectIds = projects.map(p => p.id);
  const eqcs = db.eqcs.filter(e => orgProjectIds.includes(e.project_id));
  const issues = db.issues.filter(i => orgProjectIds.includes(i.project_id));

  // Recent activity stream
  const activities = [
    {
      id: 'act-1',
      title: 'EQC Inspection Passed',
      details: 'Slab Pour inspection cleared for 14th Floor Flat 1402',
      user: 'Mayuresh Jadhav',
      timestamp: '10 minutes ago',
      type: 'eqc',
    },
    {
      id: 'act-2',
      title: 'New Issue Logged',
      details: 'High severity: Column C14 starter plumb offset deviation > 6mm',
      user: 'Sarvesh Gupta',
      timestamp: '1 hour ago',
      type: 'issue',
    },
    {
      id: 'act-3',
      title: 'Structural Drawing Updated',
      details: 'Document DWG-AUR-STR-SLB-1400 Revision R2 registered',
      user: 'Pankti Mehta',
      timestamp: '3 hours ago',
      type: 'register',
    },
    {
      id: 'act-4',
      title: 'Checklist Template Modified',
      details: 'Added conditional slump threshold checkpoint to Beam & Slab Checking',
      user: 'Sarvesh Gupta',
      timestamp: 'Yesterday at 16:45',
      type: 'checklist',
    },
  ];

  return res.json({
    stats: {
      total_projects: projects.length,
      active_projects: projects.filter(p => p.status === 'active').length,
      active_checklists: checklists.filter(c => c.status === 'active').length,
      total_teams: teams.length,
      total_eqcs: eqcs.length,
      passed_eqcs: eqcs.filter(e => e.status === 'passed').length,
      open_issues: issues.filter(i => i.status === 'open' || i.status === 'in_progress').length,
      critical_issues: issues.filter(i => i.severity === 'critical' && i.status !== 'closed').length,
    },
    recent_projects: projects.slice(0, 5),
    recent_activities: activities,
    compliance_rate: 94.2,
  });
});

export default router;
