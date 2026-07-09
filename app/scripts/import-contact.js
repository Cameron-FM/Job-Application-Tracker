// Imports a contact (typically from a LinkedIn profile) into the tracker.
//
// Reads a JSON object from a file argument or stdin and:
//   1. Finds an existing contact (by LinkedIn URL, else by name + company) and
//      enriches it, or creates a new one — so you never get duplicates.
//   2. Attaches them to their company, creating the company (with details) if new.
//   3. Links them as a connection to every job you're tracking at that company.
//
// Writes directly to the SQLite database, so it works whether or not the web app
// is running. See CLAUDE.md for the JSON shape and extraction rules Claude follows.
//
// Usage:
//   node scripts/import-contact.js path/to/contact.json
//   cat contact.json | node scripts/import-contact.js
//   node scripts/import-contact.js --update 7 path/to/contact.json
const fs = require('fs');
const { db } = require('../server/db');
const { resolveCompany, logActivity, linkContactToCompanyJobs, syncTags } = require('../server/helpers');

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

if (!data.name || !String(data.name).trim()) {
  console.error('A "name" is required.');
  process.exit(1);
}
const name = String(data.name).trim();
const linkedin = (data.linkedin_url || '').trim();
const relationship = data.relationship || 'Connection';

// Resolve (and enrich/create) the company. May be null for a contact with no company.
const companyId = resolveCompany({
  company_name: data.company_name,
  company_fields: {
    website: data.company_website,
    location: data.company_location,
    industry: data.company_industry,
    summary: data.company_summary,
    description: data.company_description,
  },
});

// --- Find an existing contact so we enrich rather than duplicate ---
let existing = null;
if (updateId) {
  existing = db.prepare('SELECT * FROM contacts WHERE id = ?').get(updateId);
  if (!existing) { console.error(`No contact with id ${updateId}.`); process.exit(1); }
}
if (!existing && linkedin) {
  existing = db.prepare("SELECT * FROM contacts WHERE linkedin_url = ? AND linkedin_url != ''").get(linkedin);
}
if (!existing) {
  // Fall back to name + same company (SQLite `IS` is null-safe, so this also
  // matches a company-less contact when companyId is null).
  existing = db.prepare('SELECT * FROM contacts WHERE name = ? COLLATE NOCASE AND company_id IS ?').get(name, companyId);
}

let contactId;
if (existing) {
  contactId = existing.id;
  // Backfill blank identity fields; never overwrite what's already there.
  const enrich = {};
  const identity = { role_title: data.role_title, contact_type: data.contact_type,
    email: data.email, phone: data.phone, linkedin_url: linkedin, notes: data.notes };
  for (const [k, v] of Object.entries(identity)) {
    if (v && !existing[k]) enrich[k] = String(v).trim();
  }
  if (companyId && !existing.company_id) enrich.company_id = companyId;
  // "Current state" fields apply if explicitly provided.
  if (data.conversation_status) enrich.conversation_status = data.conversation_status;
  if (data.last_contacted !== undefined) enrich.last_contacted = data.last_contacted || null;
  if (data.next_followup_due !== undefined) enrich.next_followup_due = data.next_followup_due || null;

  const keys = Object.keys(enrich);
  if (keys.length) {
    db.prepare(`UPDATE contacts SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`)
      .run(...keys.map((k) => enrich[k]), contactId);
  }
  logActivity({ contact_id: contactId, activity_type: 'note', title: 'Updated from LinkedIn profile' });
  console.log(`Enriched existing contact #${contactId}: ${name}`);
} else {
  const info = db.prepare(`
    INSERT INTO contacts (name, company_id, role_title, contact_type, email, phone, linkedin_url,
                          conversation_status, last_contacted, next_followup_due, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, companyId, data.role_title || '', data.contact_type || 'connection',
    data.email || '', data.phone || '', linkedin,
    data.conversation_status || 'not_contacted', data.last_contacted || null,
    data.next_followup_due || null, data.notes || '');
  contactId = info.lastInsertRowid;
  logActivity({ contact_id: contactId, activity_type: 'note', title: 'Added from LinkedIn profile' });
  console.log(`Added contact #${contactId}: ${name}${data.company_name ? ` @ ${data.company_name}` : ''}`);
}

// Resolve tag NAMES against the current vocabulary; unknown names are silently skipped
// (see import-job.js for why — same reasoning applies here).
if (Array.isArray(data.tags)) {
  const tagIds = data.tags
    .map((n) => db.prepare('SELECT id FROM tags WHERE name = ? COLLATE NOCASE').get(String(n).trim()))
    .filter(Boolean)
    .map((t) => t.id);
  syncTags('contact_tags', 'contact_id', contactId, tagIds);
}

// --- Link as a connection to every job at their company ---
const linked = linkContactToCompanyJobs(contactId, companyId, relationship);
for (const job of linked) {
  logActivity({ job_id: job.id, contact_id: contactId, activity_type: 'other', title: `Linked ${name}`, detail: relationship });
}
if (companyId) {
  if (linked.length) console.log(`Linked to ${linked.length} job(s) at that company: ${linked.map((j) => j.title).join(', ')}`);
  else console.log('No new jobs to link at that company (already linked, or none tracked yet).');
}
console.log(`Open them at  http://localhost:3400/people/${contactId}`);
