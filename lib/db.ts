import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || '5432'),
  database: process.env.PG_DATABASE || 'digiQC',
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || 'root',
});

function orgSchemaName(orgName: string): string {
  return 'org_' + orgName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

/**
 * Get a schema-qualified client for multi-tenant operations.
 * Uses the organization's schema (org_<sanitized_org_name>).
 * All subsequent queries on this client will be scoped to that schema.
 *
 * If orgId is null/undefined, the public schema is used (for auth/org CRUD).
 */
export async function getSchemaClient(orgId?: string | null) {
  const client = await pool.connect();
  if (orgId) {
    const { rows } = await client.query<{ name: string }>(
      'SELECT name FROM public.organizations WHERE id = $1',
      [orgId]
    );
    const schemaName = rows[0] ? orgSchemaName(rows[0].name) : `org_${orgId.replace(/-/g, '_')}`;
    await client.query(`SET search_path TO "${schemaName}", public`);
  } else {
    await client.query(`SET search_path TO public`);
  }
  return client;
}

/**
 * Execute a raw query on the pool (public schema).
 * Use this for auth, org management, etc.
 */
export function query(text: string, params?: any[]) {
  return pool.query(text, params);
}

/**
 * Execute a query scoped to a specific org schema.
 */
export async function orgQuery(orgId: string, text: string, params?: any[]) {
  const client = await getSchemaClient(orgId);
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
}

export default pool;
