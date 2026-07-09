import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { orgQuery } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { payload, response } = requireAuth(request);
  if (!payload) return response;

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

  try {
    const body = await request.json();
    const rows = body.rows ?? [body];

    if (body.replace) {
      await orgQuery(payload.orgId!, 'DELETE FROM teams');
    }

    for (const row of rows) {
      await orgQuery(payload.orgId!,
        `INSERT INTO teams (organization_id, name, type, team_lead_name, spoc_name, active_projects, inactive_projects)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          payload.orgId,
          row.name,
          row.type ?? 'developer',
          row.team_lead_name ?? '',
          row.spoc_name ?? '',
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

export async function PUT(request: NextRequest) {
  const { payload, response } = requireAuth(request);
  if (!payload) return response;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Team ID is required' }, { status: 400 });
    }

    const body = await request.json();

    await orgQuery(payload.orgId!,
      `UPDATE teams
       SET name = $1, type = $2, team_lead_name = $3, spoc_name = $4
       WHERE id = $5 AND organization_id = $6`,
      [
        body.name,
        body.type ?? 'developer',
        body.team_lead_name ?? '',
        body.spoc_name ?? '',
        id,
        payload.orgId
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

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      await orgQuery(payload.orgId!, 'DELETE FROM teams WHERE id = $1 AND organization_id = $2', [id, payload.orgId]);
    } else {
      await orgQuery(payload.orgId!, 'DELETE FROM teams');
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
