import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { orgQuery } from '@/lib/db';
import { ensureChecklistSchema } from '@/lib/checklistSchema';
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
        const { rows: checklistRows } = await orgQuery(payload.orgId!,
            `SELECT * FROM library_checklists WHERE id = $1`,
            [id]
        );

        if (checklistRows.length === 0) {
            return NextResponse.json({ error: 'Checklist not found' }, { status: 404 });
        }

        const checklist = checklistRows[0];

        // Fetch stages
        const { rows: stages } = await orgQuery(payload.orgId!,
            `SELECT id, library_checklist_id AS checklist_id, library_checklist_id, sr_no, name, witness_required, drawing_required, created_at
             FROM library_stages
             WHERE library_checklist_id = $1
             ORDER BY sr_no ASC`,
            [id]
        );

        // Fetch all checkpoints for this checklist
        const { rows: checkpoints } = await orgQuery(payload.orgId!,
            `SELECT lcp.id, lcp.library_stage_id AS stage_id, lcp.library_stage_id, lcp.sr_no, lcp.question,
                    lcp.input_type, lcp.photo_required, lcp.remark_required, lcp.created_at
             FROM library_checkpoints lcp
             JOIN library_stages ls ON lcp.library_stage_id = ls.id
             WHERE ls.library_checklist_id = $1
             ORDER BY lcp.sr_no ASC`,
            [id]
        );

        return NextResponse.json({
            ...checklist,
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
        const { rows: existing } = await orgQuery(payload.orgId!,
            `SELECT project_id FROM library_checklists WHERE id = $1`,
            [id]
        );

        if (existing.length === 0) {
            return NextResponse.json({ error: 'Checklist not found' }, { status: 404 });
        }

        const projectId = existing[0]?.project_id;
        const body = await request.json();
        const { name, reference_number, uom, status, reorder_stages, reorder_checkpoints } = body;

        // Update basic info
        if (name || reference_number !== undefined || uom !== undefined || status) {
            await orgQuery(payload.orgId!,
                `UPDATE library_checklists SET
                  name = COALESCE($1, name),
                  reference_number = COALESCE($2, reference_number),
                  uom = COALESCE($3, uom),
                  status = COALESCE($4, status),
                  updated_at = NOW()
                 WHERE id = $5`,
                [name ? String(name).trim() : null, reference_number, uom, status, id]
            );
        }

        // Reorder stages
        if (reorder_stages && Array.isArray(reorder_stages)) {
            for (let i = 0; i < reorder_stages.length; i++) {
                await orgQuery(payload.orgId!,
                    `UPDATE library_stages SET sr_no = $1 WHERE id = $2 AND library_checklist_id = $3`,
                    [i + 1, reorder_stages[i], id]
                );
            }
        }

        // Reorder checkpoints
        if (reorder_checkpoints && Array.isArray(reorder_checkpoints)) {
            for (const item of reorder_checkpoints) {
                await orgQuery(payload.orgId!,
                    `UPDATE library_checkpoints SET sr_no = $1 WHERE id = $2`,
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
        const { rows: existing } = await orgQuery(payload.orgId!,
            `SELECT project_id FROM library_checklists WHERE id = $1`,
            [id]
        );
        const projectId = existing[0]?.project_id;

        await orgQuery(payload.orgId!,
            `DELETE FROM library_checklists WHERE id = $1`,
            [id]
        );

        if (projectId) await touchProject(payload.orgId!, projectId, payload.userId);
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
