import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { orgQuery } from '@/lib/db';

interface RouteContext { params: Promise<{ id: string }>; }

export async function GET(request: NextRequest, ctx: RouteContext) {
  const { payload, response } = requireAuth(request);
  if (!payload) return response;
  const { id } = await ctx.params;
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const q = searchParams.get('q')?.toLowerCase().trim();

    const where: string[] = ['project_id = $1'];
    const params: any[] = [id];
    if (status && status !== 'all') { params.push(status); where.push(`status = $${params.length}`); }
    if (q) { params.push(`%${q}%`); where.push(`(LOWER(title) LIKE $${params.length} OR LOWER(COALESCE(document_no,'')) LIKE $${params.length})`); }

    const { rows } = await orgQuery(
      payload.orgId!,
      `SELECT * FROM register_entries WHERE ${where.join(' AND ')} ORDER BY created_at DESC`,
      params
    );
    return NextResponse.json(rows);
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
      await orgQuery(
        payload.orgId!,
        `INSERT INTO register_entries
           (project_id, document_no, title, revision, status, file_url)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          id,
          r.document_no ?? '',
          r.title,
          r.revision ?? 'R0',
          r.status ?? 'active',
          r.file_url ?? '',
        ]
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
