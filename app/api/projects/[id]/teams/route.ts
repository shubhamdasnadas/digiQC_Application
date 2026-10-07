import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { orgQuery } from '@/lib/db';
import { touchProject } from '@/lib/projects';

interface RouteContext { params: Promise<{ id: string }>; }

/**
 * GET /api/projects/[id]/teams
 * Returns the teams assigned to the project.
 */
export async function GET(request: NextRequest, ctx: RouteContext) {
  const { payload, response } = requireAuth(request);
  if (!payload) return response;
  const { id } = await ctx.params;
  try {
    // 1. Auto-sync any teams from currently assigned project members
    try {
      const { rows: projectMembers } = await orgQuery(
        payload.orgId!,
        `SELECT m.id, m.name, m.teams
         FROM project_members pm
         JOIN members m ON m.id = pm.user_id
         WHERE pm.project_id = $1`,
        [id]
      );

      for (const m of projectMembers) {
        if (!m.teams) continue;
        const teamNames = String(m.teams)
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean);

        for (const teamName of teamNames) {
          const { rows: existingTeams } = await orgQuery(
            payload.orgId!,
            `SELECT id FROM teams WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) LIMIT 1`,
            [teamName]
          );

          let teamId = existingTeams[0]?.id;
          if (!teamId) {
            const { rows: newTeam } = await orgQuery(
              payload.orgId!,
              `INSERT INTO teams (organization_id, name, type)
               VALUES ($1, $2, 'inspection')
               RETURNING id`,
              [payload.orgId, teamName]
            );
            teamId = newTeam[0]?.id;
          }

          if (teamId) {
            await orgQuery(
              payload.orgId!,
              `INSERT INTO project_teams (project_id, team_id)
               VALUES ($1, $2)
               ON CONFLICT (project_id, team_id) DO NOTHING`,
              [id, teamId]
            );
          }
        }
      }
    } catch (syncErr) {
      console.warn('Error syncing member teams in GET /api/projects/[id]/teams:', syncErr);
    }

    // 2. Fetch all linked teams for the project
    const { rows } = await orgQuery(
      payload.orgId!,
      `SELECT pt.id, pt.project_id, pt.team_id, pt.added_at,
              pt.assigned_checklist, pt.assigned_user,
              t.name AS team_name, t.type AS team_type,
              t.team_lead_name, t.spoc_name
       FROM project_teams pt
       JOIN teams t ON t.id = pt.team_id
       WHERE pt.project_id = $1
       ORDER BY pt.added_at`,
      [id]
    );

    // 3. For each team, resolve the assigned project users who belong to this team
    const { rows: allProjectMembers } = await orgQuery(
      payload.orgId!,
      `SELECT m.id, m.name, m.teams
       FROM project_members pm
       JOIN members m ON m.id = pm.user_id
       WHERE pm.project_id = $1`,
      [id]
    );

    const enrichedRows = rows.map((r: any) => {
      const matchingMembers = allProjectMembers.filter((m: any) => {
        if (!m.teams) return false;
        const memberTeamNames = String(m.teams)
          .split(',')
          .map((s) => s.trim().toLowerCase());
        return memberTeamNames.includes((r.team_name || '').trim().toLowerCase());
      });

      const memberNames = Array.from(new Set(matchingMembers.map((m: any) => m.name).filter(Boolean)));
      const dynamicAssignedUser = memberNames.length > 0 ? memberNames.join(', ') : (r.assigned_user || '');

      return {
        ...r,
        assigned_user: dynamicAssignedUser,
      };
    });

    return NextResponse.json(enrichedRows);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest, ctx: RouteContext) {
  const { payload, response } = requireAuth(request);
  if (!payload) return response;
  const { id } = await ctx.params;
  try {
    const body = await request.json();
    const rows = body.rows ?? [body];
    for (const r of rows) {
      if (!r.team_id) continue;
      await orgQuery(
        payload.orgId!,
        `INSERT INTO project_teams (project_id, team_id)
         VALUES ($1,$2)
         ON CONFLICT (project_id, team_id) DO NOTHING`,
        [id, r.team_id]
      );
    }
    await touchProject(payload.orgId!, id, payload.userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, ctx: RouteContext) {
  const { payload, response } = requireAuth(request);
  if (!payload) return response;
  const { id } = await ctx.params;
  try {
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('team_id');
    if (!teamId) return NextResponse.json({ error: 'Missing team_id' }, { status: 400 });
    await orgQuery(
      payload.orgId!,
      `DELETE FROM project_teams WHERE project_id = $1 AND team_id = $2`,
      [id, teamId]
    );
    await touchProject(payload.orgId!, id, payload.userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
