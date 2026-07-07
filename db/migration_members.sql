-- Add members table (run per org schema, e.g.:
--   psql -c "ALTER TABLE org_city_hospital... "  or via SET search_path + \i)
CREATE TABLE IF NOT EXISTS members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
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
