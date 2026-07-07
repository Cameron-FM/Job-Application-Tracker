# Job Tracker (personal mini-ATS)

A local web app for tracking job applications like a lightweight CRM/ATS: a pipeline
dashboard, a drag-and-drop kanban board, companies, contacts (recruiters / hiring
managers / referrers), follow-up reminders, per-job activity timelines, and a CV
library where one CV can be attached to many jobs.

Everything runs on your machine — there's no backend server to deploy and no account
to sign up for. All data lives in the `data/` folder (a SQLite database plus your
uploaded CV files), so backing it up, syncing it with Dropbox/OneDrive, or moving it
to another machine is just a matter of copying that one folder. `data/` is gitignored,
so none of your actual job-search data ever leaves your machine via this repo.

## Features

- **Dashboard** — active applications, interviews in progress, overdue follow-ups, and
  a merged "what's next" list across jobs and contacts.
- **Jobs** — table and kanban views, with a toggle to hide the "Interested" stage
  (widens the remaining kanban columns, or just filters the table rows).
- **Companies & People** — auto-created from jobs/contacts, with company summaries,
  logos (pulled from each company's real favicon), and a distinction between contacts
  you're speaking to vs. general connections.
- **Referral tracking** — mark which jobs came through a referral (and by whom) vs.
  open applications, with badges and a dashboard stat.
- **CV Library** — upload CVs, attach one to many jobs, or drop files straight into
  `data/files/` and click "Scan" to register them.
- **Hover tooltips** — hovering any truncated text (summaries, next steps, etc.) shows
  the full content in a small card at your cursor.
- **AI-assisted importing** — this repo includes a [CLAUDE.md](CLAUDE.md) contract that
  lets [Claude Code](https://claude.com/claude-code) turn a pasted job posting or
  LinkedIn profile into a fully populated job/contact record, deduping and linking
  automatically. Optional — the app is fully usable without it.

## Requirements

- Node.js 18+ (that's it)

## Run it

```bash
npm install        # first time only (also installs the client)
npm start          # builds the UI and serves the app
```

Then open **http://localhost:3400**.

## Other commands

```bash
npm run dev              # development mode (hot reload) at http://localhost:5173
npm run seed              # load a few sample jobs/companies/contacts to explore with
npm run import            # import a job from JSON (see CLAUDE.md)
npm run import-contact     # import a contact from JSON (see CLAUDE.md)
npm run scan-documents    # register CV files dropped straight into data/files/
```

To start fresh, stop the app and delete the `data/` folder.

## Project structure

```
server/     Express + SQLite backend (server/db.js has the schema)
client/     React + Vite frontend
scripts/    CLI importers used by the app and by Claude Code
data/       SQLite database + uploaded CVs — gitignored, created on first run
```

## Privacy note

This is a personal tool built to track a real job search. The `data/` folder (your
applications, contacts, salary notes, and CV files) is excluded from git via
`.gitignore` and is never committed — only the application code is public.
