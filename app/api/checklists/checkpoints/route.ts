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
        const { checklist_id, stage_id, question, input_type, photo_required, remark_required } = body;

        if (!stage_id || !question || !String(question).trim()) {
            return NextResponse.json({ error: 'stage_id and question are required.' }, { status: 400 });
        }

        await ensureChecklistSchema(payload.orgId!);

        const { rows: stageRows } = await orgQuery(payload.orgId!,
            `SELECT c.project_id FROM checklist_stages cs
             JOIN checklists c ON c.id = cs.checklist_id
             WHERE cs.id = $1 AND cs.checklist_id = $2`,
            [stage_id, checklist_id]
        );
        if (stageRows.length === 0) {
            return NextResponse.json({ error: 'stage_id does not belong to checklist_id.' }, { status: 400 });
        }

        const { rows: countRows } = await orgQuery(payload.orgId!,
            `SELECT count(*) AS count FROM checkpoints WHERE stage_id = $1`,
            [stage_id]
        );
        const nextSrNo = parseInt(countRows[0].count) + 1;

        const { rows } = await orgQuery(payload.orgId!,
            `INSERT INTO checkpoints (stage_id, sr_no, question, input_type, photo_required, remark_required)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [stage_id, nextSrNo, question, input_type || 'yes_no', !!photo_required, !!remark_required]
        );

        if (stageRows[0].project_id) await touchProject(payload.orgId!, stageRows[0].project_id, payload.userId);
        return NextResponse.json({ success: true, checkpoint: rows[0] });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
