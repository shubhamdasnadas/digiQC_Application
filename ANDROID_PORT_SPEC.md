# DigiQC — React Native Port Context Spec

This document is a feature/data/architecture inventory of the existing DigiQC web app (Next.js + Postgres), written to brief an agent that will rebuild it as a **React Native** app (targeting Android). It describes **what exists today**, including known stubs/bugs/inconsistencies — it is not a prescriptive React Native design. Decide deliberately which quirks to replicate, fix, or drop.

**Why React Native matters here, specifically:**
- The existing frontend is already React + TypeScript. Component structure, state-management patterns (plain `useState`/Context, no Redux/MobX), form-handling logic (hand-rolled controlled inputs, no React Hook Form/Formik), and most business/validation logic (e.g. `lib/excelImport.ts` validators, date/number parsing, sanitization) can likely be **ported with light modification rather than rewritten from scratch** — the mental model and much of the actual logic carries over, unlike a Kotlin/Swift rewrite.
- `lib/types.ts` (all TypeScript interfaces — Project, Team, Checklist, EQC, Issue, etc.) can likely be **reused close to verbatim** as the shared type layer for API responses.
- Tailwind-driven styling (`.card`/`.btn-primary`/`.badge-*` utility classes, the teal-accent design system, dark mode) maps well to **NativeWind** (Tailwind for React Native) if the team wants near-1:1 visual parity with minimal restyling; alternatively a component library like React Native Paper/Tamagui/Gluestack can be used with the same color tokens.
- Web-only APIs used today have **no direct RN equivalent** and need explicit replacements: `document.execCommand`-based rich text editing (checkpoint question editor), HTML5 native drag-and-drop (stage/checkpoint reordering), `@vis.gl/react-google-maps` (would become `react-native-maps` + Google Places SDK), `xlsx-js-style` file parsing (would need a RN-compatible library or a backend-side import endpoint instead of client-side parsing), and cookie-based session storage (RN should use secure storage — e.g. `expo-secure-store`/Keychain/Keystore — for the JWT rather than relying on cookies, and send it via an `Authorization` header if the backend is adapted).
- The route-protection state machine (§1) maps directly onto RN navigation stacks/guards (e.g. React Navigation conditional stacks) rather than Next.js middleware.

## 0. What DigiQC Is

A multi-tenant B2B SaaS for construction/engineering QC (quality control) inspection management. Organizations ("tenants") manage Projects; each Project has Teams and Users assigned to it, a library of Checklists (inspection templates: Stages → Checkpoints), and day-to-day QC activity tracked as EQC records (executed inspections), Issues (defects/punch-list), a document Register, and performance Targets.

---

## 1. Architecture Overview (current web implementation)

- **Frontend**: Next.js App Router (React 18, TypeScript), Tailwind CSS, no UI kit — hand-built components. Client-side data fetching via `fetch()` to same-app API routes, no separate REST/GraphQL API package.
- **Backend**: Next.js API routes (`app/api/**/route.ts`) talking directly to Postgres via `pg` (no ORM).
- **Multi-tenancy**: **schema-per-organization** in Postgres. Each org gets its own schema `org_<sanitized_org_name>` (derived from org *name*, not id — renaming an org does not rename its schema, a latent bug). Shared `public` schema holds `users`, `organizations`, `org_members`, and a global checklist "library".
- **Auth**: stateless JWT (`jsonwebtoken`) in an HttpOnly cookie `digiqc_session`, 7-day expiry, containing `{userId, email, orgId, role}`. bcrypt password hashing (12 rounds). No secure flag / no DB session store.
- **Session model**: "one active org per session" — the JWT carries the currently selected org; switching orgs calls `/api/auth/switch-org` which **reissues a new token** (not a header param). The RN client will need to store the JWT itself (in secure device storage, not a cookie jar) and resend it — either as a `Cookie` header if reusing the existing API as-is, or via `Authorization: Bearer` if the backend is adapted — and must overwrite its stored token on org-switch.
- **Route protection state machine** (edge `middleware.ts`): unauthenticated → `/login`; authenticated but no `orgId` in token → `/select-org`; authenticated + org selected → normal app. This maps directly to three app-level navigation states in RN: login/splash stack, org-picker screen, main authenticated tab/drawer navigator.
- No test framework, no CI config observed in this survey.

