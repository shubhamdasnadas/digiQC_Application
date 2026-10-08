import { NextRequest, NextResponse } from 'next/server';
import { verifyPasswordSetupToken, hashPassword, signToken, setCookieHeader } from '@/lib/auth';
import pool, { ensurePublicSchemaTables } from '@/lib/db';

export async function GET(request: NextRequest) {
    try {
        await ensurePublicSchemaTables();
        const { searchParams } = new URL(request.url);
        const token = searchParams.get('token');
        const emailParam = searchParams.get('email');

        let email = (emailParam || '').toLowerCase().trim();

        if (token) {
            const decoded = verifyPasswordSetupToken(token);
            if (decoded && decoded.email) {
                email = decoded.email.toLowerCase().trim();
            }
        }

        if (!email) {
            return NextResponse.json({ error: 'Email or valid token required' }, { status: 400 });
        }

        // Look up in public.users first, then public.members
        let userName = '';
        try {
            const { rows: userRows } = await pool.query(
                'SELECT id, name, email FROM public.users WHERE LOWER(TRIM(email)) = LOWER(TRIM($1)) LIMIT 1',
                [email]
            );
            if (userRows.length > 0 && userRows[0].name) {
                userName = userRows[0].name;
            }
        } catch (uErr) {
            console.warn('users table check warning:', uErr);
        }

        if (!userName) {
            try {
                const { rows: memberRows } = await pool.query(
                    'SELECT name, email FROM public.members WHERE LOWER(TRIM(email)) = LOWER(TRIM($1)) LIMIT 1',
                    [email]
                );
                if (memberRows.length > 0 && memberRows[0].name) {
                    userName = memberRows[0].name;
                }
            } catch (mErr) {
                console.warn('members table check warning:', mErr);
            }
        }

        return NextResponse.json({
            valid: true,
            email,
            name: userName || email.split('@')[0],
        });
    } catch (error) {
        console.error('Error in GET /api/auth/set-password:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        await ensurePublicSchemaTables();
        const body = await request.json();
        const { token, email, name: requestedName, password } = body;

        if (!password || String(password).length < 6) {
            return NextResponse.json({ error: 'Password must be at least 6 characters long' }, { status: 400 });
        }

        let verifiedEmail = (email || '').toLowerCase().trim();

        if (token) {
            const decoded = verifyPasswordSetupToken(token);
            if (decoded && decoded.email) {
                verifiedEmail = decoded.email.toLowerCase().trim();
            }
        }

        if (!verifiedEmail) {
            return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 });
        }

        // Generate strong bcrypt salt + hash for the password
        const passwordHash = await hashPassword(password);

        // Check if user already exists in public.users table
        let existingUsers: any[] = [];
        try {
            const res = await pool.query(
                'SELECT id, name, email FROM public.users WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))',
                [verifiedEmail]
            );
            existingUsers = res.rows;
        } catch (e) {
            console.warn('Error querying public.users:', e);
        }

        // Check member record to get existing organization, member name, and role
        let memberRows: any[] = [];
        try {
            const mRes = await pool.query(
                'SELECT id, name, organization_id, default_role FROM public.members WHERE LOWER(TRIM(email)) = LOWER(TRIM($1)) LIMIT 1',
                [verifiedEmail]
            );
            memberRows = mRes.rows;
        } catch (e) {
            console.warn('Error querying public.members:', e);
        }

        const memberName = memberRows[0]?.name;
        const orgId = memberRows[0]?.organization_id || null;
        const memberRole = memberRows[0]?.default_role || 'User';

        // Determine final username to store in public.users table
        const defaultName = verifiedEmail.split('@')[0];
        const resolvedName = (requestedName || memberName || existingUsers[0]?.name || defaultName || 'User').trim();

        let userRecord: { id: string; name: string; email: string };

        if (existingUsers.length > 0) {
            // Update existing user with new hashed password and name
            const { rows: updatedUsers } = await pool.query(
                `UPDATE public.users
                 SET password_hash = $1, name = COALESCE(NULLIF($2, ''), name), updated_at = NOW()
                 WHERE id = $3
                 RETURNING id, name, email`,
                [passwordHash, resolvedName, existingUsers[0].id]
            );
            userRecord = updatedUsers[0];
        } else {
            // Insert new user; if email already exists, update safely
            try {
                const { rows: newUsers } = await pool.query(
                    `INSERT INTO public.users (name, email, password_hash, created_at, updated_at)
                     VALUES ($1, $2, $3, NOW(), NOW())
                     RETURNING id, name, email`,
                    [resolvedName, verifiedEmail, passwordHash]
                );
                userRecord = newUsers[0];
            } catch (insertErr) {
                const { rows: fallbackUpdate } = await pool.query(
                    `UPDATE public.users
                     SET password_hash = $1, name = COALESCE(NULLIF($2, ''), name), updated_at = NOW()
                     WHERE LOWER(TRIM(email)) = LOWER(TRIM($3))
                     RETURNING id, name, email`,
                    [passwordHash, resolvedName, verifiedEmail]
                );
                if (fallbackUpdate.length > 0) {
                    userRecord = fallbackUpdate[0];
                } else {
                    throw insertErr;
                }
            }
        }

        // Link user to organization in public.org_members if an organization is associated
        if (orgId && userRecord?.id) {
            try {
                const { rows: orgCheck } = await pool.query(
                    'SELECT id FROM public.organizations WHERE id = $1',
                    [orgId]
                );
                if (orgCheck.length > 0) {
                    const orgRole = memberRole.toLowerCase() === 'admin' ? 'admin' : 'member';
                    await pool.query(
                        `INSERT INTO public.org_members (user_id, organization_id, role, status, created_at)
                         VALUES ($1, $2, $3, 'active', NOW())
                         ON CONFLICT (user_id, organization_id) DO UPDATE
                         SET role = EXCLUDED.role, status = 'active'`,
                        [userRecord.id, orgId, orgRole]
                    );
                }
            } catch (omErr) {
                console.warn('Note: org_members link exception:', omErr);
            }
        }

        // Update member active and password status, and updated_at timestamp in public.members
        try {
            await pool.query(
                "UPDATE public.members SET password_status = 'completed', status = 'active', active = true, updated_at = NOW() WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))",
                [verifiedEmail]
            );
        } catch (memErr) {
            console.warn('Note: members update exception:', memErr);
        }

        // Generate session token
        const sessionToken = signToken({
            userId: userRecord.id,
            email: userRecord.email,
            orgId,
            role: memberRole,
        });

        const res = NextResponse.json({
            success: true,
            message: 'Password created successfully and user saved in database',
            user: { id: userRecord.id, name: userRecord.name, email: userRecord.email },
        });

        res.headers.set('Set-Cookie', setCookieHeader(sessionToken));
        return res;
    } catch (error) {
        console.error('Error in POST /api/auth/set-password:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
