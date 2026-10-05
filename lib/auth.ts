import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from './db';
import { NextRequest } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET || 'digiqc-saas-jwt-secret-change-in-prod';
const JWT_EXPIRES = '7d';

export interface JwtPayload {
    userId: string;
    email: string;
    orgId?: string | null;
    role?: string;
}

// ─── Password utils ────────────────────────────────────────────
export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
}

// ─── JWT utils ────────────────────────────────────────────────
export function signToken(payload: JwtPayload): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

export function verifyToken(token: string): JwtPayload | null {
    try {
        return jwt.verify(token, JWT_SECRET) as JwtPayload;
    } catch {
        return null;
    }
}

export function signPasswordSetupToken(email: string, userId?: string): string {
    return jwt.sign({ email: email.toLowerCase().trim(), userId: userId || 'new', purpose: 'set-password' }, JWT_SECRET, { expiresIn: '24h' });
}

export function verifyPasswordSetupToken(token: string): { email: string; userId?: string } | null {
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        if (decoded && decoded.email && decoded.purpose === 'set-password') {
            return { email: decoded.email, userId: decoded.userId };
        }
        return null;
    } catch {
        return null;
    }
}

// ─── Session cookie helpers ────────────────────────────────────
export const COOKIE_NAME = 'digiqc_session';

export function getTokenFromCookie(header?: string | null): string | null {
    if (!header) return null;
    const match = header.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
}

export function setCookieHeader(token: string): string {
    return `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}; SameSite=Lax`;
}

export function clearCookieHeader(): string {
    return `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`;
}

/**
 * Extract authenticated context from a Next.js request.
 * Returns { user, orgs, currentOrg } or throws if not authenticated.
 */
export function getAuthContext(request: NextRequest): JwtPayload | null {
    const cookie = request.headers.get('cookie');
    const token = getTokenFromCookie(cookie);
    if (!token) return null;
    return verifyToken(token);
}

/**
 * Middleware helper: returns org-scoped auth context or returns 401 response.
 */
export function requireAuth(request: NextRequest): { payload: JwtPayload; response: null } | { payload: null; response: Response } {
    const payload = getAuthContext(request);
    if (!payload) {
        return {
            payload: null,
            response: new Response(JSON.stringify({ error: 'Not authenticated' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            }),
        };
    }
    return { payload, response: null };
}

// ─── DB helpers ────────────────────────────────────────────────
export async function findUserByEmail(email: string) {
    const { rows } = await pool.query('SELECT * FROM public.users WHERE email = $1', [email.toLowerCase().trim()]);
    return rows[0] || null;
}

export async function findUserById(id: string) {
    const { rows } = await pool.query('SELECT id, name, email, avatar_url, created_at FROM public.users WHERE id = $1', [id]);
    return rows[0] || null;
}

export async function getUserOrgs(userId: string) {
    const { rows } = await pool.query(`
    SELECT o.id, o.name, o.licensing, o.logo_url, om.role
    FROM public.org_members om
    JOIN public.organizations o ON om.organization_id = o.id
    WHERE om.user_id = $1 AND om.status = 'active'
    ORDER BY o.name
  `, [userId]);
    return rows;
}

export async function getUserOrgRole(userId: string, orgId: string) {
    const { rows } = await pool.query(`
    SELECT role FROM public.org_members
    WHERE user_id = $1 AND organization_id = $2 AND status = 'active'
  `, [userId, orgId]);
    return rows[0]?.role || null;
}
