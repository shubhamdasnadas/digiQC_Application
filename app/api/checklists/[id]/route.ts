import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { orgQuery } from '@/lib/db';
import { ensureChecklistSchema } from '@/lib/checklistSchema';
import { CHECKLIST_TABLES, getChecklistChildren, resolveChecklistScope } from '@/lib/checklistLibrary';
import { touchProject } from '@/lib/projects';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { payload, response } = requireAuth(request);
    if (!payload) return response;

    const { id } = await params;

    await ensureChecklistSchema(payload.orgId!);

    try {
        const resolved = await resolveChecklistScope(id);
        if (!resolved) {
            return NextResponse.json({ error: 'Checklist not found' }, { status: 404 });
        }

        const { stages, checkpoints } = await getChecklistChildren(resolved.scope, id);

        return NextResponse.json({
            ...resolved,
            stages,
            checkpoints,
        });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { payload, response } = requireAuth(request);
    if (!payload) return response;

    const { id } = await params;

    await ensureChecklistSchema(payload.orgId!);

    try {
        const resolved = await resolveChecklistScope(id);
        if (!resolved) {
            return NextResponse.json({ error: 'Checklist not found' }, { status: 404 });
        }

        const t = CHECKLIST_TABLES[resolved.scope];
        const projectId = resolved.project_id;
        const body = await request.json();
        const { name, reference_number, uom, status, reorder_stages, reorder_checkpoints } = body;

        // Update basic info
        if (name || reference_number !== undefined || uom !== undefined || status) {
            await orgQuery(payload.orgId!,
                `UPDATE ${t.checklist} SET
                  name = COALESCE($1, name),
                  reference_number = COALESCE($2, reference_number),
                  uom = COALESCE($3, uom),
                  status = COALESCE($4, status),
                  updated_at = NOW()
                 WHERE id = $5`,
                [name ? String(name).trim() : null, reference_number, uom, status, id]
            );
        }

        // Reorder stages with 1-based index
        if (reorder_stages && Array.isArray(reorder_stages)) {
            for (let i = 0; i < reorder_stages.length; i++) {
                const item = reorder_stages[i];
                const stageId = typeof item === 'string' ? item : item?.id;
                const newIdx = typeof item === 'object' && item?.index !== undefined ? Number(item.index) : (i + 1);

                if (stageId) {
                    await orgQuery(payload.orgId!,
                        `UPDATE ${t.stage}
                         SET "index" = $1, sr_no = $1
                         WHERE id = $2 AND ${t.checklistFk} = $3`,
                        [newIdx, stageId, id]
                    );
                }
            }
        }

        // Reorder checkpoints
        if (reorder_checkpoints && Array.isArray(reorder_checkpoints)) {
            for (const item of reorder_checkpoints) {
                await orgQuery(payload.orgId!,
                    `UPDATE ${t.checkpoint} SET sr_no = $1 WHERE id = $2`,
                    [item.sr_no, item.id]
                );
            }
        }

        if (projectId) await touchProject(payload.orgId!, projectId, payload.userId);
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { payload, response } = requireAuth(request);
    if (!payload) return response;

    const { id } = await params;

    await ensureChecklistSchema(payload.orgId!);

    try {
        const resolved = await resolveChecklistScope(id);

        const t = CHECKLIST_TABLES[resolved?.scope ?? 'library'];

        await orgQuery(payload.orgId!,
            `DELETE FROM ${t.checklist} WHERE id = $1`,
            [id]
        );

        if (resolved?.project_id) {
            await touchProject(payload.orgId!, resolved.project_id, payload.userId);
        }
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