---

## 2. Data Model

### 2.1 Shared (`public` schema) tables

- **organizations**: `id, name, user_limit (default 10), licensing (text, e.g. Starter/Professional/Enterprise), expiry_date, logo_url, console_uses, created_at`
- **users**: `id, name, email (unique), password_hash, avatar_url, created_at, updated_at`
- **org_members**: `id, user_id → users, organization_id → organizations, role ('admin'|'member'), status ('active'|'invited'|'disabled'), created_at`, unique per (user, org)
- **library_checklists / library_stages / library_checkpoints**: a global, cross-org, read-only template library (normalized version of a legacy flat `checklist` table with array columns — that legacy table still exists as historical seed data, superseded).
- `super_admins` table exists at public level but has no API route exercising it (dead/legacy).

### 2.2 Per-organization schema tables (created via `create_org_schema(org_id)` Postgres function)

- **teams**: `id, organization_id, name, type ('inspection'|'audit'|'compliance'), team_lead_name, spoc_name, active_projects (free-text), inactive_projects (free-text), created_at`
  - Note: `active_projects`/`inactive_projects` are plain comma-separated **text fields**, not a normalized relation — this is a separate, redundant mechanism from `project_teams` below. Decide which is canonical for the rebuilt data model.
- **projects**: `id, organization_id, name, nomenclature, instruction, profile, image_url, status ('active'|'completed'|'on_hold'), unique_code, client_name, description, project_admin_id, radius_m (default 100), timezone (default 'Asia/Calcutta'), latitude, longitude, address, perm_location, perm_authentication, perm_rfi (bools — feature toggles per project), updated_by, updated_at, created_at`. Unique `(organization_id, unique_code)`.
- **checklists**: `id, project_id (nullable — null means org-generic), name, reference_number, uom, status ('active'|'inactive'), created_at`. Unique `(project_id, reference_number)`.
- **checklist_stages**: `id, checklist_id, sr_no (ordering), name, witness_required, drawing_required, created_at`. Unique `(checklist_id, name)`.
- **checkpoints**: `id, stage_id, sr_no, question (rich text/HTML), input_type ('yes_no'|'options'|'text'|'numeric'|'date'), drawing_required, witness_required, photo_required, remark_required, created_at`.
- **project_members**: `id, project_id → projects (cascade), user_id, role ('admin'|'member'|'inspector'|'approver'|'viewer'), added_at`. Unique per (project, user). This is the **project-level RBAC** layer, distinct from org-level admin/member role.
- **project_teams**: `id, project_id → projects (cascade), team_id → teams (cascade), added_at`. Unique per (project, team). The *proper* normalized team↔project link (contrast with `teams.active_projects` text field above).
- **eqcs** (Engineering Quality Check — the actual executed inspection record): `id, project_id → projects (cascade), location, checklist_id (loose ref, no FK), stage_index, total_stages, stage_result ('pass'|'fail'|'pending'), approver_id (loose ref), approver_log, status ('passed'|'failed'|'pending'|'rfi'), inspected_by (loose ref), inspected_at, rfi_id (loose ref), notes, created_at`. This is the core domain object of the app — a QC inspection instance referencing a checklist/stage/location with a result.
- **issues**: `id, project_id → projects (cascade), title, description, severity ('low'|'medium'|'high'|'critical'), status ('open'|'in_progress'|'resolved'|'closed'), assignee_id, reported_by, due_date, created_at`.
- **register_entries**: `id, project_id → projects (cascade), document_no, title, revision (default 'R0'), status ('active'|'superseded'|'void'), file_url (plain URL string, no real upload), created_at`.
- **project_targets**: `id, project_id → projects (cascade), metric, target_value, current_value, unit, period ('daily'|'weekly'|'monthly'|'quarterly'|'project'), created_at`.
- **project_nomenclature**: `id, project_id → projects (cascade), prefix, description, example, created_at`. **Table/type exists but no API route or UI page implements it** — planned but unbuilt (see §4.5).

