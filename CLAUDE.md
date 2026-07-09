# Job Tracker — project guide for Claude

A personal, locally-run job-application tracker (mini-ATS). Node/Express + SQLite
backend in `app/server/`, React/Vite client in `app/client/`. All data lives in `data/`
(the `ats.db` SQLite file + uploaded CV files). Node.js is installed at
`~/.local/node`; if `npm` isn't found, prefix commands with
`export PATH="$HOME/.local/node/bin:$PATH" && …`.

## Read this first: [app/ARCHITECTURE.md](app/ARCHITECTURE.md) — the system bible

Before making non-trivial changes (schema, routes, pages, startup/backup logic),
**read [app/ARCHITECTURE.md](app/ARCHITECTURE.md)**. It documents how everything is built, the
data model, the module dependency rules, the backup/restore startup sequence, and a list
of gotchas that will cause bugs if you don't know them (WAL's 3 files, the circular-dep
rule, "adding a column takes two edits," absolute document paths, enums living in two
places, port 3400 being single-occupancy, etc.). **Keep it up to date:** when you change
any of those things, update ARCHITECTURE.md in the same change. This file (CLAUDE.md)
covers the import contracts below; ARCHITECTURE.md covers how the system works.

## Ask for missing inputs — don't guess, and don't leave gaps silently

When adding or updating a job or contact, some fields simply aren't in the source
material (a posting, a LinkedIn profile, a URL) and have to come from the user.
**Ask for them in chat instead of leaving them blank or inventing a plausible
value.** A short list of clarifying questions before you run the import is much
better than a half-filled record the user has to notice and fix later.

Ask about things like:
- **Referral status** — was this application through a referral, or applied openly? If referred, who? (They must already be a tracked contact — if not, ask whether to add them as a person first, then link the referral.) This maps to `referred_by_contact_name` below.
- **Stage / whether they've already applied** — "Interested" vs "Applied" changes what `applied_date` should be; don't assume either way if it's not stated.
- **Reason, if the job is already rejected or withdrawn** — if the user says to add a job (or update one) straight to the `Rejected/Withdrawn` stage, ask why (or note it if they already said, e.g. "didn't hear back," "went with another candidate," "pulled out — accepted elsewhere"). This maps to `rejection_reason` below; the in-app UI requires this reason when moving a job to this stage interactively, so don't leave it blank here either.
- **Next step and deadline** — if the user mentions a plan ("I'll apply this week", "interview Thursday") but doesn't give an exact date, ask for it rather than guessing or omitting `next_step_due`.
- **Salary**, if the posting hides it (e.g. "competitive") but the user might know from a recruiter call.
- **Which CV** they want attached, if they have more than one in the CV Library and don't specify.
- Anything the user's phrasing implies exists but didn't actually include — e.g. "add this job, I already applied" without a date, or "add Jamie as a contact for this role" without saying how Jamie relates to it (recruiter? referrer? interviewer?).

Do **not** ask about fields that are:
- Genuinely derivable from the source (title, company, location, description, etc.) — extract those yourself, don't ask to confirm them.
- Optional and simply not present for this job/person (e.g. no salary published and nothing suggests the user knows it, no LinkedIn URL given) — leave blank, that's normal.
- Already answered elsewhere in the conversation.

Batch the questions into one message rather than a back-and-forth per field, and go
ahead and run the import once you have what you need — don't ask for confirmation
of the obvious stuff too.

## Importing a job from a pasted posting  ← main thing to know

When the user pastes a job description / posting (or gives a URL and asks you to
add it), turn it into a tracked job by extracting the fields below and running the
importer. **Do not make the user fill anything in — read it from the posting.**

### Steps
1. Read the posting the user provides. If they give only a URL, fetch it (WebFetch).
2. Extract the fields into a JSON object using the rules below.
3. Write the JSON to a temp file, then run:
   ```
   cd app && npm run import -- /path/to/job.json
   ```
   (or pipe it: `echo '<json>' | npm run import`).
   To update an existing job instead of creating one, use
   `cd app && npm run import -- --update <jobId> /path/to/job.json`.
4. Report back the job it created/updated and the link it prints.

### JSON shape
```json
{
  "title": "Senior Product Manager",
  "company_name": "Acme Corp",
  "company_summary": "Fintech building B2B payment infrastructure.",
  "company_description": "Longer paragraph on what the company does, its product, and market — if the posting reveals it.",
  "company_website": "https://acme.example.com",
  "company_industry": "Fintech",
  "company_location": "London, UK",
  "location": "London (hybrid)",
  "salary_range": "£85–95k",
  "source": "LinkedIn",
  "url": "https://…/the-posting",
  "application_url": "https://…/apply",
  "summary": "Own the payments product line; lead a squad of 6.",
  "description": "Key responsibilities and requirements, cleaned up as short bullet points or paragraphs.",
  "raw_posting": "The full original posting text, verbatim.",
  "stage": "Interested",
  "next_step": "Tailor CV and apply",
  "next_step_due": "2026-07-14",
  "referred_by_contact_name": "Jamie Chen"
}
```

