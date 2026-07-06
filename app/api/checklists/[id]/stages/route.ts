import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { orgQuery } from '@/lib/db';
import { ensureChecklistSchema } from '@/lib/checklistSchema';

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
            `SELECT 1 FROM checklists WHERE id = $1`,
            [id]
        );
        if (checklistRows.length === 0) {
            return NextResponse.json({ error: 'Checklist not found.' }, { status: 404 });
        }

        const { rows: countRows } = await orgQuery(payload.orgId!,
            `SELECT count(*) AS count FROM checklist_stages WHERE checklist_id = $1`,
            [id]
        );
        const nextSrNo = parseInt(countRows[0].count) + 1;

        const { rows } = await orgQuery(payload.orgId!,
            `INSERT INTO checklist_stages (checklist_id, sr_no, name, witness_required, drawing_required)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [id, nextSrNo, name, !!witness_required, !!drawing_required]
        );

        return NextResponse.json({ success: true, stage: rows[0] });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
