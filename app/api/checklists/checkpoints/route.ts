import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { orgQuery } from '@/lib/db';
import { ensureChecklistSchema } from '@/lib/checklistSchema';
import { CHECKLIST_TABLES, type ChecklistScope } from '@/lib/checklistLibrary';
import { touchProject } from '@/lib/projects';

/**
 * Locates the stage a checkpoint belongs to and, with it, which store the
 * parent checklist lives in. Tries the project tables first so a project's own
 * stage always wins over a library stage that happens to share the id.
 */
async function findStageOwner(stageId: string): Promise<{
    scope: ChecklistScope;
    checklistId: string;
    projectId: string | null;
} | null> {
    for (const scope of ['project', 'library'] as ChecklistScope[]) {
        const t = CHECKLIST_TABLES[scope];
        const { rows } = await orgQuery(
            null,
            `SELECT s.${t.checklistFk} AS checklist_id, c.project_id
             FROM ${t.stage} s
             LEFT JOIN ${t.checklist} c ON c.id = s.${t.checklistFk}
             WHERE s.id = $1`,
            [stageId]
        );
        if (rows.length > 0) {
            return {
                scope,
                checklistId: rows[0].checklist_id,
                projectId: rows[0].project_id ?? null,
            };
        }
    }
    return null;
}

export async function POST(request: NextRequest) {
    const { payload, response } = requireAuth(request);
    if (!payload) return response;

    try {
        const body = await request.json();
        const {
            stage_id,
            question,
            name,
            input_type,
            photo_required,
            remark_required,
        } = body;

        const effectiveQuestion = (question && String(question).trim()) || (name && String(name).trim());

        if (!stage_id || !effectiveQuestion) {
            return NextResponse.json({ error: 'stage_id and question/name are required.' }, { status: 400 });
        }

        await ensureChecklistSchema(payload.orgId!);

        const owner = await findStageOwner(stage_id);
        if (!owner) {
            return NextResponse.json({ error: 'Stage not found.' }, { status: 404 });
        }

        const t = CHECKLIST_TABLES[owner.scope];

        const { rows: countRows } = await orgQuery(payload.orgId!,
            `SELECT COALESCE(MAX(sr_no), 0) AS max_sr FROM ${t.checkpoint} WHERE ${t.stageFk} = $1`,
            [stage_id]
        );
        const nextSrNo = (parseInt(countRows[0]?.max_sr) || 0) + 1;

        const { rows } = await orgQuery(payload.orgId!,
            `INSERT INTO ${t.checkpoint} (${t.stageFk}, sr_no, question, input_type, photo_required, remark_required)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, ${t.stageFk} AS stage_id, ${t.stageFk}, sr_no, question, input_type, photo_required, remark_required, created_at`,
            [
                stage_id,
                nextSrNo,
                effectiveQuestion,
                input_type || 'yes_no',
                !!photo_required,
                !!remark_required
            ]
        );

        if (owner.projectId) {
            await touchProject(payload.orgId!, owner.projectId, payload.userId);
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

        // A checkpoint's id is unique across both stores, so try each in turn
        // and stop at the first table that actually has a row.
        for (const scope of ['project', 'library'] as ChecklistScope[]) {
            const t = CHECKLIST_TABLES[scope];
            const { rows } = await orgQuery(payload.orgId!,
                `UPDATE ${t.checkpoint}
                 SET question = COALESCE($1, question),
                     input_type = COALESCE($2, input_type),
                     photo_required = COALESCE($3, photo_required),
                     remark_required = COALESCE($4, remark_required),
                     sr_no = COALESCE($5, sr_no)
                 WHERE id = $6
                 RETURNING id, ${t.stageFk} AS stage_id, ${t.stageFk}, sr_no, question, input_type, photo_required, remark_required, created_at`,
                [
                    effectiveQuestion,
                    input_type !== undefined ? input_type : null,
                    photo_required !== undefined ? !!photo_required : null,
                    remark_required !== undefined ? !!remark_required : null,
                    sr_no !== undefined ? Number(sr_no) : null,
                    id
                ]
            );

            if (rows.length > 0) {
                return NextResponse.json({ success: true, checkpoint: rows[0] });
            }
        }

        return NextResponse.json({ error: 'Checkpoint not found.' }, { status: 404 });
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

        for (const scope of ['project', 'library'] as ChecklistScope[]) {
            const t = CHECKLIST_TABLES[scope];
            const { rowCount } = await orgQuery(payload.orgId!,
                `DELETE FROM ${t.checkpoint} WHERE id = $1`,
                [id]
            );

            if ((rowCount ?? 0) > 0) {
                return NextResponse.json({ success: true });
            }
        }

        return NextResponse.json({ error: 'Checkpoint not found.' }, { status: 404 });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
