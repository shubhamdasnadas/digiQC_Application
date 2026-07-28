/**
 * One-off CSV importer for the teams table.
 *
 * Run: node scripts/import-teams-csv.js <path-to-csv> "<Org Name>"
 *
 * Wipes all existing rows in that org's teams table, then inserts
 * fresh rows from the CSV (columns: Name, Type, Active Assigned Projects,
 * Inactive Assigned Projects).
 */

const { Pool } = require('pg');
const XLSX = require('xlsx-js-style');
const fs = require('fs');

const [, , csvPath, orgName] = process.argv;

if (!csvPath || !orgName) {
    console.error('Usage: node scripts/import-teams-csv.js <path-to-csv> "<Org Name>"');
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

        await client.query(`DELETE FROM "${schema}".teams`);
        console.log(`Cleared existing teams in "${orgName}"`);

        for (const row of parsed) {
            await client.query(
                `INSERT INTO "${schema}".teams (organization_id, name, type, active_projects, inactive_projects)
         VALUES ($1, $2, $3, $4, $5)`,
                [
                    orgId,
                    row['Name'] || 'Unnamed',
                    (row['Type'] || 'inspection').toLowerCase(),
                    row['Active Assigned Projects'] || '',
                    row['Inactive Assigned Projects'] || '',
                ]
            );
        }

        console.log(`Inserted ${parsed.length} teams into "${orgName}"`);
    } finally {
        client.release();
        await pool.end();
    }
}

run().catch(err => {
    console.error('Import failed:', err);
    process.exit(1);
});
