import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, signPasswordSetupToken } from '@/lib/auth';
import { orgQuery } from '@/lib/db';
import { ensureMemberSchema } from '@/lib/memberSchema';
import { sendPasswordSetupEmail } from '@/lib/email';
import { getBaseUrl } from '@/lib/network';

export async function GET(request: NextRequest) {
  const { payload, response } = requireAuth(request);
  if (!payload) return response;

  await ensureMemberSchema();

  try {
    const { rows } = await orgQuery(
      payload.orgId!,
      `SELECT m.*,
         CASE
           WHEN m.active = false THEN 'Inactive'
           WHEN LOWER(COALESCE(m.status, 'pending')) = 'pending' THEN 'Pending'
           WHEN u.password_hash IS NOT NULL AND LENGTH(TRIM(u.password_hash)) > 10 THEN 'Active'
           WHEN m.status IS NOT NULL AND LOWER(m.status) = 'active' THEN 'Active'
           ELSE 'Pending'
         END as status
       FROM members m
       LEFT JOIN public.users u ON LOWER(TRIM(m.email)) = LOWER(TRIM(u.email))
       ORDER BY m.created_at DESC`
    );
    return NextResponse.json(rows);
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
      return NextResponse.json({ error: 'Member ID is required' }, { status: 400 });
    }

    const body = await request.json();

    const { rows: existingRows } = await orgQuery(payload.orgId!,
      `SELECT * FROM members WHERE id = $1`,
      [id]
    );

    if (existingRows.length === 0) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    const existing = existingRows[0];
    const name = body.name ? String(body.name).trim() : existing.name;
    const email = body.email !== undefined ? String(body.email).trim() : existing.email;
    const phone = body.phone !== undefined ? String(body.phone).trim() : existing.phone;
    const defaultRole = body.default_role !== undefined ? String(body.default_role).trim() : (body.role !== undefined ? String(body.role).trim() : existing.default_role);
    const teams = body.teams !== undefined ? String(body.teams).trim() : existing.teams;
    const accessType = body.access_type !== undefined ? String(body.access_type).trim() : existing.access_type;
    const active = body.active !== undefined ? !!body.active : existing.active;
    const activeProjects = body.active_projects !== undefined ? String(body.active_projects).trim() : existing.active_projects;
    const inactiveProjects = body.inactive_projects !== undefined ? String(body.inactive_projects).trim() : existing.inactive_projects;

    // Reset member status to pending until the user verifies/updates their password via the sent email link
    const newStatus = 'pending';

    await orgQuery(payload.orgId!,
      `UPDATE members
       SET name = $1,
           email = $2,
           phone = $3,
           default_role = $4,
           teams = $5,
           access_type = $6,
           active = $7,
           active_projects = $8,
           inactive_projects = $9,
           status = $10,
           updated_at = NOW()
       WHERE id = $11`,
      [
        name,
        email,
        phone,
        defaultRole,
        teams,
        accessType,
        active,
        activeProjects,
        inactiveProjects,
        newStatus,
        id
      ]
    );

    const targetEmail = (email || existing.email || '').toLowerCase().trim();
    let emailSent = false;
    let emailSentTo: string | null = null;

    if (targetEmail && targetEmail.includes('@')) {
      try {
        const token = signPasswordSetupToken(targetEmail, id);
        const setupLink = `${getBaseUrl(request)}/setpassword?token=${encodeURIComponent(token)}&email=${encodeURIComponent(targetEmail)}`;
        await sendPasswordSetupEmail(targetEmail, name, setupLink, true);
        emailSent = true;
        emailSentTo = targetEmail;
      } catch (mailErr) {
        console.error('Failed to send password setup email on edit member:', mailErr);
      }
    }

    return NextResponse.json({
      success: true,
      emailSent,
      emailSentTo,
    });
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
      await orgQuery(payload.orgId!, 'DELETE FROM members');
    }

    for (const row of rows) {
      if (!row.name || !String(row.name).trim()) continue;

      const name = String(row.name).trim();
      const email = row.email ? String(row.email).trim() : '';
      const phone = row.phone ? String(row.phone).trim() : '';
      const accessType = row.access_type ? String(row.access_type).trim() : 'Paid';
      const active = row.active !== undefined ? !!row.active : true;
      const defaultRole = row.default_role ? String(row.default_role).trim() : 'User';
      const teams = row.teams ? String(row.teams).trim() : '';
      const activeProjects = row.active_projects ? String(row.active_projects).trim() : '';
      const inactiveProjects = row.inactive_projects ? String(row.inactive_projects).trim() : '';

      // Check if member already exists (match by email, then phone, then name)
      let existingRows: any[] = [];
      if (email) {
        const res = await orgQuery(payload.orgId!,
          `SELECT id, name, email, phone, access_type, active, default_role, teams, active_projects, inactive_projects
           FROM members
           WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))`,
          [email]
        );
        existingRows = res.rows;
      }

      if (existingRows.length === 0 && phone) {
        const cleanPhone = phone.replace(/\s+/g, '');
        const res = await orgQuery(payload.orgId!,
          `SELECT id, name, email, phone, access_type, active, default_role, teams, active_projects, inactive_projects
           FROM members
           WHERE TRIM(phone) = TRIM($1) OR REPLACE(TRIM(phone), ' ', '') = $2`,
          [phone, cleanPhone]
        );
        existingRows = res.rows;
      }

      if (existingRows.length === 0 && name) {
        const res = await orgQuery(payload.orgId!,
          `SELECT id, name, email, phone, access_type, active, default_role, teams, active_projects, inactive_projects
           FROM members
           WHERE LOWER(TRIM(name)) = LOWER(TRIM($1))`,
          [name]
        );
        existingRows = res.rows;
      }

      if (existingRows.length > 0) {
        // Only update the existing member record without inserting duplicate
        const existing = existingRows[0];
        const updatedEmail = email || existing.email || '';
        const updatedPhone = phone || existing.phone || '';
        const updatedAccessType = accessType || existing.access_type || 'Paid';
        const updatedRole = defaultRole || existing.default_role || 'User';
        const updatedTeams = teams || existing.teams || '';
        const updatedActiveProjects = activeProjects || existing.active_projects || '';
        const updatedInactiveProjects = inactiveProjects || existing.inactive_projects || '';

        await orgQuery(payload.orgId!,
          `UPDATE members
           SET name = $1,
               email = $2,
               phone = $3,
               access_type = $4,
               active = $5,
               default_role = $6,
               teams = $7,
               active_projects = $8,
               inactive_projects = $9,
               updated_at = NOW()
           WHERE id = $10`,
          [
            name,
            updatedEmail,
            updatedPhone,
            updatedAccessType,
            active,
            updatedRole,
            updatedTeams,
            updatedActiveProjects,
            updatedInactiveProjects,
            existing.id
          ]
        );
      } else {
        // Insert new member
        await orgQuery(payload.orgId!,
          `INSERT INTO members (
             organization_id, name, email, phone, access_type, active, status,
             default_role, teams, active_projects, inactive_projects,
             created_at, updated_at
           )
           VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8, $9, $10, NOW(), NOW())`,
          [
            payload.orgId,
            name,
            email,
            phone,
            accessType,
            active,
            defaultRole,
            teams,
            activeProjects,
            inactiveProjects,
          ]
        );
      }

      // Automatically register any referenced teams in the teams table if not already present
      if (teams) {
        const teamNames = teams.split(',').map((t: string) => t.trim()).filter(Boolean);
        for (const tName of teamNames) {
          const { rows: existingTeam } = await orgQuery(payload.orgId!,
            `SELECT id FROM teams WHERE LOWER(TRIM(name)) = LOWER(TRIM($1))`,
            [tName]
          );
          if (existingTeam.length === 0) {
            await orgQuery(payload.orgId!,
              `INSERT INTO teams (organization_id, name, type, active_projects, inactive_projects, created_at, updated_at)
               VALUES ($1, $2, 'inspection', $3, $4, NOW(), NOW())`,
              [payload.orgId, tName, activeProjects, inactiveProjects]
            );
          }
        }
      }
    }

    let emailSent = false;
    let emailSentTo: string | null = null;

    // Send password setup email if single member was added with an email
    if (rows.length === 1 && rows[0].email && String(rows[0].email).trim().includes('@')) {
      const email = String(rows[0].email).trim();
      const name = String(rows[0].name || '').trim() || 'User';
      try {
        const token = signPasswordSetupToken(email);
        const setupLink = `${getBaseUrl(request)}/setpassword?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
        await sendPasswordSetupEmail(email, name, setupLink, false);
        emailSent = true;
        emailSentTo = email;
      } catch (mailErr) {
        console.error('Failed to send password setup email on add member:', mailErr);
      }
    }

    return NextResponse.json({
      success: true,
      emailSent,
      emailSentTo,
    });
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
      await orgQuery(payload.orgId!, 'DELETE FROM members WHERE id = $1', [id]);
    } else {
      await orgQuery(payload.orgId!, 'DELETE FROM members');
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
