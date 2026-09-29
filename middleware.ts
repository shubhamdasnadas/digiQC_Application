import { NextRequest, NextResponse } from 'next/server';

// Edge-runtime safe JWT payload decoder (no Node crypto dependencies)
// This only decodes the payload — signature verification happens in API routes
function decodeJwtPayload(token: string): Record<string, unknown> | null {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const payload = parts[1];
        // Base64url decode
        const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
        const jsonStr = atob(base64);
        return JSON.parse(jsonStr);
    } catch {
        return null;
    }
}

const COOKIE_NAME = 'digiqc_session';

function getTokenFromCookie(header: string): string | null {
    const match = header.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
}

// Routes that don't require authentication
const publicRoutes = ['/login', '/register', '/register/verify-otp', '/login/verify-otp'];

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Static files and Next.js internals
    if (
        pathname.startsWith('/_next') ||
        pathname.startsWith('/favicon') ||
        pathname.startsWith('/images') ||
        pathname === '/'
    ) {
        return NextResponse.next();
    }

    // Public routes
    if (publicRoutes.includes(pathname)) {
        return NextResponse.next();
    }

    // Public API prefixes (auth endpoints)
    if (
        pathname.startsWith('/api/auth/login') ||
        pathname.startsWith('/api/auth/register') ||
        pathname.startsWith('/api/auth/verify-otp') ||
        pathname.startsWith('/api/auth/resend-otp')
    ) {
        return NextResponse.next();
    }

    // Check for auth cookie
    const cookie = request.headers.get('cookie') || '';
    const token = getTokenFromCookie(cookie);

    if (!token) {
        if (pathname.startsWith('/api/')) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }
        return NextResponse.redirect(new URL('/login', request.url));
    }

    // Decode JWT to check user session (no signature verify — API routes do that)
    const payload = decodeJwtPayload(token);
    if (!payload || !payload.userId) {
        // Token invalid
        const response = NextResponse.redirect(new URL('/login', request.url));
        response.headers.set(
            'Set-Cookie',
            `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`
        );
        return response;
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
