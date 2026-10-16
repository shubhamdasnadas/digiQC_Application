import { NextResponse } from 'next/server';
import { getHealthStatus } from '@/lib/health';

export const dynamic = 'force-dynamic';

/**
 * GET /health
 * Public health-check endpoint.
 * - HTTP 200: Server is on and dependencies (e.g. database) are healthy.
 * - HTTP 503: Server is responsive, but dependencies are offline or degraded (includes reason).
 */
export async function GET() {
  const { statusCode, data } = await getHealthStatus();
  return NextResponse.json(data, {
    status: statusCode,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Content-Type': 'application/json',
    },
  });
}

/**
 * HEAD /health
 * Lightweight ping check for load balancers and orchestrators.
 */
export async function HEAD() {
  const { statusCode, data } = await getHealthStatus();
  return new NextResponse(null, {
    status: statusCode,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Server-Status': data.server,
    },
  });
}
