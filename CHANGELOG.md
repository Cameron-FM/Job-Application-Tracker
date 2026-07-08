# Changelog

All notable changes to this project are documented here.

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
