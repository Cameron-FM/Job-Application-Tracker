const fs = require('fs');
const path = require('path');
const { db, FILES_DIR } = require('./db');

const STAGES = ['Interested', 'Applied', 'Screening', 'Interviewing', 'Final Interview', 'Offer', 'Accepted', 'Rejected/Withdrawn'];
const TERMINAL_STAGES = ['Accepted', 'Rejected/Withdrawn'];

// Date-only fields where an empty string from a form means "no date".
const DATE_FIELDS = ['applied_date', 'next_step_due', 'last_contacted', 'next_followup_due'];

function normalizeDates(body) {
  for (const key of DATE_FIELDS) {
    if (body[key] === '') body[key] = null;
  }
  return body;
}

// Applies a partial update from `body`, restricted to `allowed` columns.
function buildUpdate(table, id, body, allowed) {
  const keys = allowed.filter((k) => body[k] !== undefined);
  if (!keys.length) return false;
  const sets = keys.map((k) => `${k} = ?`).join(', ');
  db.prepare(`UPDATE ${table} SET ${sets} WHERE id = ?`).run(...keys.map((k) => body[k]), id);
  return true;
}

function logActivity({ job_id = null, contact_id = null, activity_type = 'note', title, detail = '', occurred_at = null }) {
  db.prepare(
    `INSERT INTO activities (job_id, contact_id, activity_type, title, detail, occurred_at)
     VALUES (?, ?, ?, ?, ?, COALESCE(?, datetime('now','localtime')))`
  ).run(job_id, contact_id, activity_type, title, detail, occurred_at || null);
}

const COMPANY_DETAIL_FIELDS = ['website', 'location', 'industry', 'summary', 'description'];

// Accepts either a company_id or a free-typed company_name (created if new).
// `company_fields` optionally carries website/location/industry/summary/description:
// on create they populate the new record; on an existing company they backfill
// only the fields that are still blank (never clobbering what you've written).
function resolveCompany({ company_id, company_name, company_fields = {} }) {
  if (company_id) return Number(company_id);
  const name = (company_name || '').trim();
  if (!name) return null;

  const clean = {};
  for (const key of COMPANY_DETAIL_FIELDS) {
    const val = (company_fields[key] || '').toString().trim();
    if (val) clean[key] = val;
  }

  const existing = db.prepare('SELECT * FROM companies WHERE name = ? COLLATE NOCASE').get(name);
  if (existing) {
    const backfill = Object.keys(clean).filter((k) => !existing[k]);
    if (backfill.length) {
      const sets = backfill.map((k) => `${k} = ?`).join(', ');
      db.prepare(`UPDATE companies SET ${sets} WHERE id = ?`).run(...backfill.map((k) => clean[k]), existing.id);
    }
    return existing.id;
  }

  const cols = ['name', ...Object.keys(clean)];
  const vals = [name, ...Object.keys(clean).map((k) => clean[k])];
  return db.prepare(
    `INSERT INTO companies (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`
  ).run(...vals).lastInsertRowid;
}

// Links a contact to every job tracked at a company (used when adding a connection).
// Won't overwrite an existing, more specific link (e.g. "Recruiter for this role").
// Returns the jobs that were newly linked.
function linkContactToCompanyJobs(contactId, companyId, relationship = 'Connection') {
  if (!companyId) return [];
  const jobs = db.prepare('SELECT id, title FROM jobs WHERE company_id = ?').all(companyId);
  const insert = db.prepare('INSERT OR IGNORE INTO job_contacts (job_id, contact_id, relationship) VALUES (?, ?, ?)');
  const linked = [];
  for (const job of jobs) {
    if (insert.run(job.id, contactId, relationship).changes) linked.push(job);
  }
  return linked;
}

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Guesses a doc_type from a filename so files dropped straight into data/files/
// are sensibly categorized without the user having to set it by hand.
function guessDocType(filename) {
  const n = filename.toLowerCase();
  if (n.includes('cover')) return 'cover_letter';
  if (n.includes('cv') || n.includes('resume') || n.includes('résumé')) return 'cv';
  return 'other';
}

// Turns "Jane_Doe_CV_2026_Account-Exec.pdf" into "Jane Doe CV 2026 Account Exec"
// as a friendlier default label than the raw filename.
function labelFromFilename(filename) {
  return filename.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
}

// Finds files sitting in data/files/ that have no matching `documents` row —
// i.e. dropped in directly rather than uploaded through the app — and creates
// records for them so they show up in the CV Library. Returns the newly added rows.
function scanForNewDocuments() {
  const known = new Set(
    db.prepare('SELECT stored_path FROM documents').all().map((d) => path.resolve(d.stored_path))
  );
  const entries = fs.existsSync(FILES_DIR) ? fs.readdirSync(FILES_DIR) : [];
  const insert = db.prepare('INSERT INTO documents (label, doc_type, filename, stored_path) VALUES (?, ?, ?, ?)');
  const added = [];

  for (const filename of entries) {
    if (filename.startsWith('.')) continue; // skip .DS_Store etc.
    const fullPath = path.resolve(path.join(FILES_DIR, filename));
    if (!fs.statSync(fullPath).isFile()) continue;
    if (known.has(fullPath)) continue;

    const info = insert.run(labelFromFilename(filename), guessDocType(filename), filename, fullPath);
    added.push(db.prepare('SELECT * FROM documents WHERE id = ?').get(info.lastInsertRowid));
  }
  return added;
}

module.exports = {
  STAGES, TERMINAL_STAGES, normalizeDates, buildUpdate, logActivity,
  resolveCompany, linkContactToCompanyJobs, localToday, scanForNewDocuments,
};
