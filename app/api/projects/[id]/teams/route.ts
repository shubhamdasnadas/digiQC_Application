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
               VALUES ($1, $2, 'DEFAULT')
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
       ORDER BY pt.added_at DESC`,
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
      let teamId = r.team_id;
      let teamName = r.team_name ? String(r.team_name).trim() : '';
      const teamType = r.team_type ? String(r.team_type).trim().toUpperCase() : 'DEFAULT';

      // 1. Resolve or create team if not existing
      if (!teamId && teamName) {
        const { rows: existingTeams } = await orgQuery(
          payload.orgId!,
          `SELECT id, name FROM teams WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) LIMIT 1`,
          [teamName]
        );
        if (existingTeams.length > 0) {
          teamId = existingTeams[0].id;
          teamName = existingTeams[0].name;
        } else {
          const { rows: newTeam } = await orgQuery(
            payload.orgId!,
            `INSERT INTO teams (organization_id, name, type)
             VALUES ($1, $2, $3)
             RETURNING id, name`,
            [payload.orgId, teamName, teamType]
          );
          teamId = newTeam[0]?.id;
          teamName = newTeam[0]?.name || teamName;
        }
      } else if (teamId && !teamName) {
        const { rows: teamRow } = await orgQuery(
          payload.orgId!,
          `SELECT name FROM teams WHERE id = $1 LIMIT 1`,
          [teamId]
        );
        if (teamRow.length > 0) {
          teamName = teamRow[0].name;
        }
      }

      if (!teamId) continue;

      // 2. Format assigned_checklist
      let assignedChecklist = '';
      if (Array.isArray(r.assigned_checklist)) {
        assignedChecklist = r.assigned_checklist.map((s: string) => String(s).trim()).filter(Boolean).join(', ');
      } else if (typeof r.assigned_checklist === 'string') {
        assignedChecklist = r.assigned_checklist.trim();
      }

      // 3. Process new inline user creation if requested
      const addedUserNames: string[] = [];
      if (r.new_user && r.new_user.name && String(r.new_user.name).trim()) {
        const nuName = String(r.new_user.name).trim();
        const nuEmail = r.new_user.email ? String(r.new_user.email).trim() : '';
        const nuPhone = r.new_user.phone ? String(r.new_user.phone).trim() : '';
        const nuRole = r.new_user.role ? String(r.new_user.role).trim() : 'User';

        // Check if member already exists
        const { rows: existingMem } = await orgQuery(
          payload.orgId!,
          `SELECT id, teams FROM members WHERE (email != '' AND LOWER(email) = LOWER($1)) OR (phone != '' AND phone = $2) LIMIT 1`,
          [nuEmail || '__none__', nuPhone || '__none__']
        );

        let memberId: string;
        if (existingMem.length > 0) {
          memberId = existingMem[0].id;
          const currentTeams = existingMem[0].teams
            ? String(existingMem[0].teams).split(',').map((t) => t.trim()).filter(Boolean)
            : [];
          if (teamName && !currentTeams.some((t) => t.toLowerCase() === teamName.toLowerCase())) {
            currentTeams.push(teamName);
            await orgQuery(
              payload.orgId!,
              `UPDATE members SET teams = $1, updated_at = NOW() WHERE id = $2`,
              [currentTeams.join(', '), memberId]
            );
          }
        } else {
          const { rows: createdMem } = await orgQuery(
            payload.orgId!,
            `INSERT INTO members (organization_id, name, email, phone, default_role, teams, active)
             VALUES ($1, $2, $3, $4, $5, $6, true)
             RETURNING id`,
            [payload.orgId, nuName, nuEmail, nuPhone, nuRole, teamName]
          );
          memberId = createdMem[0]?.id;
        }

        if (memberId) {
          await orgQuery(
            payload.orgId!,
            `INSERT INTO project_members (project_id, user_id, role)
             VALUES ($1, $2, 'member')
             ON CONFLICT (project_id, user_id) DO NOTHING`,
            [id, memberId]
          );
          addedUserNames.push(nuName);
        }
      }

      // 4. Process existing user_ids assigned in Step 2
      const userIds: string[] = Array.isArray(r.user_ids)
        ? r.user_ids
        : r.user_id
        ? [r.user_id]
        : [];

      for (const uId of userIds) {
        if (!uId) continue;
        await orgQuery(
          payload.orgId!,
          `INSERT INTO project_members (project_id, user_id, role)
           VALUES ($1, $2, 'member')
           ON CONFLICT (project_id, user_id) DO NOTHING`,
          [id, uId]
        );

        // Ensure member's teams field has this team
        const { rows: memRow } = await orgQuery(
          payload.orgId!,
          `SELECT id, name, teams FROM members WHERE id = $1 LIMIT 1`,
          [uId]
        );
        if (memRow.length > 0) {
          if (memRow[0].name) addedUserNames.push(memRow[0].name);
          const currentTeams = memRow[0].teams
            ? String(memRow[0].teams).split(',').map((t) => t.trim()).filter(Boolean)
            : [];
          if (teamName && !currentTeams.some((t) => t.toLowerCase() === teamName.toLowerCase())) {
            currentTeams.push(teamName);
            await orgQuery(
              payload.orgId!,
              `UPDATE members SET teams = $1, updated_at = NOW() WHERE id = $2`,
              [currentTeams.join(', '), uId]
            );
          }
        }
      }

      // 5. Build assigned_user string
      let assignedUser = r.assigned_user ? String(r.assigned_user).trim() : '';
      if (addedUserNames.length > 0) {
        const combined = Array.from(
          new Set([
            ...assignedUser.split(',').map((s) => s.trim()).filter(Boolean),
            ...addedUserNames,
          ])
        );
        assignedUser = combined.join(', ');
      }

      // 6. Link to project_teams
      await orgQuery(
        payload.orgId!,
        `INSERT INTO project_teams (project_id, team_id, assigned_checklist, assigned_user)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (project_id, team_id)
         DO UPDATE SET
           assigned_checklist = CASE WHEN EXCLUDED.assigned_checklist != '' THEN EXCLUDED.assigned_checklist ELSE project_teams.assigned_checklist END,
           assigned_user = CASE WHEN EXCLUDED.assigned_user != '' THEN EXCLUDED.assigned_user ELSE project_teams.assigned_user END`,
        [id, teamId, assignedChecklist, assignedUser]
      );
    }

    await touchProject(payload.orgId!, id, payload.userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, ctx: RouteContext) {
  const { payload, response } = requireAuth(request);
  if (!payload) return response;
  const { id } = await ctx.params;
  try {
    const { searchParams } = new URL(request.url);
    const teamIdParam = searchParams.get('team_id');
    const body = await request.json();

    const teamId = teamIdParam || body.team_id;
    if (!teamId) {
      return NextResponse.json({ error: 'Missing team_id' }, { status: 400 });
    }

    // 1. Update team type if provided
    if (body.team_type) {
      await orgQuery(
        payload.orgId!,
        `UPDATE teams SET type = $1, updated_at = NOW() WHERE id = $2`,
        [String(body.team_type).trim().toUpperCase(), teamId]
      );
    }

    // 2. Format assigned_checklist
    let assignedChecklist = body.assigned_checklist;
    if (Array.isArray(assignedChecklist)) {
      assignedChecklist = assignedChecklist.map((s: string) => String(s).trim()).filter(Boolean).join(', ');
    }

    // 3. Process user assignments if provided
    if (body.user_ids && Array.isArray(body.user_ids)) {
      const { rows: teamRow } = await orgQuery(
        payload.orgId!,
        `SELECT name FROM teams WHERE id = $1 LIMIT 1`,
        [teamId]
      );
      const teamName = teamRow[0]?.name || '';

      for (const uId of body.user_ids) {
        if (!uId) continue;
        await orgQuery(
          payload.orgId!,
          `INSERT INTO project_members (project_id, user_id, role)
           VALUES ($1, $2, 'member')
           ON CONFLICT (project_id, user_id) DO NOTHING`,
          [id, uId]
        );

        if (teamName) {
          const { rows: memRow } = await orgQuery(
            payload.orgId!,
            `SELECT teams FROM members WHERE id = $1 LIMIT 1`,
            [uId]
          );
          if (memRow.length > 0) {
            const currentTeams = memRow[0].teams
              ? String(memRow[0].teams).split(',').map((t) => t.trim()).filter(Boolean)
              : [];
            if (!currentTeams.some((t) => t.toLowerCase() === teamName.toLowerCase())) {
              currentTeams.push(teamName);
              await orgQuery(
                payload.orgId!,
                `UPDATE members SET teams = $1, updated_at = NOW() WHERE id = $2`,
                [currentTeams.join(', '), uId]
              );
            }
          }
        }
      }
    }

    // 4. Update project_teams
    await orgQuery(
      payload.orgId!,
      `UPDATE project_teams
       SET assigned_checklist = COALESCE($1, assigned_checklist),
           assigned_user = COALESCE($2, assigned_user)
       WHERE project_id = $3 AND team_id = $4`,
      [
        assignedChecklist !== undefined ? assignedChecklist : null,
        body.assigned_user !== undefined ? body.assigned_user : null,
        id,
        teamId,
      ]
    );

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
