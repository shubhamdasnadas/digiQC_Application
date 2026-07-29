// One-off script: add missing columns to org-schema tables that
// the dashboard query depends on (eqcs.status, issues.status, etc.).
// Idempotent — safe to re-run.
import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
    host: process.env.PG_HOST,
    port: Number(process.env.PG_PORT || 5432),
    database: process.env.PG_DATABASE,
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
});

const { rows: orgs } = await pool.query(
    `SELECT id, name FROM public.organizations`
);
console.log(`Found ${orgs.length} org(s).`);

for (const org of orgs) {
    const { rows: sn } = await pool.query(
        `SELECT public.org_schema_name($1::uuid) AS s`,
        [org.id]
    );
    const schema = sn[0].s;
    console.log(`\n=== Patching schema ${schema} ===`);

    // eqcs
    await pool.query(
        `ALTER TABLE "${schema}".eqcs
       ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending'
         CHECK (status IN ('passed','failed','pending','rfi')),
       ADD COLUMN IF NOT EXISTS stage_result text DEFAULT 'pending'
         CHECK (stage_result IN ('pass','fail','pending')),
       ADD COLUMN IF NOT EXISTS total_stages integer NOT NULL DEFAULT 1,
       ADD COLUMN IF NOT EXISTS stage_index integer NOT NULL DEFAULT 1,
       ADD COLUMN IF NOT EXISTS inspected_by uuid,
       ADD COLUMN IF NOT EXISTS inspected_at timestamptz,
       ADD COLUMN IF NOT EXISTS rfi_id uuid,
       ADD COLUMN IF NOT EXISTS notes text DEFAULT '',
       ADD COLUMN IF NOT EXISTS assigned_user_ids uuid[] NOT NULL DEFAULT '{}',
       ADD COLUMN IF NOT EXISTS assigned_team_ids uuid[] NOT NULL DEFAULT '{}',
       ADD COLUMN IF NOT EXISTS approver_id uuid,
       ADD COLUMN IF NOT EXISTS approver_log text DEFAULT ''`
    );
    console.log('  eqcs patched');

    // issues
    await pool.query(
        `ALTER TABLE "${schema}".issues
       ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'medium'
         CHECK (severity IN ('low','medium','high','critical')),
       ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open'
         CHECK (status IN ('open','in_progress','resolved','closed')),
       ADD COLUMN IF NOT EXISTS assignee_id uuid,
       ADD COLUMN IF NOT EXISTS reported_by uuid,
       ADD COLUMN IF NOT EXISTS due_date date,
       ADD COLUMN IF NOT EXISTS description text DEFAULT ''`
    );
    console.log('  issues patched');

    // checklists
    await pool.query(
        `ALTER TABLE "${schema}".checklists
       ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft',
       ADD COLUMN IF NOT EXISTS uom text,
       ADD COLUMN IF NOT EXISTS reference_number text`
    );
    console.log('  checklists patched');

    // projects
    await pool.query(
        `ALTER TABLE "${schema}".projects
       ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
       ADD COLUMN IF NOT EXISTS updated_by uuid,
       ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now()`
    );
    console.log('  projects patched');

    // register_entries
    await pool.query(
        `ALTER TABLE "${schema}".register_entries
       ADD COLUMN IF NOT EXISTS status text DEFAULT 'active'`
    );
    console.log('  register_entries patched');
}

await pool.end();
console.log('\nAll schemas patched successfully.');
