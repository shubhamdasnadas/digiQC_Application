-- Add assigned-projects columns to teams table (run per org schema, e.g.:
--   psql -c "SET search_path TO org_city_hospital; \i db/migration_teams_projects_columns.sql"
ALTER TABLE teams ADD COLUMN IF NOT EXISTS active_projects TEXT DEFAULT '';
ALTER TABLE teams ADD COLUMN IF NOT EXISTS inactive_projects TEXT DEFAULT '';
