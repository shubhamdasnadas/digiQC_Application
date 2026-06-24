import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    const { rows } = await pool.query('SELECT * FROM organizations ORDER BY created_at DESC');
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rows = body.rows ?? [body];

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const insertedIds: string[] = [];
      for (const row of rows) {
        const result = await client.query(
          `INSERT INTO organizations (name, user_limit, licensing, expiry_date, logo_url, console_uses)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id`,
          [
            row.name,
            row.user_limit ?? 10,
            row.licensing ?? 'Starter',
            row.expiry_date || null,
            row.logo_url ?? '',
            row.console_uses ?? 0,
          ]
        );
        insertedIds.push(result.rows[0].id);
      }
      await client.query('COMMIT');
      client.release();

      // If this is a single new org, create its schema and return the ID
      if (insertedIds.length === 1) {
        const orgId = insertedIds[0];
        // Auto-create the org schema via the DB function
        await pool.query('SELECT public.create_org_schema($1)', [orgId]);
        return NextResponse.json({ success: true, organizationId: orgId });
      }
      return NextResponse.json({ success: true });
    } catch (err) {
      await client.query('ROLLBACK');
      client.release();
      throw err;
    }
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
