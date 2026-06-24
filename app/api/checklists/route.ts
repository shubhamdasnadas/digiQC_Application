import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { orgQuery } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { payload, response } = requireAuth(request);
  if (!payload) return response;

  try {
    const { rows } = await orgQuery(payload.orgId!, `
      SELECT c.*,
        CASE WHEN p.id IS NOT NULL
          THEN json_build_object('name', p.name)
          ELSE NULL
        END AS project
      FROM checklists c
      LEFT JOIN projects p ON c.project_id = p.id
      ORDER BY c.created_at DESC
    `);
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

    for (const row of rows) {
      await orgQuery(payload.orgId!,
        `INSERT INTO checklists (project_id, name) VALUES ($1, $2)`,
        [row.project_id, row.name]
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
