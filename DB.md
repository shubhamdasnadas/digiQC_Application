# Checklist Data Model & Queries

This document explains how checklist data is stored and how the Checklists page (`app/checklists/page.tsx`) and its API routes read it. It covers two separate data stores that get merged into one list on that page.

## 1. The two data stores

### A. Org-specific checklists (per-tenant schema)

The app is multi-tenant: every organization (`City Hospital`, `Green Build Corp`, etc.) has its own Postgres schema named `org_<sanitized_org_name>`, created by the `public.create_org_schema(org_id)` SQL function. Each org schema has its own copy of three tables:

```
org_<name>.checklists
  id                uuid PK
  project_id        uuid  (FK-ish, not enforced) → org_<name>.projects
  name              text
  reference_number  text
  uom               text
  status            text  ('active' | 'inactive')
  updated_by        text
  updated_at        timestamptz
  created_at        timestamptz
  UNIQUE (project_id, reference_number)

org_<name>.checklist_stages
  id            uuid PK
  checklist_id  uuid → checklists.id
  sr_no         integer   -- display order
  name          text
  UNIQUE (checklist_id, name)

org_<name>.checkpoints
  id                 uuid PK
  stage_id           uuid → checklist_stages.id
  sr_no              integer   -- display order within the stage
  question           text
  input_type         text ('yes_no' | 'numeric' | 'text')
  drawing_required   boolean
  witness_required   boolean
```

These are real, project-linked checklists — created either manually ("Add Checklist") or via the Import button, and they only exist for the org that owns them. A checklist belongs to exactly one project.

**How a request reaches the right org's tables:** every API route calls `requireAuth(request)`, which decodes the `digiqc_session` JWT cookie. The JWT carries `orgId` (set at login, or updated by the org-switcher). Routes then call `orgQuery(payload.orgId!, sql, params)` (`lib/db.ts`), which checks out a Postgres client, runs `SET search_path TO "org_<name>", public`, and executes the query — so plain unqualified table names (`checklists`, `checklist_stages`, `checkpoints`) transparently resolve to that org's own copies.

### B. The shared checklist library (`public` schema)

Separately, there's a library of 74 generic, reusable QC checklists (e.g. "Arch - Beam & Slab Checking", "Arch - Kitchen & Toilet Dado") that isn't tied to any organization or project. It lives in three normalized tables directly in the shared `public` schema:

```
public.library_checklists
  id                uuid PK  DEFAULT gen_random_uuid()
  name              text
  reference_number  text UNIQUE NOT NULL
  created_at        timestamptz

public.library_stages
  id                     uuid PK
  library_checklist_id   uuid → library_checklists.id  ON DELETE CASCADE
  sr_no                  integer
  name                   text
  UNIQUE (library_checklist_id, name)

public.library_checkpoints
  id                  uuid PK
  library_stage_id    uuid → library_stages.id  ON DELETE CASCADE
  sr_no               integer
  question            text
  input_type          text ('yes_no' | 'text')
  drawing_required    boolean
  witness_required    boolean
```

This mirrors the org-schema shape almost exactly (checklist → stages → checkpoints, same field names), just namespaced under `library_*` in `public` so it can never collide with an org's own `checklists`/`checklist_stages`/`checkpoints` tables of the same conceptual role.

**Where this data came from:** originally it lived in a single flat table, `public.checklist`, with array-typed columns (`checklist_name text[]`, `reference_number text[]`, `stage_name text[]`, `checkpoint text[]`, `yn text[]`, `photo boolean[]`, `remark boolean[]`) — one row per checkpoint, 1,178 rows total, each array holding exactly one element (a legacy import artifact). That table had no primary key and no indexable structure — every read had to unwrap arrays and group rows in application code. It was migrated once, by `scripts/migrate-checklist-library.js`, into the three normalized tables above (74 checklists, 102 stages, 1,178 checkpoints), and the old `public.checklist` table (plus two unrelated orphaned/empty tables, `public.checklist_stages` and `public.checkpoints`, left over from an earlier pre-multi-tenant schema) were dropped afterward. The library is effectively read-only from the app today — nothing writes to it at request time.