**Cascade-delete asymmetry**: deleting a project cascades to `project_members`, `project_teams`, `eqcs`, `issues`, `register_entries`, `project_targets`, `project_nomenclature` — but **not** to `checklists`/`checklist_stages`/`checkpoints` (no FK declared in the per-org schema). Decide whether the Android backend should fix this.

---

## 3. Auth & Session API (reference shape — not prescriptive for Android's own API)

- `POST /api/auth/register` — `{name, email, password}` → creates user with **no org** (org-less until they join/create one). No auto-login-to-org.
- `POST /api/auth/login` — `{email, password}` → picks user's first org as default active org, issues JWT, sets cookie. Returns `{user, orgs, currentOrg}`.
- `POST /api/auth/logout` — clears cookie.
- `GET /api/auth/me` — session bootstrap endpoint; returns `{user, orgs, currentOrg}`, re-validates the token's `orgId` is still valid for the user.
- `POST /api/auth/switch-org` — `{orgId}` → verifies membership, **reissues token** with new orgId/role. Client must persist the new token.
- `POST /api/auth/join-org` — `{organizationId, role}` → idempotent join; **defaults to role `'admin'`** if role omitted (note this default carefully). Does not reissue token — client must call switch-org after.
- No visible server-side enforcement of org-level or project-level roles on mutating endpoints beyond "is authenticated" — role gating today is UI-only. Flag this as something the Android backend likely needs to actually enforce.

---

## 4. Screens / Features (from the current web app)

### 4.1 Global app shell
- **Sidebar** (collapsible): Dashboard, Projects, Checklists, Teams, Organizations, Setup. Shows current org name + role badge, user info, Logout.
- **Header**: page title, org-switcher dropdown (shown only if user belongs to >1 org), search box (non-functional stub), notification bell (non-functional stub), light/dark theme toggle, user menu (Switch Organization, Logout).
- Theme: dark/light mode, persisted, defaults dark.

### 4.2 Auth & onboarding
- **Login** (`/login`): email + password, show/hide password, error banner, link to register.
- **Register** (`/register`): name, email, password (≥6 chars), link to login.
- **Select/Create Organization** (`/select-org`): list of orgs the user belongs to (icon, name, role, licensing) — click to activate; "Create New Organization" modal (name only) → auto-creates org, joins as admin, activates it. Re-enterable anytime via Header's "Switch Organization".
- **Setup** (`/setup`): static developer documentation page (env vars, DB tables, architecture diagram). **Not end-user functionality — recommend dropping for Android**, flagged here only for completeness.

### 4.3 Dashboard (`/dashboard`)
- Welcome banner with date.
- 3 stat tiles: Total Projects, Active Checklists, Teams (trend labels shown are decorative/static, not computed).
- Recent Projects table (name, code, profile, status, created date) — **not clickable** in current code.
- Recent Activity feed — **currently hardcoded mock data**, not from any API. If replicated in the RN app, needs a real activity/audit-log backend feature first.
- Data: single aggregate `GET /api/dashboard` call.

### 4.4 Organizations (`/organizations`)
- Admin-style screen listing all organizations (tenant management), not scoped to "my orgs".
- Table: name, licensing badge (color per tier), user limit, expiry date, console uses, created.
- Add Organization modal: name*, user limit, licensing select, expiry date, logo URL.
- Bulk import (Excel/CSV) with column-mapping, template download, per-row success/error reporting.
- **Note**: this API route currently has no auth guard at all server-side (open) — treat as a gap to fix, not a pattern to copy.

### 4.5 Teams — org-level registry (`/teams`)
- Table: team name, type badge (inspection/audit/compliance), team lead, SPOC, active/inactive assigned projects (free-text, truncated w/ tooltip), created date.
- Add Team modal: org select, name*, type, team lead, SPOC.
- Import/Template/Export(XLSX) support.
- **Recently added feature** (this session, already implemented in the current codebase): clicking a team name selects it and shows a right-hand panel with the team's member(s). Currently uses **dummy/mock member data** (one derived pseudo-member per team, not a real `team_members` table) — there is no real team-membership backend yet. When designing the Android data model, decide whether to build real team membership or keep this feature dummy/deferred.

