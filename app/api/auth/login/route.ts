import { NextRequest, NextResponse } from 'next/server';
import { findUserByEmail, verifyPassword, signToken, setCookieHeader, getUserOrgs } from '@/lib/auth';
import { ensurePublicSchemaTables } from '@/lib/db';

export async function POST(request: NextRequest) {
    try {
        await ensurePublicSchemaTables();
        const { email, password } = await request.json();

        if (!email || !password) {
            return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
        }

        const user = await findUserByEmail(String(email).trim());
        if (!user) {
            return NextResponse.json({ error: 'No account found with this email' }, { status: 401 });
        }

        if (!user.password_hash || user.password_hash.trim() === '') {
            return NextResponse.json({
                error: 'No password has been set for this account. Please sign in using OTP or set your password.'
            }, { status: 401 });
        }

        const valid = await verifyPassword(password, user.password_hash);
        if (!valid) {
            return NextResponse.json({ error: 'Incorrect password. Please try again or sign in with OTP.' }, { status: 401 });
        }

        // Credentials matched with database - log in directly and issue session cookie
        const orgs = await getUserOrgs(user.id);
        const defaultOrg = orgs.length > 0 ? orgs[0] : null;

        const token = signToken({
            userId: user.id,
            email: user.email,
            orgId: defaultOrg?.id || null,
            role: defaultOrg?.role || null,
        });

        const response = NextResponse.json({
            success: true,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                avatar_url: user.avatar_url,
                created_at: user.created_at,
            },
            orgs,
            currentOrg: defaultOrg,
            message: 'Signed in successfully',
        });

        response.headers.set('Set-Cookie', setCookieHeader(token));
        return response;
    } catch (error) {
        console.error('Error in login route:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
