import 'dotenv/config';
import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  host: process.env.PG_HOST,
  port: process.env.PG_PORT ? Number(process.env.PG_PORT) : undefined,
  database: process.env.PG_DATABASE,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
});

// Schema names are derived server-side by org_schema_name() (public.organizations.name,
// lowercased with non-alphanumerics collapsed to '_'), so this is safe to interpolate.
export async function orgSchema(orgId: string): Promise<string> {
  const { rows } = await pool.query('SELECT public.org_schema_name($1) AS schema_name', [orgId]);
  if (!rows[0]?.schema_name) {
    throw new Error(`Unknown organization: ${orgId}`);
  }
  return rows[0].schema_name;
}
