/**
 * One-off CSV importer for the members table.
 *
 * Run: node scripts/import-members-csv.js <path-to-csv> "<Org Name>"
 *
 * Inserts rows from the CSV (columns: Name, Email, Phone No, Access Type,
 * Active, Default Role, Team, Active Assigned Projects, Inactive Assigned Projects).
 */

const { Pool } = require('pg');
const XLSX = require('xlsx-js-style');
const fs = require('fs');

const [, , csvPath, orgName] = process.argv;

if (!csvPath || !orgName) {
    console.error('Usage: node scripts/import-members-csv.js <path-to-csv> "<Org Name>"');
    process.exit(1);
}

const pool = new Pool({
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432'),
    database: process.env.PG_DATABASE || 'digiQC',
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || 'root',
});

function schemaName(name) {
    return 'org_' + name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

async function run() {
    const client = await pool.connect();
    try {
        const { rows: orgRows } = await client.query('SELECT id FROM public.organizations WHERE name = $1', [orgName]);
        if (orgRows.length === 0) throw new Error(`Organization "${orgName}" not found`);
        const orgId = orgRows[0].id;
        const schema = schemaName(orgName);

        const csvText = fs.readFileSync(csvPath, 'utf8');
        const workbook = XLSX.read(csvText, { type: 'string' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const parsed = XLSX.utils.sheet_to_json(sheet);

        console.log(`Parsed ${parsed.length} rows from ${csvPath}`);

        for (const row of parsed) {
            await client.query(
                `INSERT INTO "${schema}".members (organization_id, name, email, phone, access_type, active, default_role, teams, active_projects, inactive_projects)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                [
                    orgId,
                    row['Name'] || 'Unnamed',
                    row['Email'] || '',
                    String(row['Phone No'] ?? ''),
                    row['Access Type'] || '',
                    String(row['Active'] || '').trim().toLowerCase() === 'yes',
                    row['Default Role'] || '',
                    row['Team'] || '',
                    row['Active Assigned Projects'] || '',
                    row['Inactive Assigned Projects'] || '',
                ]
            );
        }

        console.log(`Inserted ${parsed.length} members into "${orgName}"`);
    } finally {
        client.release();
        await pool.end();
    }
}

run().catch(err => {
    console.error('Import failed:', err);
    process.exit(1);
});
