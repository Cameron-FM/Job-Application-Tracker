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
everything into a (optionally cloud-synced) folder. Desktop launchers (`Job Tracker (Mac).app` /
`Job Tracker (Windows).exe`) give it a double-click-to-run feel while it stays a normal local web
app underneath.

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

**The root is deliberately minimal and user-facing** — the double-click launchers, the user's
data, this `app/` folder holding every program file, plus `README.md` and `CLAUDE.md` (the latter
*must* stay at root: Claude Code only auto-loads it from there). Don't add other files to the root;
program files go in `app/`, runtime state in `data/`.

```
Job Tracker Project/               ← project ROOT: only these user-facing items
├── Job Tracker (Mac).app/       # macOS double-click launcher (AppleScript applet → app/launch.command; §9)
├── Job Tracker (Windows).exe    # Windows double-click launcher (wraps app/launcher/windows/launch.bat; §9)
├── README.md               # user-facing setup incl. cloud-save + launcher instructions
├── CLAUDE.md               # import contracts + ask-for-inputs policy — MUST stay at root
├── data/                   # GITIGNORED — ALL user state, created on first run
│   ├── ats.db (+ -wal, -shm)     # SQLite (WAL mode → 3 files while running)
│   ├── files/                    # uploaded CV files (real files on disk)
│   ├── backups/                  # default backup location (folder-per-snapshot)
│   ├── logs/                     # launcher/server log (app.log)
│   ├── config.json               # device-local settings (see §7)
│   ├── backup-state.json         # last-backup + restore provenance
│   └── pending-restore.json      # transient: a staged manual restore (see §7)
├── app/                    # ALL program files (this folder is the npm root — package.json here)
│   ├── package.json  package-lock.json  node_modules/
│   ├── ARCHITECTURE.md     # THIS FILE
│   ├── CHANGELOG.md
│   ├── launch.command      # macOS launcher logic (the .app hands off to this; §9)
│   ├── launcher/
│   │   ├── JobTracker.icns # the built macOS icon (source of truth for build-app.sh)
│   │   ├── icon-src/       # make_icon.swift — SOURCE for the app icon (§9)
│   │   ├── mac/            # JobTracker.applescript + build-app.sh — rebuild the .app
│   │   └── windows/        # launch.bat (the REAL Windows launcher logic, tucked away
│   │                       # here rather than the root) + JobTrackerLauncher.cs +
│   │                       # make_exe.bat + JobTracker.ico — rebuilds
│   │                       # Job Tracker (Windows).exe, which stays at the ROOT and
│   │                       # finds launch.bat via this fixed relative path (see §9.1)
│   ├── server/             # Express + SQLite backend (CommonJS)
│   │   ├── index.js        # app entry: mounts routes, static serving, scheduler, shutdown hook
│   │   ├── db-paths.js     # DATA_DIR/FILES_DIR/DB_PATH constants (NO other deps — §6);
│   │   │                   # DATA_DIR = ../../data (two up: app/server → root)
│   │   ├── db.js  config.js  backup.js  session.js  helpers.js  seed.js
│   │   └── routes/         # jobs, companies, contacts, documents, activities,
│   │                       # dashboard, search, backups (/api/settings + /api/backups*), session
│   ├── scripts/            # standalone CLIs (used by humans and by Claude via CLAUDE.md)
│   │   └── import-job.js  import-contact.js  scan-documents.js
│   └── client/             # React + Vite frontend (ESM)
│       ├── vite.config.js  # dev server on 5173, proxies /api → 3400
│       └── src/            # main.jsx App.jsx api.js hooks.js session.js constants.js utils.js
│                           # searchUtils.js (shared by GlobalSearch + SearchResults, see §11)
│                           # styles.css + components/ + pages/ (as before)
└── (README.md and CLAUDE.md sit at the root, above)
```

---

## 4. Commands

