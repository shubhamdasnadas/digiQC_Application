import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { orgQuery } from '@/lib/db';

const isValidUuid = (val: any): boolean =>
  typeof val === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

/**
 * GET /api/projects
 * Query params:
 *   q       — search name / code / client_name
 *   status  — all | active | completed | on_hold
 *   id      — when set, returns a single project with joined data
 */
export async function GET(request: NextRequest) {
  const { payload, response } = requireAuth(request);
  if (!payload) return response;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const q = searchParams.get('q')?.toLowerCase().trim() ?? '';
    const status = searchParams.get('status') ?? 'all';

    // Single project fetch — joined with member count & admin info
    if (id) {
      const { rows } = await orgQuery(
        payload.orgId!,
        `SELECT p.*,
                u.name AS project_admin_name,
                u.email AS project_admin_email,
                up.name AS updated_by_name,
                (SELECT COUNT(*)::int FROM project_members pm WHERE pm.project_id = p.id) AS member_count,
                (SELECT m.name FROM project_members pm
                  JOIN members m ON m.id = pm.user_id
                  WHERE pm.project_id = p.id ORDER BY pm.added_at LIMIT 1) AS first_member_name
         FROM projects p
         LEFT JOIN users u ON u.id = p.project_admin_id
         LEFT JOIN users up ON up.id = p.updated_by
         WHERE p.id = $1
         LIMIT 1`,
        [id]
      );
      if (rows.length === 0) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }
      return NextResponse.json(rows[0]);
    }

    // List — with optional search + status filter
    const params: any[] = [];
    const whereClauses: string[] = [];

    if (status !== 'all') {
      params.push(status);
      whereClauses.push(`p.status = $${params.length}`);
    }
    if (q) {
      params.push(`%${q}%`);
      const i = params.length;
      whereClauses.push(`(LOWER(p.name) LIKE $${i} OR LOWER(COALESCE(p.unique_code,'')) LIKE $${i} OR LOWER(COALESCE(p.client_name,'')) LIKE $${i} OR LOWER(COALESCE(p.nomenclature,'')) LIKE $${i})`);
    }

    const where = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const { rows } = await orgQuery(
      payload.orgId ?? null,
      `SELECT p.*,
              u.name AS project_admin_name,
              u.email AS project_admin_email,
              up.name AS updated_by_name,
              (SELECT COUNT(*)::int FROM project_members pm WHERE pm.project_id = p.id) AS member_count,
              (SELECT m.name FROM project_members pm
                JOIN members m ON m.id = pm.user_id
                WHERE pm.project_id = p.id ORDER BY pm.added_at LIMIT 1) AS first_member_name
       FROM projects p
       LEFT JOIN users u ON u.id = p.project_admin_id
       LEFT JOIN users up ON up.id = p.updated_by
       ${where}
       ORDER BY p.created_at DESC`,
      params
    );
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

/**
 * POST /api/projects
 * Body: single project object OR { rows: [...] } for bulk insert (used by import)
 */
export async function POST(request: NextRequest) {
  const { payload, response } = requireAuth(request);
  if (!payload) return response;

  try {
    const body = await request.json();
    const rows = body.rows ?? [body];

    for (const r of rows) {
      if (!r.name || !String(r.name).trim()) continue;

      const orgId = isValidUuid(payload.orgId) ? payload.orgId : null;
      const adminId = isValidUuid(r.project_admin_id) ? r.project_admin_id : null;
      const userId = isValidUuid(payload.userId) ? payload.userId : null;

      const { rows: inserted } = await orgQuery(
        payload.orgId ?? null,
        `INSERT INTO projects (
            organization_id, name, unique_code, client_name, description,
            project_admin_id, radius_m, timezone, latitude, longitude, address,
            perm_location, perm_authentication, perm_rfi,
            nomenclature, instruction, profile, image_url, status, updated_by
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
            $12,$13,$14,
            $15,$16,$17,$18,$19,$20
          ) RETURNING id`,
        [
          orgId,
          r.name,
          r.unique_code ?? null,
          r.client_name ?? '',
          r.description ?? '',
          adminId,
          r.radius_m ?? 100,
          r.timezone ?? 'Asia/Calcutta',
          r.latitude ?? null,
          r.longitude ?? null,
          r.address ?? '',
          r.perm_location ?? false,
          r.perm_authentication ?? false,
          r.perm_rfi ?? false,
          r.nomenclature ?? r.code ?? '',
          r.instruction ?? r.description ?? '',
          r.profile ?? '',
          r.image_url ?? '',
          r.status ?? 'active',
          userId,
        ]
      );

      // If project admin is assigned, ensure they exist in project_members
      if (inserted?.[0]?.id && adminId) {
        try {
          await orgQuery(
            payload.orgId ?? null,
            `INSERT INTO project_members (project_id, user_id, role)
             VALUES ($1, $2, 'admin')
             ON CONFLICT (project_id, user_id) DO UPDATE SET role = 'admin'`,
            [inserted[0].id, adminId]
          );
        } catch (pmErr) {
          console.warn('Could not add admin to project_members:', pmErr);
        }
      }
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

/**
 * PATCH /api/projects?id=...
 * Update an existing project (used by Edit modal and status toggle).
 */
export async function PATCH(request: NextRequest) {
  const { payload, response } = requireAuth(request);
  if (!payload) return response;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Missing project id' }, { status: 400 });
    }
    const body = await request.json();

    // Whitelist of updatable fields
    const allowed: Record<string, string> = {
      name: 'name',
      unique_code: 'unique_code',
      client_name: 'client_name',
      description: 'description',
      project_admin_id: 'project_admin_id',
      radius_m: 'radius_m',
      timezone: 'timezone',
      latitude: 'latitude',
      longitude: 'longitude',
      address: 'address',
      perm_location: 'perm_location',
      perm_authentication: 'perm_authentication',
      perm_rfi: 'perm_rfi',
      nomenclature: 'nomenclature',
      instruction: 'instruction',
      profile: 'profile',
      image_url: 'image_url',
      status: 'status',
    };

    const sets: string[] = [];
    const params: any[] = [];
    for (const [k, col] of Object.entries(allowed)) {
      if (k in body) {
        let val = body[k];
        if (k === 'project_admin_id') {
          val = isValidUuid(val) ? val : null;
        }
        params.push(val);
        sets.push(`${col} = $${params.length}`);
      }
    }
    if (sets.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    // Always stamp updated_by / updated_at
    const userId = isValidUuid(payload.userId) ? payload.userId : null;
    params.push(userId);
    sets.push(`updated_by = $${params.length}`);
    sets.push(`updated_at = now()`);

    // id goes into the WHERE clause only
    params.push(id);
    const sql = `UPDATE projects SET ${sets.join(', ')} WHERE id = $${params.length}`;
    await orgQuery(payload.orgId ?? null, sql, params);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

/**
 * DELETE /api/projects?id=...
 */
export async function DELETE(request: NextRequest) {
  const { payload, response } = requireAuth(request);
  if (!payload) return response;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Missing project id' }, { status: 400 });
    }
    await orgQuery(payload.orgId ?? null, 'DELETE FROM projects WHERE id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
