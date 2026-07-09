const express = require('express');
const { db } = require('../db');
const { STAGES, TERMINAL_STAGES, normalizeDates, buildUpdate, logActivity, resolveCompany, localToday,
  syncTags, getTagsFor, attachTags } = require('../helpers');

const router = express.Router();

const JOB_FIELDS = ['title', 'company_id', 'url', 'application_url', 'location', 'salary_range', 'source', 'stage',
  'applied_date', 'next_step', 'next_step_due', 'summary', 'description', 'raw_posting', 'notes',
  'referred_by_contact_id', 'rejection_reason'];

// Keep in sync with the client's textarea maxLength (RejectionReasonModal.jsx) — this is the
// server-side backstop, so it truncates rather than erroring on an over-long value.
const REJECTION_REASON_MAX = 200;

// Optional company_* fields on a job payload let us flesh out the company when it's
// created (or backfill blanks on an existing one) as part of adding the job.
function companyFieldsFrom(body) {
  return {
    website: body.company_website,
    location: body.company_location,
    industry: body.company_industry,
    summary: body.company_summary,
    description: body.company_description,
  };
}

router.get('/', (req, res) => {
  const clauses = [];
  const params = [];
  if (req.query.stage) { clauses.push('j.stage = ?'); params.push(req.query.stage); }
  if (req.query.company_id) { clauses.push('j.company_id = ?'); params.push(req.query.company_id); }
  if (req.query.active === '1') clauses.push(`j.stage NOT IN ('Accepted','Rejected/Withdrawn')`);
  if (req.query.referred === '1') clauses.push('j.referred_by_contact_id IS NOT NULL');
  if (req.query.referred === '0') clauses.push('j.referred_by_contact_id IS NULL');
  if (req.query.tag_id) { clauses.push('j.id IN (SELECT job_id FROM job_tags WHERE tag_id = ?)'); params.push(req.query.tag_id); }
  if (req.query.q) {
    clauses.push('(j.title LIKE ? OR c.name LIKE ?)');
    params.push(`%${req.query.q}%`, `%${req.query.q}%`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db.prepare(`
    SELECT j.*, c.name AS company_name, c.website AS company_website, ref.name AS referred_by_name,
      (SELECT COUNT(*) FROM job_contacts jc WHERE jc.job_id = j.id) AS contact_count,
      (SELECT COUNT(*) FROM job_documents jd WHERE jd.job_id = j.id) AS document_count
    FROM jobs j JOIN companies c ON c.id = j.company_id
    LEFT JOIN contacts ref ON ref.id = j.referred_by_contact_id
    ${where}
    ORDER BY j.updated_at DESC
  `).all(...params);
  res.json(attachTags(rows, 'job_tags', 'job_id'));
});

router.post('/', (req, res) => {
  const body = normalizeDates(req.body);
  if (!body.title || !body.title.trim()) return res.status(400).json({ error: 'Job title is required' });
  const companyId = resolveCompany({ ...body, company_fields: companyFieldsFrom(body) });
  if (!companyId) return res.status(400).json({ error: 'A company is required' });
  const stage = STAGES.includes(body.stage) ? body.stage : 'Interested';
  const appliedDate = body.applied_date || (stage === 'Applied' ? localToday() : null);
  const info = db.prepare(`
    INSERT INTO jobs (company_id, title, url, application_url, location, salary_range, source, stage,
                      applied_date, next_step, next_step_due, summary, description, raw_posting, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(companyId, body.title.trim(), body.url || '', body.application_url || '', body.location || '',
    body.salary_range || '', body.source || '', stage, appliedDate, body.next_step || '',
    body.next_step_due || null, body.summary || '', body.description || '', body.raw_posting || '',
    body.notes || '');
  if (Array.isArray(body.tags)) syncTags('job_tags', 'job_id', info.lastInsertRowid, body.tags);
  const job = getJob(info.lastInsertRowid);
  logActivity({ job_id: job.id, activity_type: 'other', title: 'Job added', detail: `Added at stage "${stage}"` });
  res.status(201).json(job);
});

function getJob(id) {
  const job = db.prepare(`
    SELECT j.*, c.name AS company_name, c.website AS company_website, ref.name AS referred_by_name
    FROM jobs j
    JOIN companies c ON c.id = j.company_id
    LEFT JOIN contacts ref ON ref.id = j.referred_by_contact_id
    WHERE j.id = ?
  `).get(id);
  if (job) job.tags = getTagsFor('job_tags', 'job_id', job.id);
  return job;
}

router.get('/:id', (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  job.contacts = db.prepare(`
    SELECT ct.*, jc.relationship, co.name AS company_name
    FROM job_contacts jc
    JOIN contacts ct ON ct.id = jc.contact_id
    LEFT JOIN companies co ON co.id = ct.company_id
    WHERE jc.job_id = ? ORDER BY ct.name COLLATE NOCASE
  `).all(job.id);
  job.documents = db.prepare(`
    SELECT d.* FROM job_documents jd JOIN documents d ON d.id = jd.document_id
    WHERE jd.job_id = ? ORDER BY d.uploaded_at DESC
  `).all(job.id);
  job.activities = db.prepare(`
    SELECT a.*, ct.name AS contact_name FROM activities a
    LEFT JOIN contacts ct ON ct.id = a.contact_id
    WHERE a.job_id = ? ORDER BY a.occurred_at DESC, a.id DESC
  `).all(job.id);
  res.json(job);
});

router.patch('/:id', (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  const body = normalizeDates({ ...req.body });

  if (body.company_name !== undefined && body.company_id === undefined) {
    const companyId = resolveCompany({ ...body, company_fields: companyFieldsFrom(body) });
    if (companyId) body.company_id = companyId;
  }
  if (body.stage !== undefined) {
    if (!STAGES.includes(body.stage)) return res.status(400).json({ error: `Unknown stage "${body.stage}"` });
    if (body.stage !== job.stage) {
      // The UI always prompts for a reason before sending this request (RejectionReasonModal) —
      // this is the server-side backstop so the requirement holds regardless of caller.
      if (body.stage === 'Rejected/Withdrawn' && !(body.rejection_reason || '').trim()) {
        return res.status(400).json({ error: 'A reason is required when marking a job as Rejected/Withdrawn' });
      }
      if (body.rejection_reason) body.rejection_reason = body.rejection_reason.trim().slice(0, REJECTION_REASON_MAX);
      logActivity({
        job_id: job.id, activity_type: 'stage_change',
        title: `Moved to ${body.stage}`,
        detail: body.rejection_reason ? `Was ${job.stage} — ${body.rejection_reason}` : `Was ${job.stage}`,
      });
      if (body.stage === 'Applied' && !job.applied_date && body.applied_date === undefined) {
        body.applied_date = localToday();
      }
    }
  }
  if (body.referred_by_contact_id !== undefined && body.referred_by_contact_id !== null) {
    const contact = db.prepare('SELECT id, name FROM contacts WHERE id = ?').get(body.referred_by_contact_id);
    if (!contact) return res.status(400).json({ error: 'That contact does not exist' });
    if (contact.id !== job.referred_by_contact_id) {
      logActivity({ job_id: job.id, contact_id: contact.id, activity_type: 'other', title: `Marked ${contact.name} as referrer` });
    }
  } else if (body.referred_by_contact_id === null && job.referred_by_contact_id) {
    logActivity({ job_id: job.id, activity_type: 'other', title: 'Unmarked referral — now tracked as an open application' });
  }
  const changed = buildUpdate('jobs', job.id, body, JOB_FIELDS);
  if (changed) db.prepare(`UPDATE jobs SET updated_at = datetime('now','localtime') WHERE id = ?`).run(job.id);
  if (Array.isArray(body.tags)) syncTags('job_tags', 'job_id', job.id, body.tags);
  res.json(getJob(job.id));
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM jobs WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// --- contact links ---

router.post('/:id/contacts', (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.body.contact_id);
  if (!contact) return res.status(404).json({ error: 'Contact not found' });
  db.prepare(
    'INSERT OR REPLACE INTO job_contacts (job_id, contact_id, relationship) VALUES (?, ?, ?)'
  ).run(job.id, contact.id, req.body.relationship || '');
  logActivity({
    job_id: job.id, contact_id: contact.id, activity_type: 'other',
    title: `Linked ${contact.name}`, detail: req.body.relationship || '',
  });
  res.status(201).json({ ok: true });
});

router.delete('/:id/contacts/:contactId', (req, res) => {
  db.prepare('DELETE FROM job_contacts WHERE job_id = ? AND contact_id = ?').run(req.params.id, req.params.contactId);
  res.json({ ok: true });
});

// --- document links ---

router.post('/:id/documents', (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.body.document_id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  db.prepare('INSERT OR REPLACE INTO job_documents (job_id, document_id) VALUES (?, ?)').run(job.id, doc.id);
  logActivity({ job_id: job.id, activity_type: 'other', title: `Attached "${doc.label}"` });
  res.status(201).json({ ok: true });
});

router.delete('/:id/documents/:documentId', (req, res) => {
  db.prepare('DELETE FROM job_documents WHERE job_id = ? AND document_id = ?').run(req.params.id, req.params.documentId);
  res.json({ ok: true });
});

module.exports = router;
