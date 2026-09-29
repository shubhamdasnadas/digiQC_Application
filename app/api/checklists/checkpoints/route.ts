import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { orgQuery } from '@/lib/db';
import { ensureChecklistSchema } from '@/lib/checklistSchema';
import { touchProject } from '@/lib/projects';

export async function POST(request: NextRequest) {
    const { payload, response } = requireAuth(request);
    if (!payload) return response;

    try {
        const body = await request.json();
        const {
            checklist_id,
            stage_id,
            question,
            name,
            input_type,
            photo_required,
            remark_required,
            drawing_required,
            witness_required
        } = body;

        const effectiveQuestion = (question && String(question).trim()) || (name && String(name).trim());

        if (!stage_id || !effectiveQuestion) {
            return NextResponse.json({ error: 'stage_id and question/name are required.' }, { status: 400 });
        }

        await ensureChecklistSchema(payload.orgId!);

        // Ensure stage exists in checklist_stages (promote from library if needed)
        let { rows: stageRows } = await orgQuery(payload.orgId!,
            `SELECT cs.id, cs.checklist_id, c.project_id
             FROM checklist_stages cs
             LEFT JOIN checklists c ON c.id = cs.checklist_id
             WHERE cs.id = $1`,
            [stage_id]
        );

        if (stageRows.length === 0) {
            const { rows: libStageRows } = await orgQuery(payload.orgId!,
                `SELECT ls.id, ls.library_checklist_id, ls.name, ls.sr_no, lc.name as checklist_name, lc.reference_number
                 FROM library_stages ls
                 JOIN library_checklists lc ON lc.id = ls.library_checklist_id
                 WHERE ls.id = $1`,
                [stage_id]
            ).catch(() => ({ rows: [] }));

            if (libStageRows.length > 0) {
                const libStage = libStageRows[0];
                await orgQuery(payload.orgId!,
                    `INSERT INTO checklists (id, project_id, name, reference_number)
                     VALUES ($1, NULL, $2, $3)
                     ON CONFLICT (id) DO NOTHING`,
                    [libStage.library_checklist_id, libStage.checklist_name, libStage.reference_number]
                );
                await orgQuery(payload.orgId!,
                    `INSERT INTO checklist_stages (id, checklist_id, sr_no, name)
                     VALUES ($1, $2, $3, $4)
                     ON CONFLICT (id) DO NOTHING`,
                    [libStage.id, libStage.library_checklist_id, libStage.sr_no || 1, libStage.name]
                );
                stageRows = [{ id: libStage.id, checklist_id: libStage.library_checklist_id, project_id: null }];
            } else {
                return NextResponse.json({ error: 'Stage not found.' }, { status: 404 });
            }
        }

        const projectId = stageRows[0]?.project_id;

        const { rows: countRows } = await orgQuery(payload.orgId!,
            `SELECT COALESCE(MAX(sr_no), 0) AS max_sr FROM checkpoints WHERE stage_id = $1`,
            [stage_id]
        );
        const nextSrNo = (parseInt(countRows[0]?.max_sr) || 0) + 1;

        const { rows } = await orgQuery(payload.orgId!,
            `INSERT INTO checkpoints (stage_id, sr_no, question, input_type, photo_required, remark_required, drawing_required, witness_required)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [
                stage_id,
                nextSrNo,
                effectiveQuestion,
                input_type || 'yes_no',
                !!photo_required,
                !!remark_required,
                !!drawing_required,
                !!witness_required
            ]
        );

        if (projectId) {
            await touchProject(payload.orgId!, projectId, payload.userId);
        }

        return NextResponse.json({ success: true, checkpoint: rows[0] });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    const { payload, response } = requireAuth(request);
    if (!payload) return response;

    try {
        const body = await request.json();
        const {
            id,
            question,
            name,
            input_type,
            photo_required,
            remark_required,
            drawing_required,
            witness_required,
            sr_no
        } = body;

        if (!id) {
            return NextResponse.json({ error: 'Checkpoint id is required.' }, { status: 400 });
        }

        await ensureChecklistSchema(payload.orgId!);

        const effectiveQuestion = question !== undefined
            ? String(question).trim()
            : name !== undefined
                ? String(name).trim()
                : null;

        const { rows } = await orgQuery(payload.orgId!,
            `UPDATE checkpoints
             SET question = COALESCE($1, question),
                 input_type = COALESCE($2, input_type),
                 photo_required = COALESCE($3, photo_required),
                 remark_required = COALESCE($4, remark_required),
                 drawing_required = COALESCE($5, drawing_required),
                 witness_required = COALESCE($6, witness_required),
                 sr_no = COALESCE($7, sr_no)
             WHERE id = $8
             RETURNING *`,
            [
                effectiveQuestion,
                input_type !== undefined ? input_type : null,
                photo_required !== undefined ? !!photo_required : null,
                remark_required !== undefined ? !!remark_required : null,
                drawing_required !== undefined ? !!drawing_required : null,
                witness_required !== undefined ? !!witness_required : null,
                sr_no !== undefined ? Number(sr_no) : null,
                id
            ]
        );

        if (rows.length === 0) {
            return NextResponse.json({ error: 'Checkpoint not found.' }, { status: 404 });
        }

        return NextResponse.json({ success: true, checkpoint: rows[0] });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    const { payload, response } = requireAuth(request);
    if (!payload) return response;

    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Checkpoint id is required.' }, { status: 400 });
        }

        await ensureChecklistSchema(payload.orgId!);

        const { rowCount } = await orgQuery(payload.orgId!,
            `DELETE FROM checkpoints WHERE id = $1`,
            [id]
        );

        if (rowCount === 0) {
            return NextResponse.json({ error: 'Checkpoint not found.' }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
