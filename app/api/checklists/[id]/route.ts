import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { orgQuery } from '@/lib/db';
import { getLibraryChecklistDetail } from '@/lib/checklistLibrary';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { payload, response } = requireAuth(request);
    if (!payload) return response;

    const { id } = await params;

    try {
        // Fetch checklist details
        const { rows: checklistRows } = await orgQuery(payload.orgId!,
            `SELECT * FROM checklists WHERE id = $1`,
            [id]
        );

        if (checklistRows.length === 0) {
            const libraryDetail = await getLibraryChecklistDetail(id);
            if (!libraryDetail) {
                return NextResponse.json({ error: 'Checklist not found' }, { status: 404 });
            }
            return NextResponse.json({
                ...libraryDetail.checklist,
                stages: libraryDetail.stages,
                checkpoints: libraryDetail.checkpoints,
            });
        }

        const checklist = checklistRows[0];

        // Fetch stages
        const { rows: stages } = await orgQuery(payload.orgId!,
            `SELECT * FROM checklist_stages WHERE checklist_id = $1 ORDER BY sr_no ASC`,
            [id]
        );

        // Fetch all checkpoints for this checklist
        const { rows: checkpoints } = await orgQuery(payload.orgId!,
            `SELECT cp.* FROM checkpoints cp 
       JOIN checklist_stages cs ON cp.stage_id = cs.id 
       WHERE cs.checklist_id = $1 ORDER BY cp.sr_no ASC`,
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

    try {
        const body = await request.json();
        const { name, reference_number, uom, status, reorder_stages, reorder_checkpoints } = body;

        // Update basic info
        if (name || reference_number || uom || status) {
            await orgQuery(payload.orgId!,
                `UPDATE checklists SET 
          name = COALESCE($1, name), 
          reference_number = COALESCE($2, reference_number), 
          uom = COALESCE($3, uom), 
          status = COALESCE($4, status),
          updated_at = NOW() 
         WHERE id = $5`,
                [name, reference_number, uom, status, id]
            );
        }

        // Reorder stages
        if (reorder_stages && Array.isArray(reorder_stages)) {
            for (let i = 0; i < reorder_stages.length; i++) {
                await orgQuery(payload.orgId!,
                    `UPDATE checklist_stages SET sr_no = $1 WHERE id = $2`,
                    [i + 1, reorder_stages[i]]
                );
            }
        }

        // Reorder checkpoints
        if (reorder_checkpoints && Array.isArray(reorder_checkpoints)) {
            // reorder_checkpoints should be an array of {id, sr_no}
            for (const item of reorder_checkpoints) {
                await orgQuery(payload.orgId!,
                    `UPDATE checkpoints SET sr_no = $1 WHERE id = $2`,
                    [item.sr_no, item.id]
                );
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}