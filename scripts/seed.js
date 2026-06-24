/**
 * DigiQC SAAS Seed Script
 * 
 * Run: node scripts/seed.js
 * 
 * This creates:
 * 1. All required database tables
 * 2. A demo user (admin@digiqc.com / password123)
 * 3. Two demo organizations with data
 * 4. Org schemas with sample projects, teams, checklists
 */

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432'),
    database: process.env.PG_DATABASE || 'digiQC',
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || 'root',
});

async function seed() {
    const client = await pool.connect();
    console.log('Connected to PostgreSQL\n');

    try {
        // ================================================================
        // 1. Create shared tables in public schema
        // ================================================================
        console.log('Creating public schema tables...');

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
    `);

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
    `);

        await client.query(`
      CREATE TABLE IF NOT EXISTS public.org_members (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
        organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
        role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
        status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'disabled')),
        created_at timestamptz DEFAULT now(),
        UNIQUE(user_id, organization_id)
      );
    `);

        // ================================================================
        // 2. Create org schema function
        // ================================================================
        console.log('Creating schema management functions...');

        await client.query(`
      CREATE OR REPLACE FUNCTION public.create_org_schema(org_id uuid)
      RETURNS void
      LANGUAGE plpgsql
      AS $$
      DECLARE
        schema_name text;
      BEGIN
        schema_name := 'org_' || replace(org_id::text, '-', '_');
        EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', schema_name);
        EXECUTE format('CREATE TABLE IF NOT EXISTS %I.teams (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, name text NOT NULL, type text DEFAULT ''inspection'', team_lead_name text DEFAULT '''', spoc_name text DEFAULT '''', created_at timestamptz DEFAULT now())', schema_name);
        EXECUTE format('CREATE TABLE IF NOT EXISTS %I.projects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, name text NOT NULL, nomenclature text DEFAULT '''', instruction text DEFAULT '''', profile text DEFAULT '''', image_url text DEFAULT '''', status text DEFAULT ''active'', created_at timestamptz DEFAULT now())', schema_name);
        EXECUTE format('CREATE TABLE IF NOT EXISTS %I.checklists (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL, name text NOT NULL, created_at timestamptz DEFAULT now())', schema_name);
        EXECUTE format('CREATE TABLE IF NOT EXISTS %I.checklist_stages (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), checklist_id uuid NOT NULL, sr_no integer NOT NULL DEFAULT 1, name text NOT NULL, created_at timestamptz DEFAULT now())', schema_name);
        EXECUTE format('CREATE TABLE IF NOT EXISTS %I.checkpoints (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), stage_id uuid NOT NULL, question text NOT NULL, input_type text NOT NULL DEFAULT ''yes_no'', drawing_required boolean DEFAULT false, witness_required boolean DEFAULT false, created_at timestamptz DEFAULT now())', schema_name);
        EXECUTE format('CREATE TABLE IF NOT EXISTS %I.super_admins (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, name text NOT NULL, email text NOT NULL, mobile_no text DEFAULT '''', roles text[] DEFAULT ARRAY[''admin''], created_at timestamptz DEFAULT now())', schema_name);
      END;
      $$;
    `);

        // ================================================================
        // 3. Create DEMO USER
        // ================================================================
        console.log('Creating demo user...');

        const passwordHash = await bcrypt.hash('password123', 12);

        // Check if user exists
        const { rows: existingUser } = await client.query(
            'SELECT id FROM public.users WHERE email = $1',
            ['admin@digiqc.com']
        );

        let userId;
        if (existingUser.length > 0) {
            userId = existingUser[0].id;
            console.log('  Demo user already exists (admin@digiqc.com)');
        } else {
            const { rows: userRows } = await client.query(
                `INSERT INTO public.users (name, email, password_hash)
         VALUES ($1, $2, $3)
         RETURNING id`,
                ['Admin User', 'admin@digiqc.com', passwordHash]
            );
            userId = userRows[0].id;
            console.log('  Created demo user: admin@digiqc.com / password123');
        }

        // ================================================================
        // 4. Create DEMO ORGANIZATION 1 — City Hospital
        // ================================================================
        console.log('\nCreating demo organizations...');

        const { rows: existingOrg1 } = await client.query(
            'SELECT id FROM public.organizations WHERE name = $1',
            ['City Hospital']
        );

        let org1Id;
        if (existingOrg1.length > 0) {
            org1Id = existingOrg1[0].id;
            console.log('  Organization "City Hospital" already exists');
        } else {
            const { rows: orgRows } = await client.query(
                `INSERT INTO public.organizations (name, user_limit, licensing, expiry_date, console_uses)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
                ['City Hospital', 50, 'Enterprise', '2026-12-31', 12]
            );
            org1Id = orgRows[0].id;
            console.log('  Created: City Hospital');
        }

        // ================================================================
        // 5. Create DEMO ORGANIZATION 2 — Green Build Corp
        // ================================================================
        const { rows: existingOrg2 } = await client.query(
            'SELECT id FROM public.organizations WHERE name = $1',
            ['Green Build Corp']
        );

        let org2Id;
        if (existingOrg2.length > 0) {
            org2Id = existingOrg2[0].id;
            console.log('  Organization "Green Build Corp" already exists');
        } else {
            const { rows: orgRows } = await client.query(
                `INSERT INTO public.organizations (name, user_limit, licensing, expiry_date, console_uses)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
                ['Green Build Corp', 30, 'Professional', '2026-06-30', 8]
            );
            org2Id = orgRows[0].id;
            console.log('  Created: Green Build Corp');
        }

        // ================================================================
        // 6. Add user to orgs as admin
        // ================================================================
        console.log('\nAdding user to organizations...');

        for (const orgId of [org1Id, org2Id]) {
            const { rows: existingMember } = await client.query(
                'SELECT id FROM public.org_members WHERE user_id = $1 AND organization_id = $2',
                [userId, orgId]
            );
            if (existingMember.length === 0) {
                await client.query(
                    `INSERT INTO public.org_members (user_id, organization_id, role, status)
           VALUES ($1, $2, 'admin', 'active')`,
                    [userId, orgId]
                );
                console.log(`  Added user to ${orgId === org1Id ? 'City Hospital' : 'Green Build Corp'} as admin`);
            }
        }

        // ================================================================
        // 7. Create org schemas and populate with demo data
        // ================================================================
        for (const [orgId, orgName, projects] of [
            [org1Id, 'City Hospital', [
                { name: 'Block-A Foundation', nomenclature: 'BLK-A-FND-001', instruction: 'Inspect all RCC work per IS:456', profile: 'Civil structural', status: 'active' },
                { name: 'MEP Installation Ph1', nomenclature: 'MEP-PH1-002', instruction: 'Verify electrical & plumbing routes', profile: 'MEP services', status: 'active' },
                { name: 'Facade Cladding QC', nomenclature: 'FAC-CLD-003', instruction: 'Check joint tolerances & waterproofing', profile: 'Architectural finish', status: 'completed' },
                { name: 'Rooftop Waterproofing', nomenclature: 'RTF-WP-004', instruction: 'Flood test all terrace zones', profile: 'Waterproofing specialist', status: 'active' },
                { name: 'HVAC Commissioning', nomenclature: 'HVAC-COM-005', instruction: 'Balance airflow per design specs', profile: 'HVAC engineer', status: 'on_hold' },
            ]],
            [org2Id, 'Green Build Corp', [
                { name: 'Tower A Foundation', nomenclature: 'TWR-A-001', instruction: 'Pile foundation inspection', profile: 'Civil structural', status: 'active' },
                { name: 'Electrical Layout', nomenclature: 'ELEC-001', instruction: 'Verify all electrical drawings', profile: 'Electrical', status: 'active' },
                { name: 'Plumbing Network', nomenclature: 'PLUMB-001', instruction: 'Pressure test all lines', profile: 'Plumbing', status: 'on_hold' },
            ]],
        ] as const) {
            const schemaName = `org_${orgId.replace(/-/g, '_')}`;

            // Create schema
            await client.query('SELECT public.create_org_schema($1)', [orgId]);
            console.log(`\nPopulating schema for "${orgName}"...`);

            // Create super_admin entry
            const { rows: existingSA } = await client.query(`SELECT id FROM "${schemaName}".super_admins WHERE email = $1`, ['admin@digiqc.com']);
            if (existingSA.length === 0) {
                await client.query(
                    `INSERT INTO "${schemaName}".super_admins (organization_id, name, email, mobile_no, roles)
           VALUES ($1, $2, $3, $4, $5)`,
                    [orgId, 'Admin User', 'admin@digiqc.com', '+91-9876543210', ['admin']]
                );
                console.log(`  Created super admin`);
            }

            // Create teams
            const teams = orgId === org1Id
                ? [
                    { name: 'QC Team Alpha', type: 'inspection', lead: 'Rajesh Kumar', spoc: 'Priya Singh' },
                    { name: 'Structural Review', type: 'audit', lead: 'Amit Patel', spoc: 'Sunita Verma' },
                    { name: 'Safety Compliance', type: 'compliance', lead: 'Vikram Sharma', spoc: 'Meera Nair' },
                ]
                : [
                    { name: 'Green Team A', type: 'inspection', lead: 'John Doe', spoc: 'Jane Smith' },
                    { name: 'MEP Review', type: 'audit', lead: 'Mike Johnson', spoc: 'Sarah Lee' },
                ];

            for (const t of teams) {
                const { rows: existingTeam } = await client.query(
                    `SELECT id FROM "${schemaName}".teams WHERE name = $1`, [t.name]
                );
                if (existingTeam.length === 0) {
                    await client.query(
                        `INSERT INTO "${schemaName}".teams (organization_id, name, type, team_lead_name, spoc_name)
             VALUES ($1, $2, $3, $4, $5)`,
                        [orgId, t.name, t.type, t.lead, t.spoc]
                    );
                }
            }
            console.log(`  Created ${teams.length} teams`);

            // Create projects with checklists
            for (const p of projects as any[]) {
                const { rows: existingProj } = await client.query(
                    `SELECT id FROM "${schemaName}".projects WHERE name = $1`, [p.name]
                );

                let projectId;
                if (existingProj.length > 0) {
                    projectId = existingProj[0].id;
                } else {
                    const { rows: projRows } = await client.query(
                        `INSERT INTO "${schemaName}".projects (organization_id, name, nomenclature, instruction, profile, image_url, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id`,
                        [orgId, p.name, p.nomenclature, p.instruction, p.profile,
                            'https://images.pexels.com/photos/1216589/pexels-photo-1216589.jpeg?auto=compress&w=800',
                            p.status]
                    );
                    projectId = projRows[0].id;
                }

                // Add checklists for each project
                const checklists = [
                    'Pre-pour Concrete Check',
                    'Steel Reinforcement Verification',
                    'Waterproofing Inspection',
                    'Final Handover QC',
                ];

                for (const clName of checklists) {
                    const { rows: existingCL } = await client.query(
                        `SELECT id FROM "${schemaName}".checklists WHERE name = $1 AND project_id = $2`,
                        [clName, projectId]
                    );
                    if (existingCL.length === 0) {
                        await client.query(
                            `INSERT INTO "${schemaName}".checklists (project_id, name) VALUES ($1, $2)`,
                            [projectId, clName]
                        );
                    }
                }
            }
            console.log(`  Created ${projects.length} projects with checklists`);
        }

        console.log('\n✅ Seed complete!');
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('  Login Credentials:');
        console.log('  Email:    admin@digiqc.com');
        console.log('  Password: password123');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('\nOrganizations created:');
        console.log('  1. City Hospital');
        console.log('  2. Green Build Corp');
        console.log('\nStart the app: npm run dev');
        console.log('Then visit: http://localhost:3000/login');

    } catch (err) {
        console.error('Seed failed:', err);
        throw err;
    } finally {
        client.release();
        await pool.end();
    }
}

seed();
