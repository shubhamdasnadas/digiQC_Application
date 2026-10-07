import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { orgQuery } from '@/lib/db';
import { touchProject } from '@/lib/projects';

interface RouteContext { params: Promise<{ id: string }>; }

/**
 * GET /api/projects/[id]/members
 * Returns the project's members (joined with name/email from the org's members roster).
 */
export async function GET(request: NextRequest, ctx: RouteContext) {
  const { payload, response } = requireAuth(request);
  if (!payload) return response;
  const { id } = await ctx.params;
  try {
    const { rows } = await orgQuery(
      payload.orgId!,
      `SELECT pm.id, pm.project_id, pm.user_id, pm.role, pm.added_at,
              m.name AS user_name, m.email AS user_email, m.teams AS user_teams
       FROM project_members pm
       JOIN members m ON m.id = pm.user_id
       WHERE pm.project_id = $1
       ORDER BY pm.added_at`,
      [id]
    );
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

/**
 * POST /api/projects/[id]/members
 * Body: { rows: [{ user_id, role }] } — user_id refers to members.id.
 * Idempotent — ON CONFLICT updates the role.
 */
export async function POST(request: NextRequest, ctx: RouteContext) {
  const { payload, response } = requireAuth(request);
  if (!payload) return response;
  const { id } = await ctx.params;
  try {
    const body = await request.json();
    const rows = body.rows ?? [body];
    for (const r of rows) {
      if (!r.user_id) continue;
      await orgQuery(
        payload.orgId!,
        `INSERT INTO project_members (project_id, user_id, role)
         VALUES ($1,$2,$3)
         ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
        [id, r.user_id, r.role ?? 'member']
      );

      // Directly auto-sync team(s) belonging to this member to the project's teams
      try {
        const { rows: memberRows } = await orgQuery(
          payload.orgId!,
          `SELECT teams FROM members WHERE id = $1`,
          [r.user_id]
        );
        if (memberRows.length > 0 && memberRows[0].teams) {
          const teamNames = String(memberRows[0].teams)
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean);

          for (const teamName of teamNames) {
            // Find existing team in teams table or create it
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
        console.warn('Could not auto-sync member teams:', syncErr);
      }
    }
    await touchProject(payload.orgId!, id, payload.userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

/**
 * DELETE /api/projects/[id]/members?user_id=...
 */
export async function DELETE(request: NextRequest, ctx: RouteContext) {
  const { payload, response } = requireAuth(request);
  if (!payload) return response;
  const { id } = await ctx.params;
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    if (!userId) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
    await orgQuery(
      payload.orgId!,
      `DELETE FROM project_members WHERE project_id = $1 AND user_id = $2`,
      [id, userId]
    );
    await touchProject(payload.orgId!, id, payload.userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
