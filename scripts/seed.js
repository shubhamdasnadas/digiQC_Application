/**
 * Valid8 SAAS Seed Script (Public Schema)
 *
 * Run: node scripts/seed.js
 *
 * Directly sets up public schema tables, imports all teams, users, and members from CSV files.
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

async function seed() {
    const client = await pool.connect();
    console.log('Connected to PostgreSQL (digiqc_new)\n');

    try {
        await client.query('BEGIN');

        // ================================================================
        // 1. Create and align all tables in public schema
        // ================================================================
        console.log('Creating and aligning public schema tables...');

        await client.query(`
          CREATE EXTENSION IF NOT EXISTS "pgcrypto";

          CREATE TABLE IF NOT EXISTS public.organizations (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            name text NOT NULL,
            user_limit integer DEFAULT 10,
            licensing text DEFAULT '',
            expiry_date date,
            logo_url text DEFAULT '',
            console_uses integer DEFAULT 0,
            created_at timestamptz DEFAULT now()
          );

          CREATE TABLE IF NOT EXISTS public.users (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            name text NOT NULL,
            email text NOT NULL UNIQUE,
            password_hash text NOT NULL,
            avatar_url text DEFAULT '',
            created_at timestamptz DEFAULT now(),
            updated_at timestamptz DEFAULT now()
          );

          CREATE TABLE IF NOT EXISTS public.otp_verifications (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            email text NOT NULL,
            otp_code text NOT NULL,
            expires_at timestamptz NOT NULL,
            used boolean DEFAULT false,
            created_at timestamptz DEFAULT now()
          );
          CREATE INDEX IF NOT EXISTS otp_verifications_email_idx ON public.otp_verifications (email);

          CREATE TABLE IF NOT EXISTS public.org_members (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
            organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
            role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
            status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'disabled')),
            created_at timestamptz DEFAULT now(),
            UNIQUE(user_id, organization_id)
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

          CREATE TABLE IF NOT EXISTS public.projects (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            organization_id uuid,
            name text NOT NULL,
            nomenclature text DEFAULT '',
            instruction text DEFAULT '',
            profile text DEFAULT '',
            image_url text DEFAULT '',
            status text DEFAULT 'active',
            unique_code text,
            client_name text DEFAULT '',
            description text DEFAULT '',
            project_admin_id uuid,
            radius_m integer DEFAULT 100,
            timezone text DEFAULT 'Asia/Calcutta',
            latitude double precision,
            longitude double precision,
            address text DEFAULT '',
            perm_location boolean DEFAULT false,
            perm_authentication boolean DEFAULT false,
            perm_rfi boolean DEFAULT false,
            updated_by uuid,
            updated_at timestamptz DEFAULT now(),
            created_at timestamptz DEFAULT now()
          );

          CREATE TABLE IF NOT EXISTS public.checklists (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            project_id uuid,
            name text NOT NULL,
            reference_number text,
            uom text,
            status text DEFAULT 'draft',
            created_at timestamptz DEFAULT now()
          );
          CREATE UNIQUE INDEX IF NOT EXISTS checklists_project_ref_idx ON public.checklists (project_id, reference_number) WHERE reference_number IS NOT NULL;

          CREATE TABLE IF NOT EXISTS public.checklist_stages (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            checklist_id uuid NOT NULL,
            sr_no integer NOT NULL DEFAULT 1,
            name text NOT NULL,
            witness_required boolean DEFAULT false,
            drawing_required boolean DEFAULT false,
            created_at timestamptz DEFAULT now()
          );

          CREATE TABLE IF NOT EXISTS public.checkpoints (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            stage_id uuid NOT NULL,
            question text NOT NULL,
            input_type text NOT NULL DEFAULT 'yes_no',
            drawing_required boolean DEFAULT false,
            witness_required boolean DEFAULT false,
            sr_no integer DEFAULT 0,
            photo_required boolean DEFAULT false,
            remark_required boolean DEFAULT false,
            created_at timestamptz DEFAULT now()
          );

          CREATE TABLE IF NOT EXISTS public.super_admins (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            organization_id uuid,
            name text NOT NULL,
            email text NOT NULL,
            mobile_no text DEFAULT '',
            roles text[] DEFAULT ARRAY['admin'],
            created_at timestamptz DEFAULT now()
          );

          CREATE TABLE IF NOT EXISTS public.project_members (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            project_id uuid NOT NULL,
            user_id uuid NOT NULL,
            role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member','inspector','approver','viewer')),
            added_at timestamptz DEFAULT now(),
            UNIQUE(project_id, user_id)
          );

          CREATE TABLE IF NOT EXISTS public.project_teams (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            project_id uuid NOT NULL,
            team_id uuid NOT NULL,
            assigned_checklist text DEFAULT '',
            assigned_user text DEFAULT '',
            added_at timestamptz DEFAULT now(),
            UNIQUE(project_id, team_id)
          );

          CREATE TABLE IF NOT EXISTS public.eqcs (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            project_id uuid NOT NULL,
            location text NOT NULL DEFAULT '',
            checklist_id uuid,
            stage_index integer NOT NULL DEFAULT 1,
            total_stages integer NOT NULL DEFAULT 1,
            stage_result text DEFAULT 'pending' CHECK (stage_result IN ('pass','fail','pending')),
            approver_id uuid,
            approver_log text DEFAULT '',
            status text NOT NULL DEFAULT 'pending' CHECK (status IN ('passed','failed','pending','rfi')),
            inspected_by uuid,
            inspected_at timestamptz,
            rfi_id uuid,
            notes text DEFAULT '',
            assigned_user_ids uuid[] NOT NULL DEFAULT '{}',
            assigned_team_ids uuid[] NOT NULL DEFAULT '{}',
            created_at timestamptz DEFAULT now()
          );

          CREATE TABLE IF NOT EXISTS public.issues (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            project_id uuid NOT NULL,
            title text NOT NULL,
            description text DEFAULT '',
            severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
            status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed')),
            assignee_id uuid,
            reported_by uuid,
            due_date date,
            created_at timestamptz DEFAULT now()
          );

          CREATE TABLE IF NOT EXISTS public.register_entries (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            project_id uuid NOT NULL,
            document_no text DEFAULT '',
            title text NOT NULL,
            revision text DEFAULT 'R0',
            status text DEFAULT 'active' CHECK (status IN ('active','superseded','void')),
            file_url text DEFAULT '',
            created_at timestamptz DEFAULT now()
          );

          CREATE TABLE IF NOT EXISTS public.project_targets (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            project_id uuid NOT NULL,
            metric text NOT NULL,
            target_value numeric DEFAULT 0,
            current_value numeric DEFAULT 0,
            unit text DEFAULT '',
            period text DEFAULT 'monthly' CHECK (period IN ('daily','weekly','monthly','quarterly','project')),
            created_at timestamptz DEFAULT now()
          );

          CREATE TABLE IF NOT EXISTS public.nomenclature (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            project_id uuid NOT NULL,
            parent_id uuid REFERENCES public.nomenclature(id) ON DELETE CASCADE,
            sr_no integer NOT NULL DEFAULT 1,
            name text NOT NULL,
            description text DEFAULT '',
            status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
            created_at timestamptz DEFAULT now()
          );

          CREATE TABLE IF NOT EXISTS public.library_checklists (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            name text NOT NULL,
            reference_number text UNIQUE NOT NULL,
            created_at timestamptz DEFAULT now()
          );

          CREATE TABLE IF NOT EXISTS public.library_stages (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            library_checklist_id uuid NOT NULL REFERENCES public.library_checklists(id) ON DELETE CASCADE,
            sr_no integer NOT NULL DEFAULT 1,
            name text NOT NULL,
            created_at timestamptz DEFAULT now()
          );

          CREATE TABLE IF NOT EXISTS public.library_checkpoints (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            library_stage_id uuid NOT NULL REFERENCES public.library_stages(id) ON DELETE CASCADE,
            sr_no integer NOT NULL DEFAULT 1,
            question text NOT NULL,
            input_type text NOT NULL DEFAULT 'yes_no',
            drawing_required boolean DEFAULT false,
            witness_required boolean DEFAULT false,
            created_at timestamptz DEFAULT now()
          );

          -- Ensure all columns exist on pre-existing tables
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

          ALTER TABLE public.checklists ALTER COLUMN project_id DROP NOT NULL;
          ALTER TABLE public.checklists ADD COLUMN IF NOT EXISTS reference_number text;
          ALTER TABLE public.checklists ADD COLUMN IF NOT EXISTS uom text;
          ALTER TABLE public.checklists ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft';
        `);

        // ================================================================
        // 2. Create Default Admin User
        // ================================================================
        console.log('Creating default admin user...');
        const passwordHash = await bcrypt.hash('password123', 10);

        await client.query(
            `INSERT INTO public.users (name, email, password_hash)
             VALUES ($1, $2, $3)
             ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
            ['Admin User', 'admin@digiqc.com', passwordHash]
        );
        console.log('  Admin User: admin@digiqc.com / password123');

        // ================================================================
        // 3. Import Teams from CSV directly into public.teams
        // ================================================================
        const teamCsvPath = path.join(__dirname, '..', 'TEAM-LIST-07-07-2026-06-45-30.csv');
        if (fs.existsSync(teamCsvPath)) {
            const teamRows = parseCSV(fs.readFileSync(teamCsvPath, 'utf8'));
            for (const t of teamRows) {
                const name = (t['Name'] || '').trim();
                if (!name) continue;
                const type = (t['Type'] || 'DEFAULT').trim();
                const activeProjects = (t['Active Assigned Projects'] || '').trim();
                const inactiveProjects = (t['Inactive Assigned Projects'] || '').trim();

                const { rows: existingTeam } = await client.query(
                    `SELECT id FROM public.teams WHERE LOWER(name) = LOWER($1)`, [name]
                );
                if (existingTeam.length > 0) {
                    await client.query(
                        `UPDATE public.teams SET type = $1, active_projects = $2, inactive_projects = $3 WHERE id = $4`,
                        [type, activeProjects, inactiveProjects, existingTeam[0].id]
                    );
                } else {
                    await client.query(
                        `INSERT INTO public.teams (name, type, active_projects, inactive_projects)
                         VALUES ($1, $2, $3, $4)`,
                        [name, type, activeProjects, inactiveProjects]
                    );
                }
            }
            console.log(`  Imported ${teamRows.length} teams from CSV into public.teams`);
        }

        // ================================================================
        // 4. Import Users & Members from CSV directly into public schema
        // ================================================================
        const userCsvPath = path.join(__dirname, '..', 'USER-LIST-07-07-2026-11-01-18.csv');
        if (fs.existsSync(userCsvPath)) {
            const userRows = parseCSV(fs.readFileSync(userCsvPath, 'utf8'));

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

                if (email) {
                    await client.query(
                        `INSERT INTO public.users (name, email, password_hash)
                         VALUES ($1, $2, $3)
                         ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()`,
                        [name, email, passwordHash]
                    );
                }

                const { rows: existingM } = await client.query(
                    `SELECT id FROM public.members WHERE (email != '' AND LOWER(email) = LOWER($1)) OR (name = $2)`,
                    [email, name]
                );

                if (existingM.length > 0) {
                    await client.query(
                        `UPDATE public.members
                         SET name = $1, email = $2, phone = $3, access_type = $4, active = $5,
                             default_role = $6, teams = $7, active_projects = $8, inactive_projects = $9
                         WHERE id = $10`,
                        [name, email, phone, accessType, active, defaultRole, team, activeProjects, inactiveProjects, existingM[0].id]
                    );
                } else {
                    await client.query(
                        `INSERT INTO public.members (name, email, phone, access_type, active, default_role, teams, active_projects, inactive_projects)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                        [name, email, phone, accessType, active, defaultRole, team, activeProjects, inactiveProjects]
                    );
                }
            }
            console.log(`  Imported ${userRows.length} users and members from CSV into public.users and public.members`);
        }

        // ================================================================
        // 5. Populate sample projects & checklists in public schema
        // ================================================================
        const projects = [
            { name: 'Block-A Foundation', nomenclature: 'BLK-A-FND-001', instruction: 'Inspect all RCC work per IS:456', profile: 'Civil structural', status: 'active' },
            { name: 'MEP Installation Ph1', nomenclature: 'MEP-PH1-002', instruction: 'Verify electrical & plumbing routes', profile: 'MEP services', status: 'active' },
            { name: 'Facade Cladding QC', nomenclature: 'FAC-CLD-003', instruction: 'Check joint tolerances & waterproofing', profile: 'Architectural finish', status: 'completed' },
            { name: 'Rooftop Waterproofing', nomenclature: 'RTF-WP-004', instruction: 'Flood test all terrace zones', profile: 'Waterproofing specialist', status: 'active' },
            { name: 'HVAC Commissioning', nomenclature: 'HVAC-COM-005', instruction: 'Balance airflow per design specs', profile: 'HVAC engineer', status: 'on_hold' },
        ];

        for (const p of projects) {
            const { rows: existingProj } = await client.query(
                `SELECT id FROM public.projects WHERE name = $1`, [p.name]
            );

            let projectId;
            if (existingProj.length > 0) {
                projectId = existingProj[0].id;
            } else {
                const { rows: projRows } = await client.query(
                    `INSERT INTO public.projects (name, nomenclature, instruction, profile, image_url, status)
                     VALUES ($1, $2, $3, $4, $5, $6)
                     RETURNING id`,
                    [p.name, p.nomenclature, p.instruction, p.profile,
                        'https://images.pexels.com/photos/1216589/pexels-photo-1216589.jpeg?auto=compress&w=800',
                        p.status]
                );
                projectId = projRows[0].id;
            }

            const checklists = [
                { name: 'Pre-pour Concrete Check', ref: 'CHK-CONC-01', uom: 'Cu.m' },
                { name: 'Steel Reinforcement Verification', ref: 'CHK-STEEL-01', uom: 'MT' },
                { name: 'Waterproofing Inspection', ref: 'CHK-WP-01', uom: 'Sq.m' },
                { name: 'Final Handover QC', ref: 'CHK-HO-01', uom: 'Unit' },
            ];

            for (const cl of checklists) {
                const { rows: existingCL } = await client.query(
                    `SELECT id FROM public.checklists WHERE name = $1 AND project_id = $2`,
                    [cl.name, projectId]
                );
                if (existingCL.length === 0) {
                    await client.query(
                        `INSERT INTO public.checklists (project_id, name, reference_number, uom, status)
                         VALUES ($1, $2, $3, $4, 'draft')`,
                        [projectId, cl.name, cl.ref, cl.uom]
                    );
                }
            }
        }
        console.log(`  Created demo projects with checklists in public schema`);

        await client.query('COMMIT');
        console.log('\nSeed complete! All public schema tables, users, members, and teams successfully configured.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Seed failed:', err);
        throw err;
    } finally {
        client.release();
        await pool.end();
    }
}

seed();
