import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getTokenFromCookie, verifyToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
    try {
        const cookie = request.headers.get('cookie');
        const token = getTokenFromCookie(cookie);
        if (!token) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const payload = verifyToken(token);
        if (!payload) {
            return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
        }

        const { organizationId, role } = await request.json();
        if (!organizationId) {
            return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 });
        }

        // Check if already a member
        const { rows: existing } = await pool.query(
            'SELECT id FROM public.org_members WHERE user_id = $1 AND organization_id = $2',
            [payload.userId, organizationId]
        );
        if (existing.length > 0) {
            return NextResponse.json({ success: true, message: 'Already a member' });
        }

        // Add user as member
        const memberRole = role || 'admin';
        await pool.query(
            `INSERT INTO public.org_members (user_id, organization_id, role, status)
             VALUES ($1, $2, $3, 'active')`,
            [payload.userId, organizationId, memberRole]
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
