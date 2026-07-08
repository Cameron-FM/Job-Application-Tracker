# Job Tracker — Architecture & System Bible

> **Purpose.** This is the single source of truth for how this project is built: structure,
> data model, every subsystem, the key design decisions, and the gotchas that will bite you
> if you don't know them. A fresh Claude Code session should be able to read this top-to-bottom
> and then make changes **without breaking anything**.
>
> **Maintenance rule (important).** Keep this document current. Whenever you change the schema,
> add a route/page/script, change the startup sequence, or alter any of the "gotcha" behaviours,
> **update the relevant section here in the same change.** Treat a stale bible as a bug.
> [CLAUDE.md](CLAUDE.md) covers the *import contracts* (pasting jobs/LinkedIn profiles) and the
> ask-for-missing-inputs policy; this file covers *how the system works*. Keep both in sync.

---

## 1. What this is

A personal, locally-run job-application tracker (a mini-ATS/CRM). Single user, single machine
at a time, no auth, no hosted backend. Node/Express + SQLite backend, React/Vite frontend.
All state lives in `data/` (a SQLite DB + uploaded CV files). A built-in backup system snapshots
everything into a (optionally cloud-synced) folder.

Design ethos: **minimal dependencies, boring/robust tech, everything on disk, no cloud accounts.**
Prefer reusing the existing helpers and patterns below over introducing new abstractions.

---

## 2. Tech stack & conventions

- **Backend:** Node.js, Express 4, `better-sqlite3` (synchronous SQLite), `multer` (file uploads).
  **CommonJS** (`require`/`module.exports`).
- **Frontend:** React 18 + Vite 5, `react-router-dom` 6. **ESM** (`import`). No UI framework —
  hand-rolled CSS in `client/src/styles.css`.
- **No TypeScript, no test framework, no linter config.** Match the surrounding style.
- **Node:** installed at `~/.local/node`; if `npm` isn't found, prefix commands with
  `export PATH="$HOME/.local/node/bin:$PATH" && …`.

**Hard rule:** backend is CommonJS, client is ESM. Never mix module systems within a side.

---

## 3. Repository layout

```
Custom ATS Project/
├── package.json            # root scripts + backend deps
├── CLAUDE.md               # import contracts + ask-for-inputs policy (for AI sessions)
├── ARCHITECTURE.md         # THIS FILE
├── README.md               # user-facing setup incl. cloud-save instructions
├── server/                 # Express + SQLite backend (CommonJS)
│   ├── index.js            # app entry: mounts routes, static serving, scheduler, shutdown hook
│   ├── db-paths.js         # DATA_DIR/FILES_DIR/DB_PATH constants (NO other deps — see §6)
│   ├── db.js               # DB connection, schema, migrations, startup restore sequence
│   ├── config.js           # config.json load/save + cloud-folder detection
│   ├── backup.js           # snapshot/restore engine + scheduler
│   ├── helpers.js          # shared DB helpers (reuse these!)
│   ├── seed.js             # sample data (npm run seed)
│   └── routes/             # one Express router per resource
│       ├── jobs.js  companies.js  contacts.js  documents.js  activities.js
│       ├── dashboard.js    # aggregated counts + due lists
│       └── backups.js      # /api/settings + /api/backups* (mounted at /api)
├── scripts/                # standalone CLIs (used by humans and by Claude via CLAUDE.md)
│   ├── import-job.js  import-contact.js  scan-documents.js
├── client/                 # React + Vite frontend (ESM)
│   ├── vite.config.js      # dev server on 5173, proxies /api → 3400
│   └── src/
│       ├── main.jsx App.jsx        # entry + routes
│       ├── api.js hooks.js         # fetch wrapper + useFetch
│       ├── constants.js utils.js   # enums/colors + date/format helpers
│       ├── styles.css              # ALL styling (hand-rolled)
│       ├── components/             # Layout, Modal, Badges, KanbanBoard, Timeline,
│       │                           # CompanyLogo, TextTooltip, forms.jsx (all modals)
│       └── pages/                  # Dashboard, Jobs, JobDetail, Companies, CompanyDetail,
│                                   # People, PersonDetail, CvLibrary, Settings
└── data/                   # GITIGNORED, created on first run
    ├── ats.db (+ -wal, -shm)       # SQLite (WAL mode → 3 files while running)
    ├── files/                      # uploaded CV files (real files on disk)
    ├── backups/                    # default backup location (folder-per-snapshot)
    ├── config.json                 # device-local settings (see §7)
    ├── backup-state.json           # last-backup + restore provenance
    └── pending-restore.json        # transient: a staged manual restore (see §7)
```

