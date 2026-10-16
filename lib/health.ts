import pool from '@/lib/db';

export interface ServiceHealth {
  status: 'on' | 'off' | 'connected' | 'disconnected' | 'degraded';
  message: string;
  latencyMs?: number;
  error?: string;
}

export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  server: 'on' | 'off' | 'degraded';
  message: string;
  reason?: string;
  timestamp: string;
  uptime: number;
  uptimeFormatted: string;
  services: {
    server: ServiceHealth;
    database: ServiceHealth;
  };
  system: {
    nodeVersion: string;
    environment: string;
    memory: {
      rss: string;
      heapTotal: string;
      heapUsed: string;
    };
  };
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ') || '0s';
}

function getMemoryUsage() {
  const mem = process.memoryUsage();
  return {
    rss: `${Math.round(mem.rss / (1024 * 1024))} MB`,
    heapTotal: `${Math.round(mem.heapTotal / (1024 * 1024))} MB`,
    heapUsed: `${Math.round(mem.heapUsed / (1024 * 1024))} MB`,
  };
}

/**
 * Checks PostgreSQL database connection with an explicit timeout.
 */
export async function checkDatabaseHealth(timeoutMs = 4000): Promise<{
  connected: boolean;
  latencyMs?: number;
  error?: string;
}> {
  try {
    const start = performance.now();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Database health check timed out after ${timeoutMs}ms`)),
        timeoutMs
      )
    );

    await Promise.race([
      pool.query('SELECT 1 AS health_check'),
      timeoutPromise,
    ]);

    const latencyMs = Math.round(performance.now() - start);
    return { connected: true, latencyMs };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return { connected: false, error: errorMessage };
  }
}

/**
 * Evaluates the health status of the server and its dependencies.
 * - If server and database are healthy: returns HTTP 200 with success message.
 * - If server is up but database is offline/degraded: returns HTTP 503 with the failure reason.
 * - If catastrophic failure occurs: returns HTTP 500 with failure reason.
 */
export async function getHealthStatus(): Promise<{ statusCode: number; data: HealthCheckResponse }> {
  const uptimeSeconds = process.uptime();
  const uptimeFormatted = formatUptime(uptimeSeconds);
  const memory = getMemoryUsage();
  const timestamp = new Date().toISOString();
  const environment = process.env.NODE_ENV || 'development';

  try {
    const dbResult = await checkDatabaseHealth();

    if (dbResult.connected) {
      return {
        statusCode: 200,
        data: {
          status: 'healthy',
          server: 'on',
          message: 'Server is up and running successfully',
          timestamp,
          uptime: Math.round(uptimeSeconds),
          uptimeFormatted,
          services: {
            server: {
              status: 'on',
              message: 'HTTP server is running and accepting requests',
            },
            database: {
              status: 'connected',
              message: 'PostgreSQL database connection is operational',
              latencyMs: dbResult.latencyMs,
            },
          },
          system: {
            nodeVersion: process.version,
            environment,
            memory,
          },
        },
      };
    } else {
      return {
        statusCode: 503,
        data: {
          status: 'unhealthy',
          server: 'degraded',
          message: 'Server is running, but critical dependencies are offline',
          reason: `Database connection failed: ${dbResult.error}`,
          timestamp,
          uptime: Math.round(uptimeSeconds),
          uptimeFormatted,
          services: {
            server: {
              status: 'on',
              message: 'HTTP server is running and accepting requests',
            },
            database: {
              status: 'disconnected',
              message: 'PostgreSQL database connection failed',
              error: dbResult.error,
            },
          },
          system: {
            nodeVersion: process.version,
            environment,
            memory,
          },
        },
      };
    }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error during health check';
    return {
      statusCode: 500,
      data: {
        status: 'unhealthy',
        server: 'off',
        message: 'Server health check encountered an unexpected error',
        reason: errorMessage,
        timestamp,
        uptime: Math.round(uptimeSeconds),
        uptimeFormatted,
        services: {
          server: {
            status: 'off',
            message: 'Server encountered a fatal error during health check',
            error: errorMessage,
          },
          database: {
            status: 'disconnected',
            message: 'Database status could not be verified',
          },
        },
        system: {
          nodeVersion: process.version,
          environment,
          memory,
        },
      },
    };
  }
}