**All npm commands run from inside `app/`** (that's where package.json lives) — i.e.
`cd app && npm start`. The launchers do this automatically; only terminal use needs the `cd`.

| Command (from `app/`) | What it does |
|---|---|
| `npm install` | Installs backend deps; `postinstall` also installs the client. |
| `npm start` | **Production.** Builds the client to `client/dist`, then Express serves everything on **:3400**. |
| `npm run dev` | **Development.** `concurrently` runs the API (`node server/index.js`, :3400) + Vite (:5173). Vite proxies `/api` → 3400. |
| `npm run seed` | Loads sample data. Refuses if the DB already has companies. |
| `npm run import -- <file.json>` | Create/update a job from JSON (see CLAUDE.md). `--update <id>` to patch. |
| `npm run import-contact -- <file.json>` | Create/enrich a contact from JSON; auto-links to company jobs. |
| `npm run scan-documents` | Registers files dropped directly into `data/files/` into the CV Library. |
| Double-click `Job Tracker (Mac).app` (macOS) / `Job Tracker (Windows).exe` (Windows) | The desktop launchers — see §9. Equivalent to `npm start`, plus health-check/reuse/lifecycle. |

**`ATS_DATA_DIR=/some/path`** env var repoints `DATA_DIR` (used for isolated testing or a second instance).
**`JOB_TRACKER_SESSION=<id>`** marks the process as launcher-managed — see §9. Never set this for
normal manual `npm start`/`npm run dev`.

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
  `stored_path` is an **absolute** path into `data/files/` (see gotcha §12).
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

`server/session.js` (§9) sits outside this graph entirely — it has zero dependency on db.js,
backup.js, or config.js, purely in-memory state. Keep it that way; it's required directly by
index.js, not by db.js.

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
   local path (`FILES_DIR + basename`). Idempotent; a no-op on a normal start (see gotcha §12).
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
- `normalizeDocumentPaths(db)` — see §12.

**Scheduling & shutdown** (server/index.js): `startScheduler()` after `listen`; the shutdown sequence
(shared with the session-idle path — see §9) runs one final `createSnapshot('on-close')` (if
`backupOnClose`) then `process.exit(0)`, guarded against double-fire.

**Config & state files** (all in `data/`, gitignored, **excluded from snapshots** — they're device-specific):
- `config.json` — `deviceName, backupDir, autoBackup{enabled,intervalMinutes}, backupOnClose,
  autoRestoreOnEmpty, retentionCount`. Defaults in config.js `DEFAULTS`.
- `backup-state.json` — `lastBackupAt, lastBackupName, restoredFrom{name,device,at,auto}`.
- `pending-restore.json` — transient staged restore.

**Cloud detection** (`config.detectStorageMode`): pure string-match of the resolved `backupDir` against
known sync paths (`~/Library/CloudStorage/GoogleDrive-…`, `Dropbox`, `OneDrive-…`, `Box-…`, iCloud
`Mobile Documents/com~apple~CloudDocs`, and classic `~/Dropbox`, `~/Google Drive`, etc.). Returns
`{mode:'local'|'cloud', provider}`. **Manual override:** `config.storageOverride` (a provider-name
string, set via the "This folder is synced by" select in Settings) beats path detection in
`getStatus()` — needed because path-sniffing can't see "in-place" sync setups, e.g. Google Drive's
"sync this folder from computer" mirroring the project's own `data/backups` (the user's actual setup;
Drive's mirror config lives in an opaque local DB, so detection isn't feasible). When overridden,
`storage` carries `overridden:true` and the badge shows "(set manually)". The app **never** talks to a
cloud API — it only writes files; the user's cloud app uploads them. `resolveBackupDir` falls back to
the local default if the configured dir is missing/unwritable so backups never silently fail; Settings
also has a "Reset to default" button (uses `defaultBackupDir` from `getStatus()`) to restore the
project-local `data/backups` path.

---

## 9. Desktop launchers & session lifecycle

Lets a user download the repo and double-click **`Job Tracker (Mac).app`** (macOS) or
**`Job Tracker (Windows).exe`** (Windows) instead of using a terminal — while the app underneath
stays an ordinary local web app (no Electron/Tauri, nothing new to learn if you're just editing
routes or pages).

### 9.1 The launcher scripts

**`app/launch.command`** (macOS — lives in app/, invoked by the .app) and
**`app/launcher/windows/launch.bat`** (Windows — lives nested under app/, invoked by the .exe) are
the *only* places launcher logic lives — kept deliberately separate from application code, and both
deliberately out of the project root so the root stays down to just the two double-click launchers,
data/, and app/. Both do the same sequence:

1. Resolve the project directory from **their own location** (`cd "$(dirname "$0")"` /
   `cd /d "%~dp0"`) — works regardless of where the repo was cloned, never a hardcoded path.
2. **Augment PATH, then** check `node`/`npm`; show a native alert (macOS `osascript`; Windows `mshta`)
   and exit cleanly if still missing. The augment step is essential — see gotcha §12.16: a
   double-clicked app does **not** load the user's shell profile, so Node installed in a non-standard
   spot (this repo documents `~/.local/node`) is invisible unless the launcher explicitly adds the
   usual install dirs (`~/.local/node/bin`, `/opt/homebrew/bin`, `/usr/local/bin`, Volta, nvm) to PATH.
3. Probe `GET http://localhost:3400/health` (see §9.2). If it responds and `app == "job-tracker"`,
   **reuse it** — just open the browser and exit. Never assumes port 3400 is us otherwise, and
   never kills whatever else might be listening there.
3b. **Port-settle** (only reached if not reused): if the port is momentarily still held by a
   just-exiting previous instance, wait briefly (bounded ~5s, re-checking for reuse each tick) for it
   to free before starting fresh — so a new start never collides with an old one exiting. See §9.4.
4. `npm install` (keeps deps in sync after a `git pull`), logging to `data/logs/app.log`.
5. Start the server **in the background** with a freshly generated session id passed via the
   `JOB_TRACKER_SESSION` env var (e.g. `job-tracker-session-<timestamp>-<random>`) — this is what
   marks the process as launcher-managed (§9.3).
6. Poll `/health` once a second for up to 30s; on success, open the browser to
   `http://localhost:3400`. On failure/timeout, show an alert pointing at `data/logs/app.log`.

**`Job Tracker (Mac).app` is a committed AppleScript applet, NOT a hand-made bundle (this matters — see
below).** It's built by `launcher/mac/build-app.sh` from `launcher/mac/JobTracker.applescript` via
`osacompile`, then ad-hoc code-signed. The applet does nothing but resolve the project directory (the
folder containing the `.app`, via `path to me` → `dirname`) and fire off `launch.command` **detached**
(`nohup … > /dev/null 2>&1 &`). Two hard-won reasons it's built this way, both discovered by real
failure (see gotchas §12.16–§12.18):
- **Why an applet, not a shell-script executable:** modern macOS (26+) silently refuses to launch a
  `.app` whose `CFBundleExecutable` is an unsigned shell script via double-click/LaunchServices (it
  runs fine from a terminal, which is why it looked OK in early testing). An osacompile applet has a
  real, macOS-trusted Mach-O executable, so it launches. This is why the earlier "tiny shell-script
  launcher inside the bundle" approach was scrapped.
- **Why detached (`nohup … &`):** AppleScript's `do shell script` waits for the command's stdout to
  reach EOF. `launch.command` starts a long-lived server, so a foreground call hangs forever. Backgrounding
  with nohup + redirecting all output lets the applet return immediately while launch.command runs on.

The committed `.app` works on clone with no build step; run `build-app.sh` only if you change the
applet source or the icon.

**`Job Tracker (Windows).exe` is also committed** — same relationship as the Mac applet: it's a
tiny (~20-line) wrapper, `launcher/windows/JobTrackerLauncher.cs`, that finds its own folder (the
project root, where the `.exe` itself lives) and launches **`app/launcher/windows/launch.bat`**
below it, hidden, then exits immediately; all the real launcher logic still lives in `launch.bat`
alone, kept separate from application code. The compiled wrapper hardcodes that relative path
(`Path.Combine(exeDir, "app", "launcher", "windows", "launch.bat")` — see `JobTrackerLauncher.cs`),
so **the `.exe` must stay at the project root** (it locates `launch.bat` relative to itself) and
**`launch.bat` must stay at that exact nested path** — moving either breaks the pairing until
`JobTrackerLauncher.cs` is updated and recompiled. `launch.bat` also remains fully double-clickable
on its own from inside `app/launcher/windows/` (Windows runs `.bat` files directly, no wrapper
required, and it self-locates the project root regardless of being called directly or via the
`.exe`) — the `.exe` exists purely for a nicer icon/name to pin to the Start menu or taskbar, and to
keep the root free of a bare `.bat` file.

It's built by running `launcher/windows/make_exe.bat` **once, on an actual Windows machine**
(compiles `JobTrackerLauncher.cs` with **`csc.exe`**, the C# compiler that ships with every Windows
install's .NET Framework — no Visual Studio, no downloads — and bakes in the icon at
`launcher/windows/JobTracker.ico` via `/win32icon:`). `make_exe.bat` is confirmed to compile
successfully on a real Windows machine. Its actual double-click **launch behavior** (does it
correctly bring up the server/browser end-to-end) is still unverified from this dev environment,
since development happens on macOS — treat that part as carefully-written-but-unverified until
confirmed on a real Windows run.

**Rebuild required after moving `launch.bat` into `app/launcher/windows/`:** the previously-built
`Job Tracker (Windows).exe` was compiled when `JobTrackerLauncher.cs` still looked for `launch.bat`
right next to itself (project root) — that copy is now stale and won't find `launch.bat` at its new
nested path. Whenever `JobTrackerLauncher.cs`'s target path or the icon changes, rerun `make_exe.bat`
on Windows and replace the committed `.exe`; there's no way to rebuild it from macOS.

**The app icon** (brand-purple rounded square + white briefcase, matching the sidebar "JT" mark /
`--accent: #4f46e5`) is generated programmatically, headlessly, with zero image-editing tools or
paid assets: `launcher/icon-src/make_icon.swift` draws it via Core Graphics and exports a PNG; `sips`
+ `iconutil` (both ship with macOS) turn that into the `.icns`; a small hand-rolled PNG-embedded ICO
packer (see the regeneration comments at the top of make_icon.swift) produces the `.ico`. The built
`.icns` lives at `launcher/JobTracker.icns` (source of truth for `build-app.sh`, which copies it into
the bundle as `applet.icns`); the `.ico` at `launcher/windows/`. Only the Swift *source* is in
`icon-src/`; the built icons are committed, not regenerated on install.

### 9.2 Health endpoint

`GET /health` (bare — **not** `/api`-prefixed, by convention, and because the launcher scripts hard
-code this exact path) in [server/index.js](server/index.js):
```json
{ "status": "ok", "app": "job-tracker", "version": "1.8.0" }
```
`version` is read live from the root `package.json` (`require('../package.json').version`) —
**never hardcode it**; it'll silently go stale otherwise (this happened once already — see CHANGELOG).
This is what launch.command/launch.bat use both to detect "is a Job Tracker instance already running
on this port" (step 3 above) and "has the freshly-started one finished booting" (step 6).

### 9.3 Session lifecycle & idle-shutdown (server/session.js + client/src/session.js)

**The problem this solves:** the server should shut itself down once the user is done (closes the
browser/app), without a "kill on tab close" mechanism — browsers don't expose that reliably. Instead:
a heartbeat scheme, entirely separate from and *layered on top of* the backup system's own shutdown
hook (§8).

**Backend — `server/session.js`, pure in-memory, no dependency on db/backup/config:**
- `LAUNCHER_MANAGED = !!process.env.JOB_TRACKER_SESSION` — computed once at module load. **This is
  the master switch.** If the process was started by a plain `npm start`/`npm run dev` (no env var),
  every function in this module is a no-op — manual/dev runs never auto-shut-down, full stop.
- `activeSession` — seeded from the env var if present, else lazily minted on the first
  `POST /api/session/start` (covers the rare case of hitting that endpoint with no launcher, e.g.
  future tooling — still harmless since the idle monitor stays off without `LAUNCHER_MANAGED`).
- `lastHeartbeat` — seeded to `Date.now()` **at boot**, not null. This matters: it gives a free ~60s
  grace period after startup for the browser to open and the frontend to register, before the idle
  check could ever see a false "60s of silence."
- `registerSession()` (→ `POST /api/session/start`) — returns the current `activeSession` id. This
  doubles as "how does the frontend learn the launcher-generated token" — it never has to know it in
  advance, it just asks.
- `heartbeat(sessionId)` (→ `POST /api/session/heartbeat`) — bumps `lastHeartbeat` if the id matches;
  always returns `{ ok, sessionId: activeSession }`. A mismatch (`ok:false`) means the server restarted
  since this tab last registered — the frontend re-adopts the returned id and carries on (see below).
- `startIdleMonitor(onIdle)` — no-op unless `LAUNCHER_MANAGED`. Every `CHECK_INTERVAL_MS` (30s) it
  checks `Date.now() - lastHeartbeat > IDLE_TIMEOUT_MS` (60s). **It does not exit on the first idle
  check** — it sets an `idlePending` flag and only calls `onIdle()` on the *next* still-idle check.
  That one-interval gap is the **grace window** (below). `noteActivity()` (called by both
  `registerSession` and a matching `heartbeat`) clears `idlePending`, so any reconnect cancels a
  pending shutdown. Both constants are overridable via `ATS_IDLE_TIMEOUT_MS` /
  `ATS_IDLE_CHECK_INTERVAL_MS` env vars **for fast local testing only** — production always uses the
  60s/30s from the brief.

**The grace period / reopen-race guard (§9.4) — why `idlePending` exists:** without it, there's a race
where a user closes the last tab and immediately reopens the app, and the server idle-shuts-down in the
tiny window between the launcher's `/health` probe (which found it alive → reused it) and the reopened
tab's first heartbeat arriving. The grace window closes this: a live server (even one with a pending
shutdown) is safely reused by the launcher, and the reopened tab's `registerSession`/`heartbeat` within
the grace window clears `idlePending` so the shutdown never fires. **Do not "optimize" this back to an
immediate exit on first idle detection.**