---

## 4. Commands

| Command | What it does |
|---|---|
| `npm install` | Installs backend deps; `postinstall` also installs the client. |
| `npm start` | **Production.** Builds the client to `client/dist`, then Express serves everything on **:3400**. |
| `npm run dev` | **Development.** `concurrently` runs the API (`node server/index.js`, :3400) + Vite (:5173). Vite proxies `/api` → 3400. |
| `npm run seed` | Loads sample data. Refuses if the DB already has companies. |
| `npm run import -- <file.json>` | Create/update a job from JSON (see CLAUDE.md). `--update <id>` to patch. |
| `npm run import-contact -- <file.json>` | Create/enrich a contact from JSON; auto-links to company jobs. |
| `npm run scan-documents` | Registers files dropped directly into `data/files/` into the CV Library. |

**`ATS_DATA_DIR=/some/path`** env var repoints `DATA_DIR` (used for isolated testing or a second instance).

---

## 5. Data model (SQLite)

Defined in [server/db.js](server/db.js) inside `initSchema()`. All timestamps default to
`datetime('now','localtime')`. Date-only fields (`applied_date`, `next_step_due`,
`last_contacted`, `next_followup_due`) are `'YYYY-MM-DD'` strings or NULL.

- **companies** — `id, name (UNIQUE), website, location, industry, summary, description, notes, created_at`
- **jobs** — `id, company_id→companies (CASCADE), title, url, application_url,
  referred_by_contact_id→contacts (SET NULL), location, salary_range, source, stage,
  applied_date, next_step, next_step_due, summary, description, raw_posting, notes,
  created_at, updated_at`
  - `stage` ∈ `Interested, Applied, Screening, Interviewing, Offer, Accepted, Rejected, Withdrawn`
    (`STAGES` in helpers.js + client constants.js — **keep both in sync**). The last three are
    `TERMINAL_STAGES`; "active" = not terminal.
  - `url` = where the posting lives; `application_url` = where you actually apply.
  - `summary` = one-liner for cards/tables; `description` = full detail; `raw_posting` = original verbatim.
- **contacts** — `id, name, company_id→companies (SET NULL, nullable), role_title, contact_type,
  email, phone, linkedin_url, conversation_status, last_contacted, next_followup_due, notes, created_at`
  - `contact_type` ∈ `recruiter, hiring_manager, connection, other`
  - `conversation_status` ∈ `not_contacted, reached_out, in_conversation, awaiting_reply, follow_up_needed, dormant`
- **job_contacts** (M:N) — `job_id, contact_id, relationship`, PK `(job_id, contact_id)`.
  `relationship` is free text (e.g. "Recruiter for this role", "Referrer", "Connection").
- **documents** — `id, label, doc_type (cv|cover_letter|other), filename, stored_path, uploaded_at`.
  `stored_path` is an **absolute** path into `data/files/` (see gotcha §11).
- **job_documents** (M:N) — `job_id, document_id`. One CV → many jobs.
- **activities** — `id, job_id (nullable), contact_id (nullable), activity_type, title, detail,
  occurred_at, created_at`. Append-only timeline; see `logActivity`.

**Referral model:** a job is "referred" iff `referred_by_contact_id` is set. That contact is also
linked in `job_contacts` with relationship `"Referrer"`. Jobs without it are "open applications."

---

## 6. Backend module graph & the circular-dependency rule ⚠️