### 4.6 Projects — list, create, detail workspace

**List (`/projects`)**:
- Header count ("Active: X of Y"), search (debounced), status filter pills (All/Active/Completed/On Hold).
- Table: #, Project name (**click → jumps directly into that project's EQC tab**), Code, Client, Assigned Users (count + first name), Updated By, Updated On, My Role (currently always "—", unimplemented), Edit (pencil → edit modal), Status badge (**click toggles active↔completed optimistically**, rolls back on failure).
- Bulk import/template download.
- "Add Project" → full-page wizard, not a modal.

**Create wizard (`/projects/new`)**, two columns:
- Left "Project Details": name*, unique code*, client name*, project admin* (select from org users), description, 3 permission toggles (Location/Authentication/RFI).
- Right "Site Details": radius (m)*, timezone* (select from ~14 IANA zones), address search + map pin (Google Maps — **currently commented out/non-functional**, only manual lat/lng number entry works), latitude, longitude.
- Same form logic is duplicated in a modal (`ProjectFormModal`) for editing from the list, which additionally exposes a Status select.

**Detail workspace (`/projects/[id]/...`)**: shared header (back link, project name, meta: timezone/lat-lng/client/code; "My Activities"/"Settings" buttons present but non-functional) + tab bar:

| Tab | Purpose | Key UI | API |
|---|---|---|---|
| **EQC** | Log of executed inspections — the core QC record | Filters: RFI (all/rfi/overdue), Status (passed/failed/pending/rfi), search. Summary count tiles. Add EQC modal: location*, checklist select, stage index/total, stage result, EQC status, notes. | `/api/projects/{id}/eqcs` |
| **Issue** | Defect/punch-list tracking | Filters: status, severity, search. Add Issue modal: title*, description, severity, status, due date. | `/api/projects/{id}/issues` |
| **Register** | Document/drawing revision log | Filter: status, search. Add Entry modal: doc no, title*, revision (default R0), file URL (text field, no real upload), status. | `/api/projects/{id}/register` |
| **Checklists** (project-scoped) | Subset view of global checklists filtered to this project | Table: name, created. Add modal: name only. Rows **not clickable** here (unlike the global Checklists page). | `/api/checklists` (client-filtered) |
| **Users** | Assign org users to this project with a project-specific role | Table: name/email/avatar, role badge, added date, remove. Assign modal: user* (excludes existing members), role* (admin/member/inspector/approver/viewer). | `/api/projects/{id}/members` |
| **Teams** | Link/unlink org Teams to this project | Table: team name, type, lead, SPOC, unlink. Link modal: team select (excludes already-linked). | `/api/projects/{id}/teams` |
| **Target** | KPI/performance targets | Card grid: metric, period badge, current/target + unit, progress bar. Add modal: metric*, current value, target value, unit, period. | `/api/projects/{id}/targets` |
| **Nomenclature** | **Referenced in the tab bar but has no implemented page/route (404 if clicked).** A `Nomenclature` type + DB table exist, planned but unbuilt. | — | none |

### 4.7 Checklists — global registry & builder

**List (`/checklists`)**:
- Global table of all checklist templates across all projects (superset of the per-project tab view).
- Columns: name, UOM, reference number, status (active/inactive dot), updated by/at, row-hover action icons (Edit/Copy/Delete — **present but not wired**, decorative).
- Row click → checklist builder detail page.
- Add modal: project select, name*.
- Import maps: Checklist Name, Reference Number, UOM, Stage Name, Checkpoint, Type, Photo→drawing_required, Remark→witness_required. **Import currently hardcodes association to the first project in the list** — a naive behavior, not something to copy as-is.

