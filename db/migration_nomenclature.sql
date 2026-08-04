-- ============================================================
-- Migration: nomenclature (tasks & sub-tasks) table
-- ============================================================
-- Adds a `nomenclature` table to every existing org_<name> schema.
-- Rows with parent_id NULL are tasks; rows with parent_id set are
-- sub-tasks of that task (deleting a task cascades to its sub-tasks).
--
-- Safe to re-run (CREATE TABLE/INDEX IF NOT EXISTS + constraint guards).
--
-- Run:
--   psql -U postgres -d digiQC -f db/migration_nomenclature.sql
-- ============================================================

DO $$
DECLARE
  s RECORD;
BEGIN
  FOR s IN
    SELECT nspname AS schema_name
    FROM pg_namespace
    WHERE nspname LIKE 'org\_%' ESCAPE '\'
  LOOP
    -- ─── Table ──────────────────────────────────────────────
    EXECUTE format('
      CREATE TABLE IF NOT EXISTS %I.nomenclature (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id uuid NOT NULL,
        parent_id uuid,
        sr_no integer NOT NULL DEFAULT 1,
        name text NOT NULL,
        description text DEFAULT '''',
        status text NOT NULL DEFAULT ''active''
          CHECK (status IN (''active'',''inactive'')),
        created_at timestamptz DEFAULT now()
      )', s.schema_name);

    -- ─── Indexes ────────────────────────────────────────────
    EXECUTE format('
      CREATE INDEX IF NOT EXISTS nomenclature_project_idx
      ON %I.nomenclature (project_id)', s.schema_name);

    EXECUTE format('
      CREATE INDEX IF NOT EXISTS nomenclature_parent_idx
      ON %I.nomenclature (parent_id)', s.schema_name);

    -- ─── Foreign keys (guarded — no IF NOT EXISTS for constraints) ───
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE c.conname = 'nomenclature_project_id_fkey'
        AND n.nspname = s.schema_name
    ) THEN
      EXECUTE format('
        ALTER TABLE %I.nomenclature
        ADD CONSTRAINT nomenclature_project_id_fkey
        FOREIGN KEY (project_id) REFERENCES %I.projects(id) ON DELETE CASCADE',
        s.schema_name, s.schema_name);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE c.conname = 'nomenclature_parent_id_fkey'
        AND n.nspname = s.schema_name
    ) THEN
      EXECUTE format('
        ALTER TABLE %I.nomenclature
        ADD CONSTRAINT nomenclature_parent_id_fkey
        FOREIGN KEY (parent_id) REFERENCES %I.nomenclature(id) ON DELETE CASCADE',
        s.schema_name, s.schema_name);
    END IF;
  END LOOP;
END
$$;
