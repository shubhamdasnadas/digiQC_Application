-- DigiQC PostgreSQL Schema
-- Run: psql -U postgres -d digiQC -f db/schema.sql

-- UUID support (built-in on PostgreSQL 13+, otherwise needs pgcrypto)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Organizations
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  user_limit integer DEFAULT 10,
  licensing text DEFAULT '',
  expiry_date date,
  logo_url text DEFAULT '',
  console_uses integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Super admins
CREATE TABLE IF NOT EXISTS super_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  mobile_no text DEFAULT '',
  roles text[] DEFAULT ARRAY['admin'],
  created_at timestamptz DEFAULT now()
);

-- Teams
CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text DEFAULT 'inspection',
  team_lead_name text DEFAULT '',
  spoc_name text DEFAULT '',
  active_projects text DEFAULT '',
  inactive_projects text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  nomenclature text DEFAULT '',
  instruction text DEFAULT '',
  profile text DEFAULT '',
  image_url text DEFAULT '',
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

-- Checklists
CREATE TABLE IF NOT EXISTS checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Checklist stages (2D)
CREATE TABLE IF NOT EXISTS checklist_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id uuid REFERENCES checklists(id) ON DELETE CASCADE,
  sr_no integer NOT NULL DEFAULT 1,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Checkpoints
CREATE TABLE IF NOT EXISTS checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id uuid REFERENCES checklist_stages(id) ON DELETE CASCADE,
  question text NOT NULL,
  input_type text NOT NULL DEFAULT 'yes_no',
  drawing_required boolean DEFAULT false,
  witness_required boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- ─── Seed Demo Data ────────────────────────────────────────────────────────────

INSERT INTO organizations (name, user_limit, licensing, expiry_date, logo_url, console_uses)
VALUES
  ('City Hospital',             50, 'Enterprise',    '2026-12-31', '', 12),
  ('Green Ross Infrastructure', 30, 'Professional',  '2026-06-30', '', 8),
  ('Lakeside Construction',     20, 'Starter',       '2026-09-15', '', 5),
  ('TechBuild Systems',        100, 'Enterprise',    '2027-06-30', '', 45),
  ('SafeConstruct Ltd',         60, 'Professional',  '2026-11-15', '', 28)
ON CONFLICT DO NOTHING;

-- Teams for City Hospital
INSERT INTO teams (organization_id, name, type, team_lead_name, spoc_name)
SELECT o.id, t.name, t.type, t.lead, t.spoc
FROM organizations o
CROSS JOIN (VALUES
  ('QC Team Alpha',     'inspection', 'Rajesh Kumar',  'Priya Singh'),
  ('Structural Review', 'audit',      'Amit Patel',    'Sunita Verma'),
  ('Safety Compliance', 'compliance', 'Vikram Sharma', 'Meera Nair')
) AS t(name, type, lead, spoc)
WHERE o.name = 'City Hospital'
ON CONFLICT DO NOTHING;

-- Projects for City Hospital
INSERT INTO projects (organization_id, name, nomenclature, instruction, profile, image_url, status)
SELECT o.id, p.name, p.nomenclature, p.instruction, p.profile, p.image_url, p.status
FROM organizations o
CROSS JOIN (VALUES
  ('Block-A Foundation',    'BLK-A-FND-001', 'Inspect all RCC work per IS:456',         'Civil structural',       'https://images.pexels.com/photos/1216589/pexels-photo-1216589.jpeg?auto=compress&w=800', 'active'),
  ('MEP Installation Ph1',  'MEP-PH1-002',   'Verify electrical & plumbing routes',      'MEP services',           'https://images.pexels.com/photos/3862379/pexels-photo-3862379.jpeg?auto=compress&w=800', 'active'),
  ('Facade Cladding QC',    'FAC-CLD-003',   'Check joint tolerances & waterproofing',   'Architectural finish',   'https://images.pexels.com/photos/323705/pexels-photo-323705.jpeg?auto=compress&w=800',   'completed'),
  ('Rooftop Waterproofing', 'RTF-WP-004',    'Flood test all terrace zones',             'Waterproofing specialist','https://images.pexels.com/photos/2219024/pexels-photo-2219024.jpeg?auto=compress&w=800', 'active'),
  ('HVAC Commissioning',    'HVAC-COM-005',  'Balance airflow per design specs',         'HVAC engineer',          'https://images.pexels.com/photos/442150/pexels-photo-442150.jpeg?auto=compress&w=800',   'on_hold')
) AS p(name, nomenclature, instruction, profile, image_url, status)
WHERE o.name = 'City Hospital'
ON CONFLICT DO NOTHING;

-- Checklists for City Hospital projects
INSERT INTO checklists (project_id, name)
SELECT p.id, c.name
FROM projects p
JOIN organizations o ON p.organization_id = o.id
CROSS JOIN (VALUES
  ('Pre-pour Concrete Check'),
  ('Steel Reinforcement Verification'),
  ('Waterproofing Inspection'),
  ('Final Handover QC')
) AS c(name)
WHERE o.name = 'City Hospital'
ON CONFLICT DO NOTHING;
