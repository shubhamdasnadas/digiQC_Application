import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromCookie, verifyToken, signToken, setCookieHeader, getUserOrgRole, findUserById } from '@/lib/auth';

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

        const { orgId } = await request.json();
        if (!orgId) {
            return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 });
        }

        const role = await getUserOrgRole(payload.userId, orgId);
        if (!role) {
            return NextResponse.json({ error: 'Not a member of this organization' }, { status: 403 });
        }

        const newToken = signToken({
            userId: payload.userId,
            email: payload.email,
            orgId,
            role,
        });

        const user = await findUserById(payload.userId);

        const response = NextResponse.json({
            user,
            currentOrg: { id: orgId, role },
        });

        response.headers.set('Set-Cookie', setCookieHeader(newToken));
        return response;
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
