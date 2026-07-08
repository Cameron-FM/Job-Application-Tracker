# Changelog

All notable changes to this project are documented here.

## [1.6.0] — 2026-07-08

Desktop launchers, automatic server lifecycle management, and a user-friendly layout.

### Changed
- **Restructured the project for non-technical users.** The root folder now contains
  just four visible items — `Job Tracker.app`, `launch.bat`, `data/` (all your data),
  and `app/` (all program files) — plus `CLAUDE.md`, which must stay at the root for
  AI-assisted importing. All npm commands now run from inside `app/`
  (`cd app && npm start`); the launchers handle this automatically. Logs moved to
  `data/logs/`.

### Added
- **Desktop launchers** — double-click `Job Tracker.app` (macOS) or `launch.bat` (Windows)
  to run the app with no terminal: checks Node.js is installed, installs/updates
  dependencies, starts the server, waits for it to come up, and opens the browser.
  Reuses an already-running instance instead of starting a duplicate.
- **Session lifecycle / auto-shutdown** — the server now shuts itself down (taking a
  backup first) once no browser tab has been open for about a minute, via a heartbeat
  sent from the frontend every 10s. Only active when launched via the desktop launchers;
  a manually-run `npm start`/`npm run dev` behaves exactly as before. Includes a **grace
  period** so closing and immediately reopening the app can never race the shutdown, plus
  a **port-settle** step in the launchers so a fresh start never collides with a
  just-exiting instance — reopening never creates duplicate servers.
- `GET /health` — a bare health-check endpoint (`{status, app, version}`) used by the
  launchers to detect an already-running instance and to know when startup is complete.
- Optional one-time `launcher/windows/make_exe.bat` to compile a real `Job Tracker.exe`
  with a custom icon, using the C# compiler that ships with Windows.
- A generated app icon (brand-purple briefcase) for the macOS `.app` and the optional
  Windows `.exe`.
- Settings: a **"This folder is synced by"** override for cloud setups that sync the
  backups folder in place (e.g. Google Drive's "sync this folder from computer"),
  where path detection would otherwise show "Local only" — the badge then shows the
  chosen provider with "(set manually)". Plus a **"Reset to default"** button next to
  the backup-folder field that restores the project's own `data/backups` path.

### Fixed
- **`Job Tracker.app` now actually launches on double-click.** Two macOS issues were
  found and fixed: (1) modern macOS (26+) won't launch a `.app` whose executable is a
  shell script, so the app is now built as an ad-hoc-signed AppleScript applet
  (`launcher/mac/build-app.sh`) that hands off to `launch.command`; (2) the applet now
  launches `launch.command` detached so it doesn't hang waiting on the long-lived server.
- The macOS launcher now finds Node even when it's installed in a non-standard
  location (e.g. `~/.local/node`). A double-clicked app doesn't load your shell
  profile, so the launcher explicitly adds the common Node install directories to
  PATH before checking — previously a double-click could silently fail if Node
  wasn't on the default GUI PATH.

### Documentation
- README rewritten for the new layout: a **Quick start** section (Mac/Windows,
  side by side) right under the intro so a new user doesn't have to scroll, with
  the app icon shown and anchor links into the fuller Requirements/desktop-app
  sections below.

## [1.5.0]

Cloud backup & sync, referral tracking, and a documentation pass.

### Added
- **Backups & cloud save** — automatic hourly + on-shutdown snapshots (plus manual),
  written to a configurable folder. Point it at a synced Google Drive / Dropbox /
  iCloud / OneDrive / Box folder for offsite backup with no accounts or keys in the
  app. A new device auto-restores the latest backup on first launch when its
  database is empty; a populated device can manually restore (staged, applied on
  restart, with an automatic safety snapshot first).
- **Settings tab** — backup status, storage-mode detection (local vs. cloud +
  provider), backup history with delete, and all backup configuration.
- **Referral tracking** — mark which jobs came through a referral (and by whom) vs.
  open applications, with badges throughout and a dashboard stat.
- **AI-assisted importing** — paste a job posting or LinkedIn profile and have it
  turned into a fully populated, deduped job/contact record (see `CLAUDE.md`).
- Company logos (via favicon), at-a-glance job/company summaries, a separate
  "application URL" distinct from the posting URL.
- Hover tooltips on truncated text throughout the app.
- "Hide Interested" toggle on the Jobs table and kanban board.
- `npm run scan-documents` — register CV files dropped directly into `data/files/`.
- `ARCHITECTURE.md` — a detailed system/architecture reference for future
  development sessions.

### Changed
- Job import now also backfills company details (website, industry, location,
  description) when creating or matching a company.

## [1.0.0] — Initial release

Core mini-ATS: dashboard, kanban + table job views, companies, contacts
(recruiters / hiring managers / connections), per-job activity timelines,
follow-up reminders, and a CV library with many-to-many job attachments.
Local-only, SQLite-backed, no hosted backend.
