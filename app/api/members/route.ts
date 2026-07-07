import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { orgQuery } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { payload, response } = requireAuth(request);
  if (!payload) return response;

  try {
    const { rows } = await orgQuery(payload.orgId!, 'SELECT * FROM members ORDER BY created_at DESC');
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { payload, response } = requireAuth(request);
  if (!payload) return response;

  try {
    const body = await request.json();
    const rows = body.rows ?? [body];

    if (body.replace) {
      await orgQuery(payload.orgId!, 'DELETE FROM members');
    }

    for (const row of rows) {
      await orgQuery(payload.orgId!,
        `INSERT INTO members (organization_id, name, email, phone, access_type, active, default_role, teams, active_projects, inactive_projects)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          payload.orgId,
          row.name,
          row.email ?? '',
          row.phone ?? '',
          row.access_type ?? '',
          row.active ?? true,
          row.default_role ?? '',
          row.teams ?? '',
          row.active_projects ?? '',
          row.inactive_projects ?? '',
        ]
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { payload, response } = requireAuth(request);
  if (!payload) return response;

  try {
    await orgQuery(payload.orgId!, 'DELETE FROM members');
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