> Design note / dead-end to avoid re-attempting: an earlier idea was to have `/health` report
> `status:"shutting-down"` so the launcher could detect a dying server. It **doesn't work** — `shutdown()`
> runs fully synchronously (set flag → sync `VACUUM INTO` backup → `process.exit`) and never yields to
> the event loop, so the server can never serve that status; `/health` is only ever "ok" or gone. The
> grace period is the correct mechanism instead.

**The merge with backup's shutdown hook — the one thing to get right if you touch either system:**
`server/index.js` has a **single** `shutdown()` function. Both `process.on('SIGINT'/'SIGTERM', shutdown)`
*and* `session.startIdleMonitor(shutdown)` call the exact same function — so however the process is
asked to stop (a human's Ctrl+C, the OS, or nobody-has-a-tab-open-for-60s), the on-close backup (§8)
**always** runs, and the `shuttingDown` re-entrancy guard means it only runs once. If you ever add a
third way to stop the server, funnel it through this same `shutdown()` — do not call `process.exit()`
anywhere else.

**Frontend — `client/src/session.js`, started from `main.jsx` (not a React effect/hook):**
- `startSessionHeartbeat()`: on load, `POST /api/session/start` to learn the session id; every 10s
  after, `POST /api/session/heartbeat`; if the server ever returns `ok:false` (it restarted), silently
  re-adopts the new id from the response and keeps going.
- Deliberately plain module-level code, not a `useEffect` — this is app-lifecycle plumbing, not UI
  state, and staying outside React sidesteps any interaction with StrictMode's dev-mode double-invoke
  of effects.
- **Multiple tabs "just work"** with zero extra code: each tab independently runs this loop, and the
  server only cares that *some* heartbeat keeps arriving — closing one tab while another stays open
  never triggers a shutdown.
- Always runs, regardless of whether the server is launcher-managed — against a manually-started
  server this is just harmless, ignored background chatter (confirmed: `LAUNCHER_MANAGED=false` means
  the backend never even looks at `lastHeartbeat`).

**Verified behavior (manual test procedure, since there's no test framework — see §13):** boot with
`JOB_TRACKER_SESSION` set and `ATS_IDLE_TIMEOUT_MS`/`ATS_IDLE_CHECK_INTERVAL_MS` set low (e.g.
2000/2000); confirm (a) with zero heartbeats it self-shuts-down (after two idle checks — the grace) and
logs an on-close backup, (b) with heartbeats arriving every few seconds it stays up indefinitely, (c)
the **reopen-race guard**: wait for the log line "will shut down at the next check unless a tab
reconnects", then fire `POST /api/session/start` + heartbeats *during* that grace window and confirm it
stays alive with no "shutting down" log line, (d) a real browser tab loading the built client actually
fires `POST /api/session/start` then `POST /api/session/heartbeat` on the 10s interval (browser network
log) with zero console errors.

### 9.4 The reopen race & how the launchers avoid duplicate servers

Full picture of "close the last tab, immediately double-click the app again":
1. **The launcher checks `/health` itself** (server-to-server, not via the browser) — so it detects a
   still-running instance regardless of browser timing, and **reuses it** (opens the browser, exits)
   rather than starting a second server. Verified: reuse returns in ~0.15s with no new process.
2. **A true duplicate is physically impossible** — only one process can bind port 3400; a second
   `npm start` would `EADDRINUSE` and fail. You can never have two servers on 3400.
3. **The server's grace period (§9.3)** means the instance the launcher just reused won't die out from
   under the reopening tab — the tab reconnects within the grace window and cancels the pending shutdown.
4. **Port-settle in the launchers** (`launch.command` `port_in_use()` loop / `launch.bat` `:settle_loop`)
   handles the only remaining sliver: if a previous instance was in its final `process.exit` at the
   exact moment of a fresh launch, the launcher waits (bounded, ~5s, re-checking for reuse each tick)
   for the port to free before starting — so a fresh start never collides with a just-exiting one. It's
   bounded and re-checks reuse, so it never hangs on a *foreign* process holding the port.

Net result: reopening never creates duplicates, and never opens the browser onto a server that's about
to vanish.

---

## 10. API surface

All under `/api` except `/health` (§9.2, bare by convention). JSON. Errors → `{ error: string }` via
the central handler in index.js (better-sqlite3 is synchronous, so thrown errors land there; set
`err.status` for non-500).

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
- **search** — `GET /search?q=&limit=` → `{ results: [...], total }`, a single relevance-ranked, flat
  array across jobs/companies/contacts/documents/activities (plain `LIKE '%q%'` across the fields a user
  would recognize a record by — title/name/company/location/summary/etc., see routes/search.js). Each
  row is `{ type, id, title, score, date, ...type-specific fields }` — `type` is the discriminator the
  client uses to pick an icon/label/route (`searchUtils.js`, §11). Relevance is a 3-tier score computed
  in JS per row (primary-field starts-with > contains > secondary-field-only match), not a SQL full-text
  index — fine at this app's scale. `limit` defaults to 8 (dropdown); the full search page (§11) asks for
  up to 200. `total` is the pre-limit match count, used for the dropdown's "View all N results" link.
  Empty result for `q` under 2 chars.
- **settings/backups** (routes/backups.js, mounted at `/api`) — `GET/PATCH /settings`,
  `GET /backups`, `POST /backups`, `POST /backups/restore-latest`, `DELETE /backups/:name`.
- **session** (routes/session.js, mounted at `/api/session`) — `POST /start`, `POST /heartbeat`. See §9.3.

**Reusable server helpers (helpers.js) — prefer these over re-implementing:**
`STAGES`, `TERMINAL_STAGES`, `normalizeDates` (`''`→`null` for date fields), `buildUpdate(table,id,body,allowed)`
(whitelisted partial UPDATE), `logActivity({...})`, `resolveCompany({company_id|company_name, company_fields})`
(case-insensitive match; **backfills blank company fields, never clobbers**; creates if new),
`linkContactToCompanyJobs`, `localToday`, `scanForNewDocuments`.

---

## 11. Frontend architecture

- **Entry:** `main.jsx` starts the session heartbeat (§9.3) then → `BrowserRouter` → `App.jsx` defines
  routes inside `<Layout>`. Add a page = add a `pages/X.jsx` + a `<Route>` in App.jsx + (usually) a
  nav item in `components/Layout.jsx`.
- **Data fetching:** `api.js` exposes `api.get/post/patch/del/upload`; it throws `Error(server message)`
  on non-2xx. `hooks.js` `useFetch(url)` → `{ data, error, reload }`; `useDebouncedValue(value, ms)` for
  input-driven fetches (used by search). Pages fetch on mount and call `reload()` after mutations. There
  is **no global state store** — each page owns its data.
- **Modals:** all create/edit forms live in `components/forms.jsx` (`JobFormModal`, `ContactFormModal`,
  `CompanyFormModal`, `ActivityFormModal`, `LinkContactModal`, `AttachDocModal`, `LogInteractionModal`),
  built on `components/Modal.jsx` + the `Field`/`useForm`/`useSubmit`/`SubmitRow` primitives there.
  Parent pages control visibility via state (e.g. `modal === 'edit'`).
- **Shared display:** `components/Badges.jsx` (`StageBadge`, `TypeBadge`, `StatusBadge`, `DueBadge`,
  `ReferralBadge`) — colours come from `constants.js`. `KanbanBoard.jsx` (native HTML5 drag-and-drop,
  no dep; hide-Interested widens columns via `--kanban-col-w`). `Timeline.jsx`, `CompanyLogo.jsx`,
  `TextTooltip.jsx`.
- **Global search:** `components/GlobalSearch.jsx`, rendered once in a `.topbar` at the top of
  `Layout.jsx`'s `<main>` (so it's centered above the page content on every page). Debounces the query
  250ms (`useDebouncedValue`), hits `GET /api/search?q=&limit=8` (§10) — the server already returns the
  list ranked, GlobalSearch just renders it. Dropdown supports arrow-key nav (Enter to navigate),
  Escape/outside-click to close, and `⌘K`/`Ctrl+K` focuses it from anywhere via a `window` keydown
  listener. Each row shows an icon + a text type-tag (`.search-type-tag`) so the record type is never
  icon-only. A trailing "View all N results →" row (also arrow-key-navigable, from `total` in the
  response) links to `/search?q=` — `pages/SearchResults.jsx`, a full page with type-filter buttons,
  Relevance/Newest/Name-A–Z sort (client-side re-sort of one `limit=200` fetch — no server-side sort
  param), and a "← Back" button (`navigate(-1)`, so it returns wherever the user actually came from,
  unlike the fixed-destination `back-link`s on the other detail pages). Both GlobalSearch and
  SearchResults share `searchUtils.js`'s `annotateResult()`/`RECORD_TYPES` to turn a raw `/api/search`
  row into `{ icon, typeLabel, title, subtitle, to }` — **if you add a new searchable record type, add
  it there once** rather than duplicating the icon/label/route mapping in both places. Each result maps
  to a route (`/jobs/:id`, `/companies/:id`, `/people/:id`, `/cvs` for documents — there's no
  per-document detail route — or a job/contact's page for an activity).
- **Enums/colours:** `constants.js` mirrors the server enums (STAGES, CONTACT_TYPES, CONVERSATION_STATUSES,
  ACTIVITY_TYPES, DOC_TYPES) + colour maps + `ACTIVITY_ICONS`. **If you change a server enum, change this too.**
- **Dates/format:** `utils.js` — `todayStr`, `fmtDate` (`'7 Jul 2026'`), `isOverdue`, `isToday`.
- **Styling:** one file, `styles.css`, using CSS variables. Reuse existing classes (`card`, `table`,
  `badge`, `btn`, `field`, `form-grid`, `modal-*`, `detail-list`, `side-item`, etc.) before inventing new ones.

---

## 12. Gotchas & things that will bite you ⚠️

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
13. **Never set `JOB_TRACKER_SESSION` for a manual/dev server.** It flips `LAUNCHER_MANAGED` on, arming the
    60s idle-shutdown — surprising if you're just poking at the API from a terminal and not loading the
    frontend. Only the launcher scripts should ever set it.
14. **Testing the idle-shutdown for real takes ~90s** at the real 60s/30s constants. Use
    `ATS_IDLE_TIMEOUT_MS`/`ATS_IDLE_CHECK_INTERVAL_MS` (env vars, seconds→ms) set low for fast iteration —
    see §9.3's test procedure. Always pair with `ATS_DATA_DIR` pointed at scratch data, and always use a
    **different `PORT`** too — launch.command/launch.bat hardcode 3400 for their own health checks, so a
    modified/relocated copy used for testing needs its `PORT`/`HEALTH_URL` edited **and** that port
    explicitly exported so the child `npm start` process actually binds it (the scripts' local `PORT=…`
    assignment is not itself `export`ed to the child unless you add that, or export it in the invoking shell).
15. **The Windows `.exe` build step is confirmed working; its launch behavior isn't yet.**
    `make_exe.bat`/`JobTrackerLauncher.cs` have been run on a real Windows machine and successfully
    produced `Job Tracker (Windows).exe`. Whether double-clicking it correctly launches the server
    end-to-end hasn't been confirmed from this (macOS) dev environment. `launch.bat` itself is the
    long-tested, trustworthy entry point the `.exe` wraps — if the `.exe` ever misbehaves, double-click
    `launch.bat` directly to isolate whether the problem is in the wrapper or the launcher logic.
16. **A double-clicked `.app`/`.bat` does NOT load the user's shell profile** (`~/.zshrc`, `~/.bash_profile`),
    so `PATH` is the minimal GUI default — a Node that works fine in Terminal can be invisible to the
    launcher. This bit us: this machine's Node lives at `~/.local/node/bin` (per CLAUDE.md), which isn't
    on the GUI PATH, so the very first double-click silently failed the `node`/`npm` check. Fix (in
    `launch.command`): before checking, prepend the common install dirs to PATH
    (`~/.local/node/bin`, `/opt/homebrew/bin`, `/usr/local/bin`, `~/.volta/bin`, newest `~/.nvm/...`).
    **If you add any launcher step that shells out to a tool, remember it runs with the bare GUI PATH,
    not your Terminal's.** To reproduce the GUI environment for testing:
    `env -i PATH="/usr/bin:/bin:/usr/sbin:/sbin" HOME="$HOME" bash app/launch.command`.
17. **On macOS 26+, a `.app` with a shell-script `CFBundleExecutable` won't launch via double-click** —
    LaunchServices silently declines (no error, no bounce), even though running the script directly from a
    terminal works. This is exactly why the first launcher attempt (a tiny shell script inside the bundle)
    failed for the user despite "working" when I ran it directly. **`Job Tracker (Mac).app` is therefore an
    `osacompile` AppleScript applet** (real Mach-O executable), ad-hoc signed. Rebuild it with
    `launcher/mac/build-app.sh`, never by hand-assembling a bundle around a script. Verify a launch fix by
    actually double-clicking / `open`-ing the bundle with **no server already running** (a running server
    masks the bug — the app appears to "work" because a browser opens onto the already-up instance).
18. **AppleScript's `do shell script` waits for the command's stdout to hit EOF** — so calling
    `launch.command` (which starts a long-lived server) foreground **hangs the applet forever**. The applet
    MUST launch it detached: `nohup … > /dev/null 2>&1 &`. If you edit `JobTracker.applescript`, keep that.
19. **Icon on an osacompile applet:** `osacompile` sets both `CFBundleIconFile` (→ `applet.icns`) *and*
    `CFBundleIconName` (→ an `Assets.car` entry), and the asset-catalog one wins — so just replacing
    `applet.icns` isn't enough. `build-app.sh` deletes `CFBundleIconName` and `Assets.car` so our icon shows.
    Note macOS icon caching: after a rebuild the new icon may not appear in Finder until re-login or an icon-
    cache refresh, even though it's correct in the bundle.
20. **The npm root is `app/`, not the project root.** Every npm command must run from inside `app/`
    (`cd app && npm …`); running npm at the project root fails with "no package.json". Likewise the root
    layout is a deliberate user-facing contract (§3): `Job Tracker (Mac).app`, `Job Tracker (Windows).exe`,
    `data/`, `app/`, `README.md`, `CLAUDE.md` — **not** `launch.bat`, which is deliberately tucked away at
    `app/launcher/windows/launch.bat` rather than the root (see §9.1). Don't add other root-level files —
    new program files go in `app/`, runtime state in `data/`. `DATA_DIR` in db-paths.js is `../../data`
    (two up from app/server); if you move code around, that anchor and the launchers' path-resolution
    (`APP_DIR`/`ROOT_DIR` in launch.command, the `HERE`/`ROOT` computation in launch.bat, and
    `JobTrackerLauncher.cs`'s hardcoded relative path to launch.bat) are what must stay true.

---

## 13. Import/scrape scripts (scripts/) & CLAUDE.md

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

**No automated test suite exists anywhere in this project.** "Testing" a change means: manual API checks
via `curl`, an isolated server instance via `ATS_DATA_DIR` (+ a different `PORT` if also touching the
launcher scripts, see gotcha §12.14), and/or the browser preview tooling. Always verify against scratch
data, never the real `data/` folder, and clean up stray background server processes afterward
(`lsof -Pan -i :<port> | grep LISTEN` to check what's actually running before assuming).

---

## 14. How to add things (playbooks)

- **A new job/company/contact field:** migration in db.js (§12.4) → add to the route's field whitelist
  (`JOB_FIELDS` etc.) and INSERT → add to the client form in `forms.jsx` → surface it in the detail page →
  if importable, update the script + CLAUDE.md → **update §5 here**.
- **A new page:** `pages/X.jsx` (use `useFetch`) → `<Route>` in App.jsx → nav item in Layout.jsx →
  reuse existing CSS classes → **update §3/§11**.
- **A new API endpoint:** add to the relevant `routes/*.js` (or a new router mounted in index.js) →
  reuse `buildUpdate`/`logActivity`/`resolveCompany` → **update §10**.
- **Anything touching backups/restore/startup:** re-read §6–§8, keep the two restore paths distinct,
  and **update §7/§8**.
- **Anything touching the launchers or session lifecycle:** re-read §9 in full first — the shutdown-path
  merge (§9.3) is the easiest thing to accidentally break. Test with the fast env-var overrides
  (gotcha §12.14) before declaring done, and **update §9**.
- **A new searchable record type (global search):** add a `SELECT ... WHERE ... LIKE` block in
  `routes/search.js` mapping the new table's rows into the common `{ type, id, title, date, score,
  ...extra fields }` shape (reuse `scoreMatch()` for ranking) → add one entry to `RECORD_TYPES` in
  `searchUtils.js` (label/plural/icon) and a case in that file's `subtitleFor()`/`routeFor()` → that's
  it — `GlobalSearch.jsx` and `SearchResults.jsx` both consume `annotateResult()` and need no changes.
  **Update §10/§11.**

---

## 15. Privacy / git

`data/` and `logs/` are gitignored — the DB, CV files, config, backups, and launcher logs stay local and
are never committed. `Job Tracker (Mac).app`, `Job Tracker (Windows).exe`, and `launcher/` (including
the built `.icns`/`.ico`) **are** committed — they're application distribution assets, not user data.
Only application code + these docs + those launcher assets are tracked. The repo may be public; keep
real personal data out of committed files (e.g. CLAUDE.md examples use fictional names).