**Access pattern:** library reads use `query(sql, params)` (`lib/db.ts`), which runs directly on the shared pool against the `public` schema — no `orgId` needed, since this data isn't org-scoped.

## 2. How `lib/checklistLibrary.ts` reads the library

Two functions, both plain indexed queries — no array unwrapping, no hashing:

- **`listLibraryChecklists()`** — `SELECT id, name, reference_number, created_at FROM public.library_checklists ORDER BY name`. Each row is mapped into the same shape as an org `Checklist` object, with `project_id: null` and a `source: 'library'` tag added so callers can tell org and library rows apart.

- **`getLibraryChecklistDetail(id)`** — given a `library_checklists.id`:
  1. `SELECT ... FROM public.library_checklists WHERE id = $1` — if nothing matches, returns `null`.
  2. `SELECT ... FROM public.library_stages WHERE library_checklist_id = $1 ORDER BY sr_no` — the left-hand stage list.
  3. `SELECT lcp.* FROM public.library_checkpoints lcp JOIN public.library_stages ls ON lcp.library_stage_id = ls.id WHERE ls.library_checklist_id = $1 ORDER BY lcp.sr_no` — every checkpoint for the checklist, tagged with its `stage_id`.

  Returns `{ checklist, stages, checkpoints }` — structurally identical to what the org-checklist detail query produces.

## 3. How `public.checklist` was normalized

The library previously lived in `public.checklist` — a flat table with array-typed columns (`checklist_name text[]`, `reference_number text[]`, `stage_name text[]`, `checkpoint text[]`, `yn text[]`, `photo boolean[]`, `remark boolean[]`), one row per checkpoint, every array holding exactly one element. Every read had to unwrap those arrays and group rows into checklists/stages/checkpoints in application code, and lookups by id required hashing `reference_number` into a synthetic UUID and reverse-scanning the whole table to match it back — workable at 1,178 rows, but with no real index-backed lookup path. It was replaced with the current `library_checklists`/`library_stages`/`library_checkpoints` tables in four steps:

1. **Create the new tables.** `db/migration_checklist_library_normalize.sql` adds `public.library_checklists`, `public.library_stages`, and `public.library_checkpoints` (schema shown in section 1B) with real primary keys, foreign keys, and unique constraints — `CREATE TABLE IF NOT EXISTS`, so safe to run more than once. This was run first, on its own, leaving `public.checklist` untouched so the old and new tables existed side by side.

2. **Migrate the data.** `scripts/migrate-checklist-library.js` (a one-time Node script, run with `node scripts/migrate-checklist-library.js`) reads every row from `public.checklist` ordered by `ctid` (preserving original row order), then walks them in order performing the same grouping the old application code used to do at request time, but once:
   - First time a `reference_number` is seen → insert a row into `library_checklists`.
   - First time a `(reference_number, stage_name)` pair is seen under that checklist → insert a row into `library_stages`, with `sr_no` set to that checklist's next stage position.
   - Every row → insert one row into `library_checkpoints` under the current stage, with `sr_no` set to that stage's next checkpoint position, `input_type` derived from `yn` (`'TEXT'` → `'text'`, else `'yes_no'`), and `drawing_required`/`witness_required` taken straight from the `photo`/`remark` booleans.

   The whole pass runs inside a single transaction (`BEGIN`/`COMMIT`, with `ROLLBACK` on any error) so it's all-or-nothing, and it prints a summary at the end, asserting the checklist count came out to the expected 74 before declaring it safe to proceed.

