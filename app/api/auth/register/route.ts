import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { hashPassword, signToken, setCookieHeader, findUserByEmail } from '@/lib/auth';

export async function POST(request: NextRequest) {
    try {
        const { name, email, password } = await request.json();

        if (!name || !email || !password) {
            return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 });
        }
        if (password.length < 6) {
            return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
        }

        const existing = await findUserByEmail(email);
        if (existing) {
            return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
        }

        const passwordHash = await hashPassword(password);

        const { rows } = await pool.query(
            `INSERT INTO public.users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, avatar_url, created_at`,
            [name.trim(), email.toLowerCase().trim(), passwordHash]
        );

        const user = rows[0];
        const token = signToken({ userId: user.id, email: user.email });

        const response = NextResponse.json({
            user,
            orgs: [],
            currentOrg: null,
        });

        response.headers.set('Set-Cookie', setCookieHeader(token));
        return response;
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
