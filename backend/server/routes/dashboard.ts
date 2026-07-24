import { Router, Request, Response } from 'express';
import { pool, orgSchema } from '../pool';
import { getUserFromHeader } from './auth';

const router = Router();

// GET /api/dashboard - stats & recent activities
router.get('/', async (req: Request, res: Response) => {
  const auth = await getUserFromHeader(req);
  if (!auth.currentOrg) {
    return res.json({
      stats: {
        total_projects: 0, active_projects: 0, active_checklists: 0, total_teams: 0,
        total_eqcs: 0, passed_eqcs: 0, open_issues: 0, critical_issues: 0,
      },
      recent_projects: [],
      recent_activities: [],
      compliance_rate: 0,
    });
  }

  const schema = await orgSchema(auth.currentOrg.id);

  const { rows: projects } = await pool.query(`SELECT * FROM "${schema}".projects ORDER BY created_at DESC`);
  const { rows: teamCount } = await pool.query(`SELECT count(*)::int AS n FROM "${schema}".teams`);
  const { rows: checklistCount } = await pool.query(
    `SELECT count(*)::int AS n FROM "${schema}".checklists WHERE status IN ('active', 'live')`
  );
  const { rows: eqcRows } = await pool.query(
    `SELECT e.status FROM "${schema}".eqcs e JOIN "${schema}".projects p ON p.id = e.project_id`
  );
  const { rows: issueRows } = await pool.query(
    `SELECT i.status, i.severity FROM "${schema}".issues i JOIN "${schema}".projects p ON p.id = i.project_id`
  );

  const { rows: activities } = await pool.query(
    `SELECT 'eqc' AS type, e.id, e.location AS title, e.status, e.created_at, p.name AS project_name, u.name AS user_name
     FROM "${schema}".eqcs e
     JOIN "${schema}".projects p ON p.id = e.project_id
     LEFT JOIN public.users u ON u.id = e.inspected_by
     UNION ALL
     SELECT 'issue' AS type, i.id, i.title, i.status, i.created_at, p.name AS project_name, u.name AS user_name
     FROM "${schema}".issues i
     JOIN "${schema}".projects p ON p.id = i.project_id
     LEFT JOIN public.users u ON u.id = i.reported_by
     ORDER BY created_at DESC
     LIMIT 6`
  );

  const passedEqcs = eqcRows.filter((e: any) => e.status === 'passed').length;

  return res.json({
    stats: {
      total_projects: projects.length,
      active_projects: projects.filter((p: any) => p.status === 'active').length,
      active_checklists: checklistCount[0].n,
      total_teams: teamCount[0].n,
      total_eqcs: eqcRows.length,
      passed_eqcs: passedEqcs,
      open_issues: issueRows.filter((i: any) => i.status === 'open' || i.status === 'in_progress').length,
      critical_issues: issueRows.filter((i: any) => i.severity === 'critical' && i.status !== 'closed').length,
    },
    recent_projects: projects.slice(0, 5),
    recent_activities: activities.map((a: any) => ({
      id: a.id,
      title: a.type === 'eqc' ? `EQC Inspection: ${a.status}` : `Issue Logged: ${a.status}`,
      details: `${a.title} — ${a.project_name}`,
      user: a.user_name || 'Unknown',
      timestamp: a.created_at,
      type: a.type,
    })),
    compliance_rate: eqcRows.length ? Math.round((passedEqcs / eqcRows.length) * 1000) / 10 : 0,
  });
});

export default router;
