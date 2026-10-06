import { NextRequest, NextResponse } from 'next/server';
import { findUserByEmail, signToken, setCookieHeader, getUserOrgs } from '@/lib/auth';
import { verifyOtpCode } from '@/lib/otp';
import { ensurePublicSchemaTables } from '@/lib/db';

export async function POST(request: NextRequest) {
    try {
        await ensurePublicSchemaTables();
        const { email, otp } = await request.json();

        if (!email || !otp) {
            return NextResponse.json({ error: 'Email and verification code are required' }, { status: 400 });
        }

        const isValid = await verifyOtpCode(String(email).trim(), String(otp).trim());
        if (!isValid) {
            return NextResponse.json({ error: 'Invalid or expired verification code. Please request a new code.' }, { status: 400 });
        }

        const user = await findUserByEmail(String(email).trim());
        if (!user) {
            return NextResponse.json({ error: 'User account not found' }, { status: 404 });
        }

        // Get organizations the user belongs to
        const orgs = await getUserOrgs(user.id);

        // Auto-select default organization (first active org) so user goes straight to dashboard
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
            message: 'Signed in successfully with OTP',
        });

        response.headers.set('Set-Cookie', setCookieHeader(token));
        return response;
    } catch (error) {
        console.error('Error in verify-otp route:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
