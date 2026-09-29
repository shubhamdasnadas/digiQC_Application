import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { orgQuery } from '@/lib/db';
import { getLibraryChecklistDetail } from '@/lib/checklistLibrary';
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
        // Fetch checklist details from checklists table
        let { rows: checklistRows } = await orgQuery(payload.orgId!,
            `SELECT * FROM checklists WHERE id = $1`,
            [id]
        );

        if (checklistRows.length === 0) {
            // Check library
            const libraryDetail = await getLibraryChecklistDetail(id);
            if (!libraryDetail) {
                return NextResponse.json({ error: 'Checklist not found' }, { status: 404 });
            }

            // Promote to checklists table so future operations operate on standard tables
            await orgQuery(payload.orgId!,
                `INSERT INTO checklists (id, project_id, name, reference_number, status, created_at)
                 VALUES ($1, NULL, $2, $3, 'draft', $4)
                 ON CONFLICT (id) DO NOTHING`,
                [id, libraryDetail.checklist.name, libraryDetail.checklist.reference_number || null, libraryDetail.checklist.created_at]
            ).catch(() => {});

            for (const stage of libraryDetail.stages) {
                await orgQuery(payload.orgId!,
                    `INSERT INTO checklist_stages (id, checklist_id, sr_no, name, created_at)
                     VALUES ($1, $2, $3, $4, $5)
                     ON CONFLICT (id) DO NOTHING`,
                    [stage.id, id, stage.sr_no || 1, stage.name, stage.created_at]
                ).catch(() => {});
            }

            for (const cp of libraryDetail.checkpoints) {
                await orgQuery(payload.orgId!,
                    `INSERT INTO checkpoints (id, stage_id, sr_no, question, input_type, drawing_required, witness_required, photo_required, remark_required, created_at)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                     ON CONFLICT (id) DO NOTHING`,
                    [
                        cp.id,
                        cp.stage_id,
                        cp.sr_no || 0,
                        cp.question,
                        cp.input_type || 'yes_no',
                        !!cp.drawing_required,
                        !!cp.witness_required,
                        !!(cp as any).photo_required,
                        !!(cp as any).remark_required,
                        cp.created_at
                    ]
                ).catch(() => {});
            }

            const refetched = await orgQuery(payload.orgId!, `SELECT * FROM checklists WHERE id = $1`, [id]);
            checklistRows = refetched.rows;
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

    await ensureChecklistSchema(payload.orgId!);

    try {
        let { rows: existing } = await orgQuery(payload.orgId!, `SELECT project_id FROM checklists WHERE id = $1`, [id]);

        if (existing.length === 0) {
            const { rows: libRows } = await orgQuery(payload.orgId!,
                `SELECT id, name, reference_number FROM library_checklists WHERE id = $1`,
                [id]
            ).catch(() => ({ rows: [] }));

            if (libRows.length > 0) {
                await orgQuery(payload.orgId!,
                    `INSERT INTO checklists (id, project_id, name, reference_number)
                     VALUES ($1, NULL, $2, $3)
                     ON CONFLICT (id) DO NOTHING`,
                    [libRows[0].id, libRows[0].name, libRows[0].reference_number]
                );
                existing = [{ project_id: null }];
            }
        }

        const projectId = existing[0]?.project_id;
        const body = await request.json();
        const { name, reference_number, uom, status, reorder_stages, reorder_checkpoints } = body;

        // Update basic info
        if (name || reference_number !== undefined || uom !== undefined || status) {
            await orgQuery(payload.orgId!,
                `UPDATE checklists SET
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
                    `UPDATE checklist_stages SET sr_no = $1 WHERE id = $2`,
                    [i + 1, reorder_stages[i]]
                );
            }
        }

        // Reorder checkpoints
        if (reorder_checkpoints && Array.isArray(reorder_checkpoints)) {
            for (const item of reorder_checkpoints) {
                await orgQuery(payload.orgId!,
                    `UPDATE checkpoints SET sr_no = $1 WHERE id = $2`,
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
        const { rows: existing } = await orgQuery(payload.orgId!, `SELECT project_id FROM checklists WHERE id = $1`, [id]);
        const projectId = existing[0]?.project_id;

        await orgQuery(payload.orgId!,
            `DELETE FROM checkpoints WHERE stage_id IN (SELECT id FROM checklist_stages WHERE checklist_id = $1)`,
            [id]
        );
        await orgQuery(payload.orgId!, `DELETE FROM checklist_stages WHERE checklist_id = $1`, [id]);
        await orgQuery(payload.orgId!, `DELETE FROM checklists WHERE id = $1`, [id]);
        await orgQuery(payload.orgId!, `DELETE FROM library_checklists WHERE id = $1`, [id]).catch(() => {});

        if (projectId) await touchProject(payload.orgId!, projectId, payload.userId);
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
