import { NextResponse } from 'next/server';
import { getHealthStatus } from '@/lib/health';

export const dynamic = 'force-dynamic';

/**
 * GET /api/health
 * Public health-check endpoint (alias under /api prefix).
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
 * HEAD /api/health
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
