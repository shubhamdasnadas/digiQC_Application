import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { orgQuery } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { payload, response } = requireAuth(request);
  if (!payload) return response;

  try {
    const [projectCount, checklistCount, teamCount, recentProjects, teams, checklists] =
      await Promise.all([
        orgQuery(payload.orgId!, 'SELECT COUNT(*) FROM projects'),
        orgQuery(payload.orgId!, 'SELECT COUNT(*) FROM checklists'),
        orgQuery(payload.orgId!, 'SELECT COUNT(*) FROM teams'),
        orgQuery(payload.orgId!, 'SELECT * FROM projects ORDER BY created_at DESC LIMIT 5'),
        orgQuery(payload.orgId!, 'SELECT * FROM teams LIMIT 5'),
        orgQuery(payload.orgId!, 'SELECT * FROM checklists LIMIT 5'),
      ]);

    return NextResponse.json({
      stats: {
        projects: parseInt(projectCount.rows[0].count),
        checklists: parseInt(checklistCount.rows[0].count),
        teams: parseInt(teamCount.rows[0].count),
      },
      recentProjects: recentProjects.rows,
      teams: teams.rows,
      checklists: checklists.rows,
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