3. **Verify before touching anything destructive.** Before dropping anything: spot-checked specific checklists' stage/checkpoint groupings directly via SQL against the new tables (e.g. confirming "Arch - Kitchen & Toilet Dado" still produced its two stages, five checkpoints each), then pointed `lib/checklistLibrary.ts` at the new tables (rewriting it to drop the old hashing logic entirely, per section 2) and re-tested `/api/checklists` and `/api/checklists/[id]` end-to-end against the running app — confirming identical output (74 library checklists, correct stage/checkpoint filtering) to what the old array-based reads produced, and confirming org checklists were unaffected.

4. **Drop the old tables.** Only once step 3 passed: `DROP TABLE IF EXISTS public.checkpoints; DROP TABLE IF EXISTS public.checklist_stages; DROP TABLE IF EXISTS public.checklist;` (also appended to the bottom of `db/migration_checklist_library_normalize.sql` as the historical record of what was run). The first two of those were actually orphaned, empty (0-row) tables left over from an earlier pre-multi-tenant version of `db/schema.sql` — unrelated to any org's own `checklist_stages`/`checkpoints` tables, and confirmed via a codebase grep to be unreferenced by any query before dropping them. `public.checklist` itself was the real source data, safe to drop only because step 2 had already copied everything out of it. Re-ran the same `/api/checklists` and `/api/checklists/[id]` checks one final time after the drop to confirm nothing regressed now that the old table no longer existed.

## 4. How the Checklists page's API routes combine both sources

### `GET /api/checklists` (`app/api/checklists/route.ts`)

1. Runs the org query: `SELECT c.*, ... AS project FROM checklists c LEFT JOIN projects p ON c.project_id = p.id ORDER BY c.created_at DESC` via `orgQuery(payload.orgId!, ...)` — this org's own checklists, each annotated with its project name.
2. Calls `listLibraryChecklists()` — the 74 shared checklists.
3. Returns `[...orgRows, ...libraryChecklists]` — one combined array. Every org that hits this endpoint sees its own checklists plus the same 74 library checklists (the library isn't duplicated per org — it's read live from the one shared table each time).

### `GET /api/checklists/[id]` (`app/api/checklists/[id]/route.ts`)

1. Tries the org lookup first: `SELECT * FROM checklists WHERE id = $1` (org-scoped). If found, fetches its stages and checkpoints the same way as always and returns `{ ...checklist, stages, checkpoints }`.
2. If no org checklist matches that id, falls back to `getLibraryChecklistDetail(id)`. If that also finds nothing, returns 404. Otherwise it returns the library result in the exact same `{ ...checklist, stages, checkpoints }` shape.

Because both org and library checklists now have **real** UUIDs (org ones from `gen_random_uuid()` on the org table, library ones from `gen_random_uuid()` on `library_checklists`), there's no ambiguity or collision risk in trying one lookup then the other — an id belongs to exactly one of the two stores.

### The frontend (`app/checklists/page.tsx`, `app/checklists/[id]/page.tsx`)

Neither page needed to change for any of this. The list page just renders whatever array `/api/checklists` returns — it doesn't care whether a row came from an org table or the library. Clicking a row navigates to `/checklists/{id}`, which calls `/api/checklists/{id}` and renders `stages` on the left / `checkpoints` (filtered by `activeStageId`) on the right, regardless of which store the data came from.

## 5. Import flow (org checklists only)

The Import button on the Checklists page never touches the library — it only writes to the calling org's own tables. `handleImport` posts rows to `POST /api/checklists`, which for each row:

1. Upserts into `checklists` on `ON CONFLICT (project_id, reference_number)` — same reference number for the same project updates the existing checklist instead of duplicating it.
2. If `stage_name` is present, upserts into `checklist_stages` on `ON CONFLICT (checklist_id, name)` — repeated stage names collapse into one stage, with `sr_no` recomputed from the current row count.
3. If `checkpoint` is present, inserts a new row into `checkpoints` (checkpoints are never deduped — each imported row is a distinct checkpoint) with `sr_no` set to the next position under that stage.

This is why org checklists can be freely added over time by any org, while the shared library stays fixed (74 checklists) unless someone re-runs the migration script against a refreshed source.