**Builder (`/checklists/[id]`)** — the richest/most structurally important screen, a two-pane master-detail:
- **Left pane**: draggable list of Stages (browser HTML5 drag-and-drop reorder — in RN this needs a gesture-based reorder library, e.g. `react-native-draggable-flatlist`, persisted the same way via `PATCH /api/checklists/{id}` `{reorder_stages:[ids]}`). "Add" opens Stage modal (name*, Witness Required checkbox, Drawing Required checkbox). Edit/Delete icons present but not wired. Pagination control shown but non-functional.
- **Right pane**: empty until a stage is clicked (no stage auto-selected by design). Once selected: stage name header, "+ Item" (opens Checkpoint modal), "+ Bulk Items" (stub), a "Stage Requirements" checkbox row (Witness/Drawing — **not actually bound to data**, decorative), and a drag-reorderable Checkpoints table (question, input type, static/non-databound photo & remark icons, Edit/Delete stubs). Reorder persisted via `PATCH /api/checklists/{id}` `{reorder_checkpoints:[{id,sr_no}]}`.
- **Add Checkpoint modal** (most complex form in the app):
  - Name*, a **rich-text "question" editor** (bold/italic/underline, link/image insert, bulleted/numbered list) built on the browser's deprecated `contentEditable`/`execCommand` — has no RN equivalent; will need an RN rich-text editor package (e.g. `react-native-pell-rich-editor`, `10tap-editor`) or a deliberately simplified plain-text/markdown substitute.
  - Input type select: Yes/No, Options, Text, Numeric, Date.
  - Photo required / Remark required checkboxes.
  - Type-conditional pass/fail config: Yes/No → per-option "mark as QC fail" checkbox; Options → dynamic add/remove list of value + QC-fail checkbox; Numeric → a single "if value is X then QC fail/pass" condition row; Date → no extra config.
  - This conditional pass/fail authoring is the domain-critical logic of the whole product — replicate its semantics carefully.

---

## 5. Design System (for visual/UX parity — adapt to RN idioms, don't copy 1:1)

- **Brand color**: custom teal (50–950 scale) as primary accent; secondary semantic colors: blue (info/"completed"), amber ("on_hold"/warning), rose/red (destructive/error), neutral gray (backgrounds/text). These are plain hex/Tailwind tokens and can be lifted directly into an RN theme object regardless of styling approach chosen.
- **Dark mode**: full parity dark/light theming, defaults to dark, user-toggleable, persisted (RN equivalent: `useColorScheme` + a persisted override, e.g. via `AsyncStorage`, mirroring the existing `ThemeContext` logic).
- **Font**: Inter (available as a loadable font family in RN via `@expo-google-fonts/inter` or bundled font assets).
- **Core reusable visual patterns** (currently Tailwind utility classes, `.card`/`.btn-primary`/`.btn-secondary`/`.badge-*`/`.input`/`.skeleton`) — recreate as shared RN components/style tokens (e.g. via NativeWind classes, a theme file, or styled-components), not native Android widgets:
  - **Card**: elevated rounded surface, subtle shadow, optional press-feedback (mobile has no hover — use press/active states instead).
  - **Primary/Secondary buttons**: solid-teal-with-glow vs. neutral-gray — `Pressable`-based components with the same two visual variants.
  - **Status badges/chips**: 3 semantic colors keyed to entity status enums (active=teal, completed=blue, on_hold=amber; also severity/type badges reuse this pattern).
  - **Standard text field**: light gray fill, rounded, teal focus ring (RN: `TextInput` with focus-state styling).
  - **Skeleton loading placeholders**: pulsing gray blocks shown while data loads (RN: an animated `Animated.View` opacity pulse or a library like `react-native-skeleton-placeholder`).
