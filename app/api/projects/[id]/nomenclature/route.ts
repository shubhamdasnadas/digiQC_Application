import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { orgQuery } from '@/lib/db';
import { touchProject } from '@/lib/projects';

interface RouteContext { params: Promise<{ id: string }>; }

const STATUSES = ['active', 'inactive'] as const;

// Tasks are L1. Sub-tasks nest under any existing row, up to L6.
const MAX_LEVEL = 6;

/**
 * GET /api/projects/[id]/nomenclature
 * Returns a flat list of nomenclature rows for the project, ordered for
 * display. Rows with parent_id NULL are tasks (L1); the rest are
 * sub-tasks at whatever depth their parent chain puts them at.
 * The client groups them into a tree.
 */
export async function GET(request: NextRequest, ctx: RouteContext) {
  const { payload, response } = requireAuth(request);
  if (!payload) return response;
  const { id } = await ctx.params;
  try {
    const { rows } = await orgQuery(
      payload.orgId!,
      `SELECT id, project_id, parent_id, sr_no, name, description, status, created_at
       FROM nomenclature
       WHERE project_id = $1
       ORDER BY sr_no, created_at`,
      [id]
    );
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

/**
 * POST /api/projects/[id]/nomenclature
 * Body: single row or { rows: [...] } with:
 *   { name, description?, sr_no?, status?, parent_id? }
 * parent_id omitted/null => top-level task (L1).
 * parent_id set => sub-task of that row, nested at parent's level + 1,
 * up to MAX_LEVEL (L6). Any existing row in the project can be a parent,
 * not just top-level tasks.
 * sr_no 0/omitted => auto-assigned as next number among its siblings.
 */
export async function POST(request: NextRequest, ctx: RouteContext) {
  const { payload, response } = requireAuth(request);
  if (!payload) return response;
  const { id } = await ctx.params;
  try {
    const body = await request.json();
    const rows = body.rows ?? [body];

    for (const r of rows) {
      const name = String(r.name ?? '').trim();
      if (!name) continue;

      const parentId = r.parent_id ?? null;

      if (parentId) {
        // Confirm the parent exists in this project, and compute its
        // depth (via its ancestor chain) so we can enforce MAX_LEVEL.
        const { rows: depthRows } = await orgQuery(
          payload.orgId!,
          `WITH RECURSIVE ancestors AS (
             SELECT id, parent_id, 1 AS level
             FROM nomenclature
             WHERE id = $1 AND project_id = $2
             UNION ALL
             SELECT n.id, n.parent_id, a.level + 1
             FROM nomenclature n
             JOIN ancestors a ON n.id = a.parent_id
           )
           SELECT MAX(level) AS level FROM ancestors`,
          [parentId, id]
        );

        const parentLevel = depthRows[0]?.level;
        if (!parentLevel) {
          return NextResponse.json({ error: 'Parent task not found' }, { status: 400 });
        }
        if (parentLevel >= MAX_LEVEL) {
          return NextResponse.json(
            { error: `Sub-tasks can nest at most ${MAX_LEVEL} levels deep` },
            { status: 400 }
          );
        }
      }

      const status = STATUSES.includes(r.status) ? r.status : 'active';

      await orgQuery(
        payload.orgId!,
        `INSERT INTO nomenclature (project_id, parent_id, sr_no, name, description, status)
         VALUES (
           $1, $2,
           COALESCE(NULLIF($3, 0),
             (SELECT COALESCE(MAX(sr_no), 0) + 1 FROM nomenclature
              WHERE project_id = $1 AND parent_id IS NOT DISTINCT FROM $2)),
           $4, $5, $6
         )`,
        [id, parentId, r.sr_no ?? 0, name, r.description ?? '', status]
      );
    }

    await touchProject(payload.orgId!, id, payload.userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

/**
 * PATCH /api/projects/[id]/nomenclature
 * Body: { id, name?, description?, sr_no?, status? } — updates one row.
 */
export async function PATCH(request: NextRequest, ctx: RouteContext) {
  const { payload, response } = requireAuth(request);
  if (!payload) return response;
  const { id } = await ctx.params;
  try {
    const body = await request.json();
    if (!body.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    if (body.status && !STATUSES.includes(body.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const { rows } = await orgQuery(
      payload.orgId!,
      `UPDATE nomenclature
       SET name        = COALESCE($1, name),
           description = COALESCE($2, description),
           sr_no       = COALESCE(NULLIF($3, 0), sr_no),
           status      = COALESCE($4, status)
       WHERE id = $5 AND project_id = $6
       RETURNING id`,
      [
        body.name != null ? String(body.name).trim() : null,
        body.description ?? null,
        body.sr_no ?? 0,
        body.status ?? null,
        body.id,
        id,
      ]
    );
    if (!rows[0]) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });

    await touchProject(payload.orgId!, id, payload.userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

/**
 * DELETE /api/projects/[id]/nomenclature?entry_id=...
 * Deleting a task also deletes its sub-tasks (ON DELETE CASCADE), at any depth.
 */
export async function DELETE(request: NextRequest, ctx: RouteContext) {
  const { payload, response } = requireAuth(request);
  if (!payload) return response;
  const { id } = await ctx.params;
  try {
    const { searchParams } = new URL(request.url);
    const entryId = searchParams.get('entry_id');
    if (!entryId) return NextResponse.json({ error: 'Missing entry_id' }, { status: 400 });

    await orgQuery(
      payload.orgId!,
      `DELETE FROM nomenclature WHERE id = $1 AND project_id = $2`,
      [entryId, id]
    );
    await touchProject(payload.orgId!, id, payload.userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}