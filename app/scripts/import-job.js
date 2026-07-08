// Imports a job from structured JSON into the tracker's database.
//
// Reads a JSON object from a file argument or stdin and creates a new job
// (or updates an existing one with --update <id>). Writes directly to the
// SQLite database, so it works whether or not the web app is running.
//
// Usage:
//   node scripts/import-job.js path/to/job.json
//   cat job.json | node scripts/import-job.js
//   node scripts/import-job.js --update 12 path/to/job.json
//
// See CLAUDE.md for the JSON shape and the extraction rules Claude follows.
const fs = require('fs');
const { db } = require('../server/db');
const { STAGES, resolveCompany, logActivity, localToday } = require('../server/helpers');

const args = process.argv.slice(2);
let updateId = null;
const files = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--update') updateId = Number(args[++i]);
  else files.push(args[i]);
}

let raw;
try {
  raw = files[0] ? fs.readFileSync(files[0], 'utf8') : fs.readFileSync(0, 'utf8');
} catch (e) {
  console.error('Could not read input:', e.message);
  process.exit(1);
}

let data;
try {
  data = JSON.parse(raw);
} catch (e) {
  console.error('Input is not valid JSON:', e.message);
  process.exit(1);
}

// title and company_name are only required when creating a new job — an
// --update only needs to carry the fields it's actually changing.
if (!updateId && (!data.title || !String(data.title).trim())) {
  console.error('A "title" is required.');
  process.exit(1);
}
if (!updateId && !data.company_name) {
  console.error('A "company_name" is required.');
  process.exit(1);
}

const stage = STAGES.includes(data.stage) ? data.stage : 'Interested';

// Resolve the company only if one was actually provided: create it (with
// details) if new, or backfill blanks if it already exists. resolveCompany
// never overwrites fields you've already filled in.
let companyId = null;
if (data.company_name) {
  companyId = resolveCompany({
    company_name: data.company_name,
    company_fields: {
      website: data.company_website,
      location: data.company_location,
      industry: data.company_industry,
      summary: data.company_summary,
      description: data.company_description,
    },
  });
}

// Resolve who referred you, if anyone. Prefers an explicit id; otherwise looks
// up an existing contact by name (matched within the job's company first, then
// globally). Doesn't create a new contact here — add them as a person first.
let referredByContactId = null;
if (data.referred_by_contact_id) {
  referredByContactId = Number(data.referred_by_contact_id);
} else if (data.referred_by_contact_name) {
  const name = data.referred_by_contact_name.trim();
  const byCompany = companyId
    ? db.prepare('SELECT id FROM contacts WHERE name = ? COLLATE NOCASE AND company_id = ?').get(name, companyId)
    : null;
  const anywhere = byCompany || db.prepare('SELECT id FROM contacts WHERE name = ? COLLATE NOCASE').get(name);
  if (anywhere) {
    referredByContactId = anywhere.id;
  } else {
    console.warn(`Note: no existing contact named "${name}" found — add them as a person first, then re-run with --update to link the referral.`);
  }
}

const fields = {
  company_id: companyId,
  title: data.title !== undefined ? String(data.title).trim() : undefined,
  url: data.url || '',
  application_url: data.application_url || '',
  location: data.location || '',
  salary_range: data.salary_range || '',
  source: data.source || '',
  stage,
  applied_date: data.applied_date || (stage === 'Applied' ? localToday() : null),
  next_step: data.next_step || '',
  next_step_due: data.next_step_due || null,
  summary: data.summary || '',
  description: data.description || '',
  raw_posting: data.raw_posting || '',
  notes: data.notes || '',
  referred_by_contact_id: referredByContactId,
};

// Links the referrer to this specific job so they show up under "People" too.
function linkReferrer(jobId) {
  if (!referredByContactId) return;
  db.prepare(
    'INSERT OR IGNORE INTO job_contacts (job_id, contact_id, relationship) VALUES (?, ?, ?)'
  ).run(jobId, referredByContactId, 'Referrer');
}

if (updateId) {
  const existing = db.prepare('SELECT id, title FROM jobs WHERE id = ?').get(updateId);
  if (!existing) {
    console.error(`No job with id ${updateId} to update.`);
    process.exit(1);
  }
  // On update, only overwrite fields the payload actually provided.
  const provided = Object.keys(fields).filter((k) => {
    if (k === 'company_id') return data.company_name !== undefined;
    if (k === 'applied_date' || k === 'next_step_due') return data[k] !== undefined;
    if (k === 'referred_by_contact_id') return data.referred_by_contact_id !== undefined || data.referred_by_contact_name !== undefined;
    return data[k] !== undefined && data[k] !== '';
  });
  if (!provided.length) {
    console.error('Nothing to update — the payload had no recognized fields set.');
    process.exit(1);
  }
  const sets = provided.map((k) => `${k} = ?`).join(', ');
  db.prepare(`UPDATE jobs SET ${sets}, updated_at = datetime('now','localtime') WHERE id = ?`)
    .run(...provided.map((k) => fields[k]), updateId);
  linkReferrer(updateId);
  logActivity({ job_id: updateId, activity_type: 'other', title: 'Updated from job posting' });
  console.log(`Updated job #${updateId}: ${fields.title || existing.title}`);
  if (referredByContactId) console.log(`Marked as a referral.`);
  console.log(`Open it at  http://localhost:3400/jobs/${updateId}`);
} else {
  const cols = Object.keys(fields);
  const info = db.prepare(
    `INSERT INTO jobs (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`
  ).run(...cols.map((k) => fields[k]));
  const id = info.lastInsertRowid;
  linkReferrer(id);
  logActivity({ job_id: id, activity_type: 'other', title: 'Imported from job posting', detail: `Added at stage "${stage}"` });
  console.log(`Imported job #${id}: ${fields.title} @ ${data.company_name}`);
  if (referredByContactId) console.log(`Marked as a referral.`);
  console.log(`Open it at  http://localhost:3400/jobs/${id}`);
}
