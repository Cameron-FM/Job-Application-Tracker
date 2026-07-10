# Changelog

All notable changes to this project are documented here.

## [1.12.1] — 2026-07-10

Windows launcher fix — the desktop `.exe` now builds and runs correctly.

### Fixed
- **`make_exe.bat` no longer fails to compile on machines with only .NET Framework 3.5.**
  `JobTrackerLauncher.cs` used `Path.Combine`'s 5-argument overload, which only exists in .NET
  4.0+, so it failed with *"no overload for method 'Combine' takes 5 arguments"* when the build
  script fell back to a 3.5 compiler. Rewritten with chained 2-argument `Path.Combine` calls that
  compile against either version.
- Replaced the committed `Job Tracker (Windows).exe` with a fresh build from that fix, now
  **confirmed working end-to-end on a real Windows machine** (compiles cleanly, and double-clicking
  it installs dependencies, starts the server, and opens the browser). Retires the long-standing
  "carefully-written-but-unverified" caveat on the Windows launcher.

## [1.12.0] — 2026-07-09

Standardized tags for jobs, companies, people and documents — a fixed, in-app-managed vocabulary,
not free-form text, applied via multi-select and filterable/searchable everywhere.

### Added
- **Tags** — a small, curated set of labels (e.g. Sales, Solution Engineer, Forward Deployed
  Engineer, AI) that can be multi-selected on any job, company, contact, or document. Unlike every
  other categorical field in the app, the tag vocabulary itself is managed in-app rather than
  hardcoded, via a new **Settings → Tags** tab: add, rename, recolor (from a curated swatch
  palette), and delete (with a confirmation that states how many records will lose the tag).
- A dedicated, auto-saving **Tags card** on each job/company/person detail page (toggle a pill,
  it saves immediately — no separate edit modal needed), plus an inline tag picker on each CV
  Library document card. Tag badges on table rows and kanban cards, and a tag filter dropdown on
  the Jobs/Companies/People/CV Library list pages.
- Global search now matches on tag names too, across jobs, companies, contacts, and documents.
- The job and contact CLI importers (and CLAUDE.md's extraction rules) now accept a `tags` array —
  matched against the existing vocabulary by name; unrecognized names are silently skipped rather
  than inventing a new tag, since the vocabulary is meant to stay centrally managed.

## [1.11.0] — 2026-07-09

Dashboard's "Recent activity" replaced with an "Apply" tile board, capped/scrollable dashboard
cards, and a table-overflow fix.

### Added
- **"Apply" dashboard card** — replaces "Recent activity" with a 4-wide tile grid of every job at
  the "Interested" stage (i.e. not yet applied for): company logo, title, summary, contact count,
  and an "Apply ↗" button that opens the application link (or the posting link, if no separate
  application URL is set) in a new tab without also navigating to the job's detail page.
- **Capped, scrollable dashboard cards** — "Next steps on jobs", "People to follow up with", and the
  new "Apply" board now show a max of 3 rows each; a bouncing chevron indicates more content below,
  and scrolling within the card reveals the rest. Cards with fewer than 3 rows shrink to fit instead
  of reserving empty space. New shared `components/ScrollCapped.jsx`.

### Fixed
- **Jobs table's rightmost columns (e.g. "Due") could be silently clipped** with no way to reach
  them, on narrower viewports — `.card-table` used `overflow: hidden` to clip the table to the
  card's rounded corners, which also hid any overflow instead of making it scrollable. Now scrolls
  horizontally when needed (affects all four data tables: Jobs, Companies, People, Settings' backup
  history).
- The two dashboard cards in `.two-col` were silently stretched to match each other's height (CSS
  Grid's default `align-items: stretch`), which defeated the new shrink-to-fit behavior — fixed with
  `align-items: start`.
- The scroll-more indicator's chevron was visually off-center inside its circle (a Unicode glyph's
  font-metric padding isn't symmetric) — replaced with an inline SVG, which centers exactly.

## [1.10.0] — 2026-07-09

Settings reorganized into Preferences/Backups sub-pages with a proper tab bar and per-section save.

### Changed
- **Settings split into two sub-pages**, `/settings/preferences` and `/settings/backups`, switched via
  tabs (`/settings` redirects to Preferences). Every editable section now has its own Save button that
  only enables once something's actually changed, instead of always being clickable or (for the
  confetti toggle) applying instantly on click. Non-editable sections — status, backup history, the
  Back-up-now/Restore/Delete actions — are unaffected, since those aren't a form with something to
  leave unsaved.
