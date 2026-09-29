import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { orgQuery } from '@/lib/db';
import { ensureChecklistSchema } from '@/lib/checklistSchema';
import { touchProject } from '@/lib/projects';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { payload, response } = requireAuth(request);
    if (!payload) return response;

    const { id } = await params;

    try {
        const body = await request.json();
        const { name, witness_required, drawing_required } = body;

        if (!name || !String(name).trim()) {
            return NextResponse.json({ error: 'Stage name is required.' }, { status: 400 });
        }

        await ensureChecklistSchema(payload.orgId!);

        // Check if checklist exists in checklists table
        let { rows: checklistRows } = await orgQuery(payload.orgId!,
            `SELECT project_id FROM checklists WHERE id = $1`,
            [id]
        );

        if (checklistRows.length === 0) {
            // Check if it exists in library_checklists and promote it
            const { rows: libRows } = await orgQuery(payload.orgId!,
                `SELECT id, name, reference_number FROM library_checklists WHERE id = $1`,
                [id]
            ).catch(() => ({ rows: [] }));

            if (libRows.length > 0) {
                await orgQuery(payload.orgId!,
                    `INSERT INTO checklists (id, project_id, name, reference_number)
                     VALUES ($1, NULL, $2, $3)
                     ON CONFLICT (id) DO UPDATE SET
                       name = EXCLUDED.name,
                       reference_number = COALESCE(EXCLUDED.reference_number, checklists.reference_number)`,
                    [libRows[0].id, libRows[0].name, libRows[0].reference_number]
                );

                // Copy over library stages and checkpoints for this checklist
                await orgQuery(payload.orgId!,
                    `INSERT INTO checklist_stages (id, checklist_id, sr_no, name)
                     SELECT id, library_checklist_id, COALESCE(sr_no, 1), name
                     FROM library_stages WHERE library_checklist_id = $1
                     ON CONFLICT (id) DO NOTHING`,
                    [id]
                ).catch(() => {});

                await orgQuery(payload.orgId!,
                    `INSERT INTO checkpoints (id, stage_id, sr_no, question, input_type, drawing_required, witness_required)
                     SELECT lcp.id, lcp.library_stage_id, COALESCE(lcp.sr_no, 0), lcp.question, COALESCE(lcp.input_type, 'yes_no'), COALESCE(lcp.drawing_required, false), COALESCE(lcp.witness_required, false)
                     FROM library_checkpoints lcp
                     JOIN library_stages ls ON lcp.library_stage_id = ls.id
                     WHERE ls.library_checklist_id = $1
                     ON CONFLICT (id) DO NOTHING`,
                    [id]
                ).catch(() => {});

                checklistRows = [{ project_id: null }];
            } else {
                return NextResponse.json({ error: 'Checklist not found.' }, { status: 404 });
            }
        }

        const { rows: countRows } = await orgQuery(payload.orgId!,
            `SELECT COALESCE(MAX(sr_no), 0) AS max_sr FROM checklist_stages WHERE checklist_id = $1`,
            [id]
        );
        const nextSrNo = (parseInt(countRows[0]?.max_sr) || 0) + 1;

        const { rows } = await orgQuery(payload.orgId!,
            `INSERT INTO checklist_stages (checklist_id, sr_no, name, witness_required, drawing_required)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [id, nextSrNo, name.trim(), !!witness_required, !!drawing_required]
        );

        if (checklistRows[0]?.project_id) {
            await touchProject(payload.orgId!, checklistRows[0].project_id, payload.userId);
        }
        return NextResponse.json({ success: true, stage: rows[0] });
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
        const { stage_id, name, witness_required, drawing_required, sr_no } = body;

        if (!stage_id) {
            return NextResponse.json({ error: 'stage_id is required.' }, { status: 400 });
        }

        await ensureChecklistSchema(payload.orgId!);

        const { rows: checklistRows } = await orgQuery(payload.orgId!,
            `SELECT project_id FROM checklists WHERE id = $1`,
            [id]
        );

        const { rows } = await orgQuery(payload.orgId!,
            `UPDATE checklist_stages
             SET name = COALESCE($1, name),
                 witness_required = COALESCE($2, witness_required),
                 drawing_required = COALESCE($3, drawing_required),
                 sr_no = COALESCE($4, sr_no)
             WHERE id = $5 AND checklist_id = $6
             RETURNING *`,
            [
                name !== undefined ? String(name).trim() : null,
                witness_required !== undefined ? !!witness_required : null,
                drawing_required !== undefined ? !!drawing_required : null,
                sr_no !== undefined ? Number(sr_no) : null,
                stage_id,
                id,
            ]
        );

        if (rows.length === 0) {
            return NextResponse.json({ error: 'Stage not found.' }, { status: 404 });
        }

        if (checklistRows[0]?.project_id) {
            await touchProject(payload.orgId!, checklistRows[0].project_id, payload.userId);
        }

        return NextResponse.json({ success: true, stage: rows[0] });
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

    try {
        const { searchParams } = new URL(request.url);
        const stageId = searchParams.get('stage_id') || searchParams.get('id');

        if (!stageId) {
            return NextResponse.json({ error: 'stage_id is required.' }, { status: 400 });
        }

        await ensureChecklistSchema(payload.orgId!);

        const { rows: checklistRows } = await orgQuery(payload.orgId!,
            `SELECT project_id FROM checklists WHERE id = $1`,
            [id]
        );

        // Delete checkpoints in this stage first
        await orgQuery(payload.orgId!,
            `DELETE FROM checkpoints WHERE stage_id = $1`,
            [stageId]
        );

        const { rowCount } = await orgQuery(payload.orgId!,
            `DELETE FROM checklist_stages WHERE id = $1 AND checklist_id = $2`,
            [stageId, id]
        );

        if (rowCount === 0) {
            return NextResponse.json({ error: 'Stage not found.' }, { status: 404 });
        }

        if (checklistRows[0]?.project_id) {
            await touchProject(payload.orgId!, checklistRows[0].project_id, payload.userId);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