### Extraction rules
- **title** and **company_name** are required. Everything else is best-effort — omit a field (or use `""`) if the posting doesn't say.
- **summary**: one line, ≤ ~140 chars — what the role *is*, for the dashboard/kanban at-a-glance view. Write it yourself from the posting; don't just copy the first sentence.
- **company_\* fields** (`company_summary`, `company_description`, `company_website`, `company_industry`, `company_location`): fill in whatever the posting reveals about the company. If the company is already tracked, these only backfill blank fields — they never overwrite what the user already wrote. If it's new, they create a proper company record instead of a bare name. `company_summary` is the one-line "what they do"; `company_description` is a fuller paragraph.
- **description**: the meaty detail (responsibilities, requirements), tidied into readable bullets/paragraphs. This shows on the job detail page.
- **raw_posting**: the original text, unedited, so nothing is lost.
- **url** = where the posting lives. **application_url** = where you actually apply, if different (often the "Apply" button link). Leave blank if unknown.
- **salary_range**: keep the posting's own wording (e.g. "£85–95k", "$120k–140k + equity").
- **stage**: default `"Interested"`. Only use `"Applied"` if the user says they've already applied. Valid stages: Interested, Applied, Screening, Interviewing, Final Interview, Offer, Accepted, Rejected/Withdrawn.
- **next_step / next_step_due**: set only if the user states a plan/deadline. Dates are `YYYY-MM-DD`.
- **rejection_reason**: only relevant when `stage` is `"Rejected/Withdrawn"`. Ask for it if not already
  stated — see "Ask for missing inputs" above. Leave blank for every other stage.
- **referred_by_contact_name** (or `referred_by_contact_id`): set this whenever the user says they were referred, put you in touch with someone there, or names someone who works there in the context of this application. **Ask if it's not clear whether this was a referral or an open/cold application** — see "Ask for missing inputs" above; don't leave it ambiguous. The name must match an existing contact (by name, preferred within the same company) — if the referrer isn't tracked yet, add them as a contact first (see the contact importer below), then set this field. The importer auto-links them to this specific job as "Referrer" and the app shows a "Referred by X" badge on the job everywhere; jobs without this set show as "Open application."
- If the company already exists (case-insensitive name match), the job is attached to it; otherwise it's created automatically.

## Importing a contact from a LinkedIn profile  ← the other main thing

When the user pastes a LinkedIn profile (or its text / a URL) and asks to add the
person, turn it into a tracked contact. This dedupes, enriches the company, and
links the person to jobs automatically — don't make the user do that by hand.

### Steps
1. Read the profile the user provides (fetch the URL with WebFetch if that's all they gave — but LinkedIn often blocks scraping, so if the fetch fails, ask them to paste the profile text).
2. Extract the fields below into JSON.
3. Write it to a temp file and run:
   ```
   cd app && npm run import-contact -- /path/to/contact.json
   ```
   (or pipe it). To enrich a specific existing person, use
   `cd app && npm run import-contact -- --update <contactId> /path/to/contact.json`.
4. Report who it created/enriched and which jobs it linked them to.

### JSON shape
```json
{
  "name": "Priya Patel",
  "linkedin_url": "https://linkedin.com/in/priyapatel",
  "company_name": "Nimbus Labs",
  "company_summary": "Developer platform for deploying cloud apps.",
  "role_title": "Talent Acquisition Partner",
  "contact_type": "recruiter",
  "email": "",
  "phone": "",
  "conversation_status": "not_contacted",
  "notes": "Based in Manchester. We share 2 mutual connections.",
  "relationship": "Connection"
}
```

### What the importer does automatically (so you don't have to)
- **Dedupe**: it looks for an existing contact by `linkedin_url` first, then by name + company. If found, it *enriches* that person (fills blank fields, sets their company if it was missing) instead of creating a duplicate.
- **Company**: resolves `company_name` to a company, creating it (with any `company_*` details you provide) if it doesn't exist — same rules as the job importer.
- **Linking**: attaches the person as a connection to **every job currently tracked at that company**, using `relationship` (default `"Connection"`). It won't overwrite a more specific existing link like "Recruiter for this role".

### Extraction rules
- **name** is required. Everything else is best-effort.
- **contact_type**: one of `recruiter`, `hiring_manager`, `connection`, `other`. Default to `connection` for a general LinkedIn contact; use `recruiter`/`hiring_manager` when the role clearly says so.
- **linkedin_url**: include it whenever you have it — it's what prevents duplicates.
- **company_name**: the person's current employer. Pull `company_*` details from the profile if visible.
- **conversation_status**: one of `not_contacted`, `reached_out`, `in_conversation`, `awaiting_reply`, `follow_up_needed`, `dormant`. Default `not_contacted` unless the user says they've already spoken.
- **relationship**: how they relate to jobs at that company (e.g. `"Connection"`, `"Referral"`, `"Ex-colleague"`).

## Registering CV files dropped straight into data/files/
If the user has added file(s) directly to `data/files/` (outside the app — e.g. via
Finder) and wants them to show up in the CV Library, don't hand-write a document
row. Run:
```
cd app && npm run scan-documents
```
It registers any file in `data/files/` that has no matching `documents` row yet
(skips ones already known), guesses a doc type from the filename (`cv`, `cover_letter`,
or `other`), and derives a readable label. Safe to run repeatedly. There's also an
in-app "Scan data/files folder" button on the CV Library page that does the same thing.

## Other commands
- `cd app && npm run dev` — dev mode (Vite on 5173 + API on 3400).
- `cd app && npm start` — build client and serve the whole app on http://localhost:3400.
- `cd app && npm run seed` — load sample data (refuses if the DB already has data).

## Conventions
- Backend is CommonJS (`require`). Client is ESM + React. Keep the hand-rolled CSS
  in `app/client/src/styles.css`; no UI framework.
- Reuse helpers in `app/server/helpers.js` (`resolveCompany`, `logActivity`, date
  handling) rather than re-implementing them.
