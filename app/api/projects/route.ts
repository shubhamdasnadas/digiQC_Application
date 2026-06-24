import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { orgQuery } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { payload, response } = requireAuth(request);
  if (!payload) return response;

  try {
    const { rows } = await orgQuery(payload.orgId!, 'SELECT * FROM projects ORDER BY created_at DESC');
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
        `INSERT INTO projects (organization_id, name, nomenclature, instruction, profile, image_url, status)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          payload.orgId,
          row.name,
          row.nomenclature ?? '',
          row.instruction ?? '',
          row.profile ?? '',
          row.image_url ?? '',
          row.status ?? 'active',
        ]
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