- **Restyled the Preferences/Backups switcher as a real tab bar** (underline + highlight on the active
  tab, full-width bottom border) instead of the generic small-button toggle used elsewhere (e.g. the
  Jobs page's Table/Board switch) — makes it read unambiguously as sub-page navigation rather than an
  action button.

## [1.9.0] — 2026-07-09

Stage list rework (Final Interview, merged Rejected/Withdrawn), stage-change celebrations with a
Settings toggle, and a required reason when marking a job Rejected/Withdrawn.

### Changed
- **Job stages: added "Final Interview", merged "Rejected" and "Withdrawn" into one "Rejected/Withdrawn"
  stage.** Full stage list is now Interested → Applied → Screening → Interviewing → Final Interview →
  Offer → Accepted, plus the terminal Rejected/Withdrawn. Existing jobs with the old `Rejected` or
  `Withdrawn` stage are migrated to `Rejected/Withdrawn` automatically (idempotent, runs on every
  startup — see db.js). Every place that used to hardcode the old 3-stage terminal list or the
  2-stage interview list (jobs/companies/dashboard routes, the stage-celebration trigger) was updated
  to match — see ARCHITECTURE.md gotcha §12.21 for why those aren't single-sourced.

### Added
- **Stage-change celebration** — moving a job from a pre-interview stage (Interested/Applied) into any
  interview stage (Screening, Interviewing, or Final Interview), or into **Accepted** from any stage,
  triggers a brief confetti burst + toast, hand-rolled in CSS (no new dependency). Moving *between*
  interview stages (e.g. Screening → Interviewing) does not re-trigger it. Works from every place a
  job's stage can change — the job detail page's stage dropdown, the kanban board (drag-and-drop), and
  the edit-job modal (used from every page that opens it) — via a shared `celebrateStageChange()`
  trigger (`stageEffects.js`) and a single always-mounted listener component (`StageCelebration.jsx`,
  alongside the global search bar and tooltip).
- **Celebrations toggle** — a "🎉 Celebrate stage changes" checkbox on the Settings page's new
  Preferences card turns the confetti off (on by default). Device-local (`localStorage`), separate
  from the backup config `/api/settings` owns, since it's a pure display preference.
- **Rejection/withdrawal reason required** — moving a job to the **Rejected/Withdrawn** stage, from any
  of the three places a stage can change (§ above), now pops up a small modal requiring a short reason
  (capped at 200 characters) before the change saves; cancelling the modal leaves the job's stage
  untouched. The reason is shown on the job detail page and recorded in its timeline. Enforced
  server-side too (`PATCH /jobs/:id` 400s without one), so the requirement holds regardless of caller.

## [1.8.0] — 2026-07-09

Global search across jobs, companies, people, documents, and activities.

### Added
- **Global search** — a long search bar centered above the page content on every page (not tucked in
  the sidebar) that searches jobs, companies, contacts, documents, and activities at once, ranked by
  relevance. `⌘K`/`Ctrl+K` focuses it from anywhere; arrow keys + Enter navigate results, Escape closes.
  Each result shows its record type as both an icon and a text tag. The dropdown caps at 8 results with
  a "View all N results →" link to a new full **Search results** page (`/search`) with type-filter
  buttons, Relevance/Newest/Name sorting, and a "← Back" button that returns to wherever you came from.
  New `GET /api/search?q=&limit=` endpoint (`routes/search.js`) — plain SQL `LIKE` matching across each
  table's user-recognizable fields with a simple JS relevance score, no new dependency, no full-text
  index.

## [1.7.0] — 2026-07-08

Renamed desktop launchers, a real committed Windows `.exe`, and `launch.bat` tucked out of the root.

### Added
- **A real, committed `Job Tracker (Windows).exe`** — built via `make_exe.bat` on an actual
  Windows machine (previously only written/unverified). It's a thin wrapper that launches
  `app/launcher/windows/launch.bat`, which still holds all the real launcher logic.

### Changed
- **Renamed both desktop launchers for clarity**: `Job Tracker.app` → `Job Tracker (Mac).app`,
  and the project root now also ships `Job Tracker (Windows).exe` as the primary Windows
  double-click target. Updated throughout README, ARCHITECTURE.md, and the launcher build
  scripts (`build-app.sh`/`make_exe.bat` now produce these names by default).
- **Moved `launch.bat` off the project root into `app/launcher/windows/launch.bat`**, so the
  root stays down to just the two double-click launchers, `data/`, and `app/` (it was the
  last stray program file sitting at the root). `launch.bat` now resolves the project root
  from three levels up instead of assuming it *is* the root. `JobTrackerLauncher.cs` (the
  `.exe`'s source) was updated to launch it at its new nested path — **this means the
  previously-built `Job Tracker (Windows).exe` is stale and must be rebuilt** (rerun
  `make_exe.bat` on a real Windows machine) before it will find `launch.bat` again.
  **The committed `.exe` as of this release is still that stale build** — it will be
  replaced with a working rebuild in a follow-up commit.

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
