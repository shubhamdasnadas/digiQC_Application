/**
 * Script to import Users, Members, and Teams from CSV files into public schema.
 * Run: node scripts/import-users-teams-csv.js
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Load .env.local or .env if exists
const envLocalPath = path.join(__dirname, '..', '.env.local');
const envPath = path.join(__dirname, '..', '.env');
const targetEnv = fs.existsSync(envLocalPath) ? envLocalPath : fs.existsSync(envPath) ? envPath : null;

if (targetEnv) {
  const envContent = fs.readFileSync(targetEnv, 'utf8');
  envContent.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  });
}

const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || '5432'),
  database: process.env.PG_DATABASE || 'digiqc_new',
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || 'root',
});

function parseCSV(content) {
  const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) return [];

  const parseLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    if (values.length === headers.length) {
      const row = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx];
      });
      rows.push(row);
    }
  }

  return rows;
}

async function importData() {
  const client = await pool.connect();
  console.log('Connected to PostgreSQL database\n');

  try {
    await client.query('BEGIN');

    // 1. Ensure table columns exist in public schema
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        email text NOT NULL UNIQUE,
        password_hash text NOT NULL,
        avatar_url text DEFAULT '',
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS public.members (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid,
        name text NOT NULL,
        email text DEFAULT '',
        phone text DEFAULT '',
        access_type text DEFAULT '',
        active boolean DEFAULT true,
        default_role text DEFAULT '',
        teams text DEFAULT '',
        active_projects text DEFAULT '',
        inactive_projects text DEFAULT '',
        created_at timestamptz DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS public.teams (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid,
        name text NOT NULL,
        type text DEFAULT 'inspection',
        team_lead_name text DEFAULT '',
        spoc_name text DEFAULT '',
        active_projects text DEFAULT '',
        inactive_projects text DEFAULT '',
        created_at timestamptz DEFAULT now()
      );

      ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS organization_id uuid;
      ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS name text;
      ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS type text DEFAULT 'DEFAULT';
      ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS team_lead_name text DEFAULT '';
      ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS spoc_name text DEFAULT '';
      ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS active_projects text DEFAULT '';
      ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS inactive_projects text DEFAULT '';
      ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

      ALTER TABLE public.members ADD COLUMN IF NOT EXISTS organization_id uuid;
      ALTER TABLE public.members ADD COLUMN IF NOT EXISTS name text;
      ALTER TABLE public.members ADD COLUMN IF NOT EXISTS email text DEFAULT '';
      ALTER TABLE public.members ADD COLUMN IF NOT EXISTS phone text DEFAULT '';
      ALTER TABLE public.members ADD COLUMN IF NOT EXISTS access_type text DEFAULT '';
      ALTER TABLE public.members ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;
      ALTER TABLE public.members ADD COLUMN IF NOT EXISTS default_role text DEFAULT '';
      ALTER TABLE public.members ADD COLUMN IF NOT EXISTS teams text DEFAULT '';
      ALTER TABLE public.members ADD COLUMN IF NOT EXISTS active_projects text DEFAULT '';
      ALTER TABLE public.members ADD COLUMN IF NOT EXISTS inactive_projects text DEFAULT '';
      ALTER TABLE public.members ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
    `);

    // 2. Import Teams from TEAM-LIST-07-07-2026-06-45-30.csv
    const teamCsvPath = path.join(__dirname, '..', 'TEAM-LIST-07-07-2026-06-45-30.csv');
    if (fs.existsSync(teamCsvPath)) {
      const teamCsvContent = fs.readFileSync(teamCsvPath, 'utf8');
      const teamRows = parseCSV(teamCsvContent);
      console.log(`Found ${teamRows.length} teams in CSV`);

      for (const t of teamRows) {
        const name = (t['Name'] || '').trim();
        if (!name) continue;

        const type = (t['Type'] || 'DEFAULT').trim();
        const activeProjects = (t['Active Assigned Projects'] || '').trim();
        const inactiveProjects = (t['Inactive Assigned Projects'] || '').trim();

        // Check if team already exists
        const { rows: existing } = await client.query(
          `SELECT id FROM public.teams WHERE LOWER(name) = LOWER($1)`,
          [name]
        );

        if (existing.length > 0) {
          await client.query(
            `UPDATE public.teams
             SET type = $1, active_projects = $2, inactive_projects = $3
             WHERE id = $4`,
            [type, activeProjects, inactiveProjects, existing[0].id]
          );
        } else {
          await client.query(
            `INSERT INTO public.teams (name, type, active_projects, inactive_projects)
             VALUES ($1, $2, $3, $4)`,
            [name, type, activeProjects, inactiveProjects]
          );
        }
      }
      console.log('Successfully imported/updated teams in public.teams');
    }

    // 3. Import Users and Members from USER-LIST-07-07-2026-11-01-18.csv
    const userCsvPath = path.join(__dirname, '..', 'USER-LIST-07-07-2026-11-01-18.csv');
    if (fs.existsSync(userCsvPath)) {
      const userCsvContent = fs.readFileSync(userCsvPath, 'utf8');
      const userRows = parseCSV(userCsvContent);
      console.log(`Found ${userRows.length} users/members in CSV`);

      const defaultHash = await bcrypt.hash('password123', 10);

      for (const u of userRows) {
        const name = (u['Name'] || '').trim();
        const email = (u['Email'] || '').trim().toLowerCase();
        const phone = (u['Phone No'] || '').trim();
        const accessType = (u['Access Type'] || 'Paid').trim();
        const active = (u['Active'] || 'Yes').trim().toLowerCase() === 'yes';
        const defaultRole = (u['Default Role'] || 'User').trim();
        const team = (u['Team'] || '').trim();
        const activeProjects = (u['Active Assigned Projects'] || '').trim();
        const inactiveProjects = (u['Inactive Assigned Projects'] || '').trim();

        if (!name) continue;

        // A. Insert/Update in public.users if email exists
        if (email) {
          await client.query(
            `INSERT INTO public.users (name, email, password_hash)
             VALUES ($1, $2, $3)
             ON CONFLICT (email) DO UPDATE SET
               name = EXCLUDED.name,
               updated_at = NOW()`,
            [name, email, defaultHash]
          );
        }

        // B. Insert/Update in public.members
        const { rows: existingMember } = await client.query(
          `SELECT id FROM public.members WHERE (email != '' AND LOWER(email) = LOWER($1)) OR (name = $2)`,
          [email, name]
        );

        if (existingMember.length > 0) {
          await client.query(
            `UPDATE public.members
             SET name = $1, email = $2, phone = $3, access_type = $4, active = $5,
                 default_role = $6, teams = $7, active_projects = $8, inactive_projects = $9
             WHERE id = $10`,
            [name, email, phone, accessType, active, defaultRole, team, activeProjects, inactiveProjects, existingMember[0].id]
          );
        } else {
          await client.query(
            `INSERT INTO public.members (name, email, phone, access_type, active, default_role, teams, active_projects, inactive_projects)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [name, email, phone, accessType, active, defaultRole, team, activeProjects, inactiveProjects]
          );
        }
      }
      console.log('Successfully imported/updated users in public.users and public.members');
    }

    await client.query('COMMIT');
    console.log('\nAll user, member, and team records imported successfully into public schema!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Import failed:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

importData();
