import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { orgQuery } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
    const { payload, response } = requireAuth(request);
    if (!payload) return response;

    try {
        const filePath = path.join(process.cwd(), 'db', 'migration_checklists_v3.sql');
        const sql = fs.readFileSync(filePath, 'utf8');

        // Split SQL by semicolon to execute multiple statements
        const statements = sql.split(';').filter(s => s.trim());

        for (const statement of statements) {
            await orgQuery(payload.orgId!, statement);
        }

        return NextResponse.json({ success: true, message: 'Migration applied successfully' });
    } catch (error) {
        console.error('Migration error:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}