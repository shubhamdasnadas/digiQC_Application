import { NextRequest, NextResponse } from 'next/server';
import { findUserByIdentifier } from '@/lib/auth';
import { ensurePublicSchemaTables } from '@/lib/db';

export async function POST(request: NextRequest) {
    try {
        await ensurePublicSchemaTables();
        const body = await request.json();
        const { identifier } = body;

        if (!identifier || !String(identifier).trim()) {
            return NextResponse.json({ error: 'Email or mobile number is required' }, { status: 400 });
        }

        const user = await findUserByIdentifier(String(identifier).trim());

        if (!user) {
            return NextResponse.json({
                exists: false,
                error: 'No account found with this email or mobile number. Please check your credentials or create an account.'
            }, { status: 404 });
        }

        return NextResponse.json({
            exists: true,
            email: user.email,
            name: user.name || '',
            hasPassword: Boolean(user.password_hash && user.password_hash.trim().length > 5)
        });
    } catch (error) {
        console.error('Error in check-user route:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
