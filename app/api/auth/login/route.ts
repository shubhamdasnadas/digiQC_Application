import { NextRequest, NextResponse } from 'next/server';
import { findUserByEmail, verifyPassword, signToken, setCookieHeader, getUserOrgs } from '@/lib/auth';
import pool from '@/lib/db';

export async function POST(request: NextRequest) {
    try {
        const { email, password } = await request.json();

        if (!email || !password) {
            return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
        }

        const user = await findUserByEmail(email);
        if (!user) {
            return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
        }

        const valid = await verifyPassword(password, user.password_hash);
        if (!valid) {
            return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
        }

        // Get orgs the user belongs to
        const orgs = await getUserOrgs(user.id);

        // Find default active org if any
        const defaultOrg = orgs.length > 0 ? orgs[0] : null;

        const token = signToken({
            userId: user.id,
            email: user.email,
            orgId: defaultOrg?.id || null,
            role: defaultOrg?.role || null,
        });

        const response = NextResponse.json({
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                avatar_url: user.avatar_url,
                created_at: user.created_at,
            },
            orgs,
            currentOrg: defaultOrg,
        });

        response.headers.set('Set-Cookie', setCookieHeader(token));
        return response;
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
