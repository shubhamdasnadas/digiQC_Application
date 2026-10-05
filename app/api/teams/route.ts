import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { orgQuery } from '@/lib/db';
import { ensureMemberSchema } from '@/lib/memberSchema';

export async function GET(request: NextRequest) {
  const { payload, response } = requireAuth(request);
  if (!payload) return response;

  await ensureMemberSchema();

  try {
    const { rows } = await orgQuery(payload.orgId!, 'SELECT * FROM teams ORDER BY created_at DESC');
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { payload, response } = requireAuth(request);
  if (!payload) return response;

  await ensureMemberSchema();

  try {
    const body = await request.json();
    const rows = body.rows ?? [body];

    if (body.replace) {
      await orgQuery(payload.orgId!, 'DELETE FROM teams');
    }

    for (const row of rows) {
      const name = String(row.name || row['Name'] || row['team_name'] || row['Team Name'] || '').trim();
      if (!name) continue;

      const type = String(row.type || row['Type'] || 'developer').trim();
      const team_lead_name = String(row.team_lead_name || row['Team Lead Name'] || row['Team Lead'] || row['team_lead'] || '').trim();
      const spoc_name = String(row.spoc_name || row['SPOC Name'] || row['SPOC'] || row['spoc'] || '').trim();
      const usersStr = String(row.users || row['Users'] || row['Members'] || row['members'] || '').trim();
      const active_projects = String(row.active_projects || row['Active Assigned Projects'] || row['Active Projects'] || '').trim();
      const inactive_projects = String(row.inactive_projects || row['Inactive Assigned Projects'] || row['Inactive Projects'] || '').trim();

      // Check if team already exists by name (case-insensitive)
      const { rows: existingRows } = await orgQuery(payload.orgId!,
        `SELECT id, name, type, team_lead_name, spoc_name, active_projects, inactive_projects
         FROM teams
         WHERE LOWER(TRIM(name)) = LOWER(TRIM($1))`,
        [name]
      );

      if (existingRows.length > 0) {
        // Team exists: update details without inserting duplicate
        const existing = existingRows[0];
        const updatedType = type || existing.type || 'developer';
        const updatedTeamLead = team_lead_name || existing.team_lead_name || '';
        const updatedSpoc = spoc_name || existing.spoc_name || '';
        const updatedActiveProjects = active_projects !== '' ? active_projects : (existing.active_projects || '');
        const updatedInactiveProjects = inactive_projects !== '' ? inactive_projects : (existing.inactive_projects || '');

        await orgQuery(payload.orgId!,
          `UPDATE teams
           SET name = $1,
               type = $2,
               team_lead_name = $3,
               spoc_name = $4,
               active_projects = $5,
               inactive_projects = $6,
               updated_at = NOW()
           WHERE id = $7`,
          [
            name,
            updatedType,
            updatedTeamLead,
            updatedSpoc,
            updatedActiveProjects,
            updatedInactiveProjects,
            existing.id
          ]
        );
      } else {
        // Team does not exist: insert new record
        await orgQuery(payload.orgId!,
          `INSERT INTO teams (
             organization_id, name, type, team_lead_name, spoc_name,
             active_projects, inactive_projects, created_at, updated_at
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
          [
            payload.orgId,
            name,
            type || 'developer',
            team_lead_name,
            spoc_name,
            active_projects,
            inactive_projects,
          ]
        );
      }

      // If users are supplied for this team, link them in the members table
      if (usersStr) {
        const userNames = usersStr.split(',').map((u: string) => u.trim()).filter(Boolean);
        for (const uName of userNames) {
          const { rows: existingMember } = await orgQuery(payload.orgId!,
            `SELECT id, teams, active_projects, inactive_projects FROM members WHERE LOWER(TRIM(name)) = LOWER(TRIM($1))`,
            [uName]
          );
          if (existingMember.length > 0) {
            const m = existingMember[0];
            const currentTeams = (m.teams || '').split(',').map((s: string) => s.trim()).filter(Boolean);
            if (!currentTeams.some((t: string) => t.toLowerCase() === name.toLowerCase())) {
              currentTeams.push(name);
              await orgQuery(payload.orgId!,
                `UPDATE members SET teams = $1, updated_at = NOW() WHERE id = $2`,
                [currentTeams.join(', '), m.id]
              );
            }
          } else {
            await orgQuery(payload.orgId!,
              `INSERT INTO members (organization_id, name, teams, active_projects, inactive_projects, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
              [payload.orgId, uName, name, active_projects, inactive_projects]
            );
          }
        }
      }
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const { payload, response } = requireAuth(request);
  if (!payload) return response;

  await ensureMemberSchema();

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Team ID is required' }, { status: 400 });
    }

    const body = await request.json();

    await orgQuery(payload.orgId!,
      `UPDATE teams
       SET name = $1, type = $2, team_lead_name = $3, spoc_name = $4, updated_at = NOW()
       WHERE id = $5`,
      [
        body.name,
        body.type ?? 'developer',
        body.team_lead_name ?? '',
        body.spoc_name ?? '',
        id,
      ]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { payload, response } = requireAuth(request);
  if (!payload) return response;

  await ensureMemberSchema();

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      await orgQuery(payload.orgId!, 'DELETE FROM teams WHERE id = $1', [id]);
    } else {
      await orgQuery(payload.orgId!, 'DELETE FROM teams');
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