- **Modal pattern** (used everywhere — Add/Edit forms): full-screen dim+blur backdrop (tap to dismiss), centered card, header with title + close (X), form body, Cancel/Submit button pair at bottom, submit button shows spinner + disabled while saving. Maps directly to RN's `Modal` component or a bottom-sheet library (e.g. `@gorhom/bottom-sheet`) — consider whether modals should become bottom sheets on mobile for better ergonomics, since that's a common web→mobile adaptation.
- **Master-detail / two-pane pattern**: seen in the Checklist builder (stages list ↔ checkpoints panel) and now also the Teams page (team list ↔ member panel) — left list with selectable rows highlighting the active selection, right pane showing detail or an empty-state prompt ("Select X to view Y"). On a phone-sized screen this two-pane layout won't fit side-by-side — plan to convert it to **drill-down navigation** (tap a row → push a detail screen) rather than a persistent split view, unless targeting tablets specifically.
- **Bulk import/export pattern**: reused across Organizations, Teams, Projects, Checklists — file picker → parse → per-row success/failure summary with an inline error list → retry/done. Also a "download sample template" affordance per entity type showing exact expected columns. `xlsx-js-style` (the web parsing lib) is not RN-compatible — use a React Native-compatible spreadsheet parser (e.g. `react-native-xlsx`/`ssf`-based alternatives) with `react-native-document-picker`, or move parsing server-side and have the app just upload the raw file.

---

## 6. Known Stubs, Gaps & Inconsistencies (do not silently "fix" — decide deliberately per item)

1. **Google Maps location picker is commented out/non-functional** in both places it's used (`/projects/new`, edit modal) — only manual lat/lng entry currently works.
2. **Nomenclature project tab** is referenced in the tab bar but has no page/route/API — would 404 if clicked.
3. **Two parallel team↔project association mechanisms**: normalized `project_teams` join table (used by the project's Teams tab) vs. free-text `active_projects`/`inactive_projects` strings on the Team entity (used by the org-level Teams page/export). Pick one canonical model for the rebuild.
4. **Team "members" feature is dummy data only** — no real `team_members` table/API exists yet (see §4.5).
5. **Dashboard "Recent Activity" feed is hardcoded mock data**, not backed by any real activity/audit log.
6. **Several UI affordances exist visually but aren't wired to any handler**: Edit/Copy/Delete icons on the Checklists list and inside the Checklist builder; Import/Export/Edit buttons on the checklist detail header; "Bulk Items" button; "Stage Requirements" checkboxes in the builder (not persisted); photo/remark table icons in the checkpoint table (static, not data-bound); "My Role" column on Projects list (always "—"); "My Activities"/"Settings" buttons in project header; Header search box; notification bell; checklist builder pagination controls.
7. **No server-side role/permission enforcement** on mutating endpoints beyond "is authenticated" — org-level and project-level roles are currently UI-only gating. The backend should likely enforce these properly regardless of client platform.
8. **Organizations API has no auth guard at all** (open endpoint) — a gap, not a pattern.
9. **Schema-per-org is keyed by org *name***, not org id — renaming an org doesn't rename its schema (drift risk). Consider keying by immutable id in a new backend.
10. **Cascade-delete asymmetry**: deleting a project cascades to most child tables but not to checklists/stages/checkpoints (see §2.2).
11. **Rich-text checkpoint question field** uses deprecated browser APIs (`contentEditable`/`execCommand`) — needs a genuine RN rich-text library, not a literal port.
12. **Register tab "file"** is just a URL text field — no real file upload/storage integration exists to port.
13. **Checklist import hardcodes association to the first project in the org's project list** — not real per-project targeting logic.

---

## 7. Suggested Reading Order for the React Native Rebuild Agent

1. §2 (data model) + §3 (auth) — get the domain and session model straight first, and decide on token storage/transport for RN (secure storage + `Authorization` header vs. reusing cookies).
2. §4.6 (Projects) and §4.7 (Checklists) — the two richest, most central feature areas (EQC execution vs. checklist template authoring), and the ones with the most web-only APIs needing RN replacements (maps, drag-and-drop, rich text).
3. §6 (known gaps) — decide up front which stubs to build for real, which to drop, and which data-model inconsistencies to resolve rather than copy.
4. §5 (design system) — for visual/UX tone and to pick a styling approach (NativeWind vs. a component library vs. hand-rolled `StyleSheet`), and to identify which layouts (esp. two-pane master-detail) need rethinking for phone-sized screens.
