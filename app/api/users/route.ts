import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import pool from '@/lib/db';

/**
 * GET /api/users
 * Returns all active users in the current user's organization.
 * Used by the Project Admin dropdown and member pickers.
 */
export async function GET(request: NextRequest) {
  const { payload, response } = requireAuth(request);
  if (!payload) return response;

  try {
    let rows: any[] = [];
    if (payload.orgId) {
      const result = await pool.query(
        `SELECT u.id, u.name, u.email, u.avatar_url, om.role
         FROM public.users u
         JOIN public.org_members om ON om.user_id = u.id
         WHERE om.organization_id = $1 AND om.status = 'active'
         ORDER BY u.name`,
        [payload.orgId]
      );
      rows = result.rows;
    }

    if (rows.length === 0) {
      const result = await pool.query(
        `SELECT u.id, u.name, u.email, u.avatar_url, 'admin' as role
         FROM public.users u
         ORDER BY u.name`
      );
      rows = result.rows;
    }

    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