The startup restore feature means `db.js` needs backup/config logic, but backup/config need paths
and (sometimes) the DB. This was resolved deliberately — **do not casually add `require('./db')`
to config.js or backup.js at the top level.**

```
db-paths.js   ← no project deps (just path/fs). Exports DATA_DIR/FILES_DIR/DB_PATH.
   ↑
config.js     ← requires db-paths only.
   ↑
backup.js     ← requires db-paths + config at TOP. Requires './db' ONLY lazily,
   ↑            inside functions (createSnapshot/getStatus), never at module top.
   │
db.js         ← requires db-paths + backup + config at top. Runs the startup sequence,
                then `module.exports = { db, ... }`.
```

Why it works: when `db.js` loads and requires `backup.js`, backup.js finishes loading (its top
requires don't touch db.js). Later, when a backup function runs at *runtime*, its lazy
`require('./db')` returns the fully-initialised, cached module. If you add a new module that both
"needs paths" and "is needed by db.js at startup," import from **db-paths.js**, not db.js.

---

## 7. Startup sequence (server/db.js) — read before touching db.js ⚠️

`db.js` executes this, in order, at require time, and exports the final handle:

1. **`backup.applyPendingRestore()`** — if `data/pending-restore.json` exists and points at a valid
   backup, swap that backup's `ats.db` + `files/` into place **while nothing has the DB open**, record
   provenance in `backup-state.json`, delete the marker. (This is how a *manual* restore is applied.)
2. **`db = openDb()`** — `new Database(DB_PATH)`, set `journal_mode=WAL` + `foreign_keys=ON`,
   run `initSchema(db)` (CREATE TABLE IF NOT EXISTS + idempotent `ensureColumn` migrations).
3. **Auto-restore if empty** — if `config.autoRestoreOnEmpty` and the DB has zero
   companies+jobs+contacts and a newest backup *with rows* exists: `db.close()`, swap the backup in,
   `db = openDb()` again, record provenance (`auto:true`). This is the zero-touch new-device path.
   The **empty-DB guard means a populated device never auto-restores** — critical safety property.
4. **`backup.normalizeDocumentPaths(db)`** — rewrites every `documents.stored_path` to the canonical
   local path (`FILES_DIR + basename`). Idempotent; a no-op on a normal start (see gotcha §11).
5. **`module.exports = { db, DATA_DIR, FILES_DIR, DB_PATH }`**.

`db` is a `let` reassigned in step 3. Route modules do `const { db } = require('./db')` and are required
by `index.js` **after** db.js finishes, so they always capture the final handle. **Never** cache the
`db` handle before the export, and if you add startup logic that reopens the DB, do it before the export.

**Two restore paths, do not conflate them:**
- **Auto-restore** (empty DB, at startup, in-process, no restart) — step 3.
- **Manual restore** (populated DB) — staged to `pending-restore.json` by the API, applied by step 1
  on the **next restart**. Deferred because swapping a live, open SQLite file mid-run corrupts it.

---

## 8. Backup system (server/backup.js) in depth

**Snapshot format** — a folder per backup in the configured `backupDir`:
```
ats-backup-<deviceSlug>-<YYYYMMDD-HHMMSS>/
├── ats.db      # consistent copy via `VACUUM INTO` (single clean non-WAL file)
├── files/      # copy of data/files/
└── meta.json   # { name, device, createdAt(ISO), reason, counts{jobs,companies,contacts,documents} }
```
- Built under a `.tmp-<name>` dir, then **atomic `fs.renameSync`** into place. `meta.json` is written
  **last** — a folder without a valid `meta.json` is treated as incomplete and ignored by list/restore.
  This is what makes a half-synced cloud folder safe.
- `VACUUM INTO` is synchronous and safe while the app is writing → also usable during shutdown.
- **Never** copy `ats.db`/`-wal`/`-shm` raw; always go through `createSnapshot`.

**Key functions** (all in backup.js):
- `createSnapshot(reason)` — the above. `reason` ∈ `manual|scheduled|on-close|pre-restore-safety`.
  Guarded by a module-level `busy` lock so the timer and a manual click can't overlap. Prunes to
  `retentionCount`. Lazily `require('./db')` for the handle + row counts.
- `listSnapshots()` — scans `backupDir`, returns valid backups newest-first with `sizeBytes`.
- `findLatestBackup()` — newest valid backup + `hasRows` (from meta counts). Used by auto-restore.
- `stageRestore(name?)` — validates target (newest if no name), takes a `pre-restore-safety` snapshot,
  writes `pending-restore.json`. Name-general even though the UI only ever restores the latest.
- `swapBackupIntoData(path)` / `applyPendingRestore()` — pure-fs swaps used at startup (§7).
- `deleteSnapshot(name)` — path-traversal-guarded delete.
- `getStatus()` — everything the Settings page shows (config, resolved dir, writable flag, storage mode,
  last-backup, provenance, live counts, pending marker).
- `startScheduler()/stopScheduler()` — `setInterval(createSnapshot, intervalMinutes*60000)`; `.unref()`d.
  Re-called on settings change to reschedule.
- `normalizeDocumentPaths(db)` — see §11.

**Scheduling & shutdown** (server/index.js): `startScheduler()` after `listen`; `SIGINT`/`SIGTERM`
handler runs one final `createSnapshot('on-close')` (if `backupOnClose`) then `process.exit(0)`,
guarded against double-fire.

**Config & state files** (all in `data/`, gitignored, **excluded from snapshots** — they're device-specific):
- `config.json` — `deviceName, backupDir, autoBackup{enabled,intervalMinutes}, backupOnClose,
  autoRestoreOnEmpty, retentionCount`. Defaults in config.js `DEFAULTS`.
- `backup-state.json` — `lastBackupAt, lastBackupName, restoredFrom{name,device,at,auto}`.
- `pending-restore.json` — transient staged restore.

**Cloud detection** (`config.detectStorageMode`): pure string-match of the resolved `backupDir` against
known sync paths (`~/Library/CloudStorage/GoogleDrive-…`, `Dropbox`, `OneDrive-…`, `Box-…`, iCloud
`Mobile Documents/com~apple~CloudDocs`, and classic `~/Dropbox`, `~/Google Drive`, etc.). Returns
`{mode:'local'|'cloud', provider}`. The app **never** talks to a cloud API — it only writes files; the
user's cloud app uploads them. `resolveBackupDir` falls back to the local default if the configured dir
is missing/unwritable so backups never silently fail.

---

## 9. API surface

All under `/api`, JSON. Errors → `{ error: string }` via the central handler in index.js
(better-sqlite3 is synchronous, so thrown errors land there; set `err.status` for non-500).

- **jobs** — `GET /jobs` (filters: `stage, company_id, active=1, referred=0|1, q`), `POST /jobs`,
  `GET/PATCH/DELETE /jobs/:id`, link/unlink `POST/DELETE /jobs/:id/contacts/:cid`,
  `POST/DELETE /jobs/:id/documents/:did`. GET returns `company_name` + `referred_by_name`.
- **companies** — CRUD; `GET /companies/:id` embeds its jobs + contacts.
- **contacts** — CRUD; create accepts `link_company_jobs` + company_* fields; `GET /contacts/:id`
  embeds linked jobs (with `is_referrer`) + activities.
- **documents** — `GET /documents` (each with its linked jobs), `POST /documents` (multipart, field
  `file`), `POST /documents/scan`, `GET /documents/:id/file[?download=1]`, `PATCH/DELETE /documents/:id`.
- **activities** — `GET /activities?job_id=&contact_id=&limit=`, `POST`, `DELETE /:id`.
- **dashboard** — `GET /dashboard` → counts (incl. `referred`), `job_next_steps`, `contact_followups`,
  `recent_activity`.
- **settings/backups** (routes/backups.js, mounted at `/api`) — `GET/PATCH /settings`,
  `GET /backups`, `POST /backups`, `POST /backups/restore-latest`, `DELETE /backups/:name`.

**Reusable server helpers (helpers.js) — prefer these over re-implementing:**
`STAGES`, `TERMINAL_STAGES`, `normalizeDates` (`''`→`null` for date fields), `buildUpdate(table,id,body,allowed)`
(whitelisted partial UPDATE), `logActivity({...})`, `resolveCompany({company_id|company_name, company_fields})`
(case-insensitive match; **backfills blank company fields, never clobbers**; creates if new),
`linkContactToCompanyJobs`, `localToday`, `scanForNewDocuments`.

---

## 10. Frontend architecture

- **Entry:** `main.jsx` → `BrowserRouter` → `App.jsx` defines routes inside `<Layout>`. Add a page =
  add a `pages/X.jsx` + a `<Route>` in App.jsx + (usually) a nav item in `components/Layout.jsx`.
- **Data fetching:** `api.js` exposes `api.get/post/patch/del/upload`; it throws `Error(server message)`
  on non-2xx. `hooks.js` `useFetch(url)` → `{ data, error, reload }`. Pages fetch on mount and call
  `reload()` after mutations. There is **no global state store** — each page owns its data.
- **Modals:** all create/edit forms live in `components/forms.jsx` (`JobFormModal`, `ContactFormModal`,
  `CompanyFormModal`, `ActivityFormModal`, `LinkContactModal`, `AttachDocModal`, `LogInteractionModal`),
  built on `components/Modal.jsx` + the `Field`/`useForm`/`useSubmit`/`SubmitRow` primitives there.
  Parent pages control visibility via state (e.g. `modal === 'edit'`).
- **Shared display:** `components/Badges.jsx` (`StageBadge`, `TypeBadge`, `StatusBadge`, `DueBadge`,
  `ReferralBadge`) — colours come from `constants.js`. `KanbanBoard.jsx` (native HTML5 drag-and-drop,
  no dep; hide-Interested widens columns via `--kanban-col-w`). `Timeline.jsx`, `CompanyLogo.jsx`,
  `TextTooltip.jsx`.
- **Enums/colours:** `constants.js` mirrors the server enums (STAGES, CONTACT_TYPES, CONVERSATION_STATUSES,
  ACTIVITY_TYPES, DOC_TYPES) + colour maps + `ACTIVITY_ICONS`. **If you change a server enum, change this too.**
- **Dates/format:** `utils.js` — `todayStr`, `fmtDate` (`'7 Jul 2026'`), `isOverdue`, `isToday`.
- **Styling:** one file, `styles.css`, using CSS variables. Reuse existing classes (`card`, `table`,
  `badge`, `btn`, `field`, `form-grid`, `modal-*`, `detail-list`, `side-item`, etc.) before inventing new ones.

---

## 11. Gotchas & things that will bite you ⚠️

1. **WAL = 3 files.** While running, the DB is `ats.db` + `-wal` + `-shm`. Never copy/move them raw for
   a backup — use `VACUUM INTO`. On restore, delete stale `-wal`/`-shm` (swapBackupIntoData does this).
2. **Server changes need a restart.** `npm run dev` does **not** watch server code (only Vite/client
   hot-reloads). After editing anything in `server/` you must restart the process. `npm start` builds the
   client once — client changes there also need a restart/rebuild.
3. **Port 3400 is single-occupancy.** Only one server can bind it. A running `npm start` and a
   `npm run dev` (or a preview server) will collide — symptom: API calls hit the *wrong* (old) server and
   you see stale behaviour or 404s on new routes. Check `lsof -Pan -i :3400 | grep LISTEN` when confused.
4. **Adding a DB column takes TWO edits in db.js:** add it to the `CREATE TABLE` in `initSchema` (for fresh
   installs) **and** add an `ensureColumn('table','col',"col TYPE …")` line (for existing DBs — SQLite has
   no `ADD COLUMN IF NOT EXISTS`). Also add it to the relevant route's field whitelist and client form.
5. **`document.stored_path` is absolute** → after a cross-device restore (or moving the project folder) the
   stored paths point at the *old* machine. `normalizeDocumentPaths` fixes this on every startup by
   rewriting to `FILES_DIR + basename`. This relies on backups **preserving file basenames** (they do —
   `cpSync` copies `files/` verbatim). Don't rename files inside backups.
6. **`resolveCompany` never overwrites.** It backfills only blank company fields. Case-insensitive name
   match. If you need to force-update a company, do it explicitly via the companies route, not resolveCompany.
7. **Enums live in two places** (helpers.js/db.js server-side, constants.js client-side). Changing one
   without the other causes silent mismatches (e.g. a stage that renders with the default grey badge).
8. **Don't `require('./db')` at the top of config.js/backup.js** — see §6. Use db-paths.js for paths;
   lazily require db inside functions if you need the handle at runtime.
9. **Auto-restore only fires on an empty DB.** If you're testing restore and nothing happens, the DB isn't
   empty. Never empty the *real* DB to test — use `ATS_DATA_DIR` pointing at a scratch dir.
10. **Backups exclude config/state files** on purpose (device identity + backup location shouldn't travel).
    Don't add them to a snapshot.
11. **Dates:** send date-only fields as `'YYYY-MM-DD'`; empty string from a form must become `null`
    (`normalizeDates` handles this in the create/update routes). Use `localToday()`/`todayStr()`, not UTC.
12. **Client build is required for `npm start`.** If a new page/component doesn't show up, the client wasn't
    rebuilt — restart `npm start` or run `npm run build`.

---

## 12. Import/scrape scripts (scripts/) & CLAUDE.md

`import-job.js` / `import-contact.js` write **directly to the DB** (they don't go through the HTTP API), so
they work whether or not the server is running. They reuse `resolveCompany`, `logActivity`,
`linkContactToCompanyJobs`. `--update <id>` patches an existing row (only fields present in the JSON;
title/company_name aren't required on update). `scan-documents.js` wraps `scanForNewDocuments`.

The **field shapes and extraction rules** for these live in [CLAUDE.md](CLAUDE.md) — that's the contract
a session follows when the user pastes a posting/profile. When adding a new importable field, update
BOTH the script and CLAUDE.md.

**Scraping job postings (operational note for imports):** many ATSs expose clean public JSON —
**Greenhouse** `https://boards-api.greenhouse.io/v1/boards/<token>/jobs/<id>`, **Ashby**
`https://api.ashbyhq.com/posting-api/job-board/<token>?includeCompensation=true`. Others embed a
JSON-LD `JobPosting` block in the HTML (e.g. Snowflake/Phenom — note the description is HTML-entity-escaped,
unescape **before** stripping tags). Some (Salesforce, LinkedIn, Okta's own site) are bot-blocked; fall
back to the user pasting the text, or a syndicated mirror. Always store the verbatim text in `raw_posting`.

---

## 13. How to add things (playbooks)

- **A new job/company/contact field:** migration in db.js (§11.4) → add to the route's field whitelist
  (`JOB_FIELDS` etc.) and INSERT → add to the client form in `forms.jsx` → surface it in the detail page →
  if importable, update the script + CLAUDE.md → **update §5 here**.
- **A new page:** `pages/X.jsx` (use `useFetch`) → `<Route>` in App.jsx → nav item in Layout.jsx →
  reuse existing CSS classes → **update §3/§10**.
- **A new API endpoint:** add to the relevant `routes/*.js` (or a new router mounted in index.js) →
  reuse `buildUpdate`/`logActivity`/`resolveCompany` → **update §9**.
- **Anything touching backups/restore/startup:** re-read §6–§8, keep the two restore paths distinct,
  and **update §7/§8**.

---

## 14. Privacy / git

`data/` is gitignored — the DB, CV files, config, and all backups stay local and are never committed.
Only application code + these docs are tracked. The repo may be public; keep real personal data out of
committed files (e.g. CLAUDE.md examples use fictional names).
