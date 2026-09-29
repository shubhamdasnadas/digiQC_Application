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

export async function PUT(request: NextRequest) {
  const { payload, response } = requireAuth(request);
  if (!payload) return response;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Member ID is required' }, { status: 400 });
    }

    const body = await request.json();
    
    await orgQuery(payload.orgId!,
      `UPDATE members
       SET name = $1, email = $2, phone = $3, default_role = $4, teams = $5
       WHERE id = $6`,
      [
        body.name,
        body.email ?? '',
        body.phone ?? '',
        body.default_role ?? '',
        body.teams ?? '',
        id
      ]
    );

    return NextResponse.json({ success: true });
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
