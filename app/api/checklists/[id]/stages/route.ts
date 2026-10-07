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

        const { rows: checklistRows } = await orgQuery(payload.orgId!,
            `SELECT project_id FROM library_checklists WHERE id = $1`,
            [id]
        );

        if (checklistRows.length === 0) {
            return NextResponse.json({ error: 'Checklist not found.' }, { status: 404 });
        }

        const { rows: countRows } = await orgQuery(payload.orgId!,
            `SELECT COALESCE(MAX(COALESCE("index", sr_no, 0)), 0) AS max_idx FROM library_stages WHERE library_checklist_id = $1`,
            [id]
        );
        const nextIndex = (parseInt(countRows[0]?.max_idx) || 0) + 1;

        const { rows } = await orgQuery(payload.orgId!,
            `INSERT INTO library_stages (library_checklist_id, sr_no, "index", name, witness_required, drawing_required)
             VALUES ($1, $2, $2, $3, $4, $5)
             RETURNING id, library_checklist_id AS checklist_id, library_checklist_id, sr_no, "index" AS index, name, witness_required, drawing_required, created_at`,
            [id, nextIndex, name.trim(), !!witness_required, !!drawing_required]
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
        const { stage_id, name, witness_required, drawing_required, sr_no, index } = body;
        const targetIndex = index !== undefined ? Number(index) : (sr_no !== undefined ? Number(sr_no) : null);

        if (!stage_id) {
            return NextResponse.json({ error: 'stage_id is required.' }, { status: 400 });
        }

        await ensureChecklistSchema(payload.orgId!);

        const { rows: checklistRows } = await orgQuery(payload.orgId!,
            `SELECT project_id FROM library_checklists WHERE id = $1`,
            [id]
        );

        const { rows } = await orgQuery(payload.orgId!,
            `UPDATE library_stages
             SET name = COALESCE($1, name),
                 witness_required = COALESCE($2, witness_required),
                 drawing_required = COALESCE($3, drawing_required),
                 sr_no = COALESCE($4, sr_no),
                 "index" = COALESCE($4, "index")
             WHERE id = $5 AND library_checklist_id = $6
             RETURNING id, library_checklist_id AS checklist_id, library_checklist_id, sr_no, "index" AS index, name, witness_required, drawing_required, created_at`,
            [
                name !== undefined ? String(name).trim() : null,
                witness_required !== undefined ? !!witness_required : null,
                drawing_required !== undefined ? !!drawing_required : null,
                targetIndex,
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
            `SELECT project_id FROM library_checklists WHERE id = $1`,
            [id]
        );

        const { rowCount } = await orgQuery(payload.orgId!,
            `DELETE FROM library_stages WHERE id = $1 AND library_checklist_id = $2`,
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
