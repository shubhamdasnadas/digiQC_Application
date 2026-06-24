import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromCookie, verifyToken, findUserById, getUserOrgs, getUserOrgRole } from '@/lib/auth';

export async function GET(request: NextRequest) {
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

        const user = await findUserById(payload.userId);
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 401 });
        }

        const orgs = await getUserOrgs(payload.userId);

        // Verify the current org is still valid
        let currentOrg = null;
        if (payload.orgId) {
            const role = await getUserOrgRole(payload.userId, payload.orgId);
            if (role) {
                currentOrg = orgs.find((o: any) => o.id === payload.orgId) || null;
            }
        }

        // If no valid current org, default to first
        if (!currentOrg && orgs.length > 0) {
            currentOrg = orgs[0];
        }

        return NextResponse.json({ user, orgs, currentOrg });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
