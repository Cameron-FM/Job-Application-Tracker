const express = require('express');
const { db } = require('../db');
const { normalizeDates, buildUpdate, logActivity, resolveCompany, linkContactToCompanyJobs,
  syncTags, getTagsFor, attachTags } = require('../helpers');

const router = express.Router();

const CONTACT_FIELDS = ['name', 'company_id', 'role_title', 'contact_type', 'email', 'phone',
  'linkedin_url', 'conversation_status', 'last_contacted', 'next_followup_due', 'notes'];

const STATUS_LABELS = {
  not_contacted: 'Not contacted', reached_out: 'Reached out', in_conversation: 'In conversation',
  awaiting_reply: 'Awaiting reply', follow_up_needed: 'Follow-up needed', dormant: 'Dormant',
};

router.get('/', (req, res) => {
  const clauses = [];
  const params = [];
  if (req.query.contact_type) { clauses.push('ct.contact_type = ?'); params.push(req.query.contact_type); }
  if (req.query.conversation_status) { clauses.push('ct.conversation_status = ?'); params.push(req.query.conversation_status); }
  if (req.query.company_id) { clauses.push('ct.company_id = ?'); params.push(req.query.company_id); }
  if (req.query.tag_id) { clauses.push('ct.id IN (SELECT contact_id FROM contact_tags WHERE tag_id = ?)'); params.push(req.query.tag_id); }
  if (req.query.q) {
    clauses.push('(ct.name LIKE ? OR ct.role_title LIKE ? OR co.name LIKE ?)');
    params.push(`%${req.query.q}%`, `%${req.query.q}%`, `%${req.query.q}%`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db.prepare(`
    SELECT ct.*, co.name AS company_name, co.website AS company_website,
      (SELECT COUNT(*) FROM job_contacts jc WHERE jc.contact_id = ct.id) AS job_count
    FROM contacts ct LEFT JOIN companies co ON co.id = ct.company_id
    ${where}
    ORDER BY ct.name COLLATE NOCASE
  `).all(...params);
  res.json(attachTags(rows, 'contact_tags', 'contact_id'));
});

router.post('/', (req, res) => {
  const body = normalizeDates(req.body);
  if (!body.name || !body.name.trim()) return res.status(400).json({ error: 'Contact name is required' });
  // company may be null — connections without a tracked company are fine
  const companyId = resolveCompany({
    ...body,
    company_fields: {
      website: body.company_website, location: body.company_location,
      industry: body.company_industry, summary: body.company_summary, description: body.company_description,
    },
  });
  const info = db.prepare(`
    INSERT INTO contacts (name, company_id, role_title, contact_type, email, phone, linkedin_url,
                          conversation_status, last_contacted, next_followup_due, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(body.name.trim(), companyId, body.role_title || '', body.contact_type || 'recruiter',
    body.email || '', body.phone || '', body.linkedin_url || '',
    body.conversation_status || 'not_contacted', body.last_contacted || null,
    body.next_followup_due || null, body.notes || '');
  const contactId = info.lastInsertRowid;
  if (Array.isArray(body.tags)) syncTags('contact_tags', 'contact_id', contactId, body.tags);

  // Optionally attach this person as a connection to every job at their company.
  if (body.link_company_jobs && companyId) {
    const relationship = body.relationship || 'Connection';
    const linked = linkContactToCompanyJobs(contactId, companyId, relationship);
    for (const job of linked) {
      logActivity({ job_id: job.id, contact_id: contactId, activity_type: 'other', title: `Linked ${body.name.trim()}`, detail: relationship });
    }
  }
  res.status(201).json(getContact(contactId));
});

function getContact(id) {
  const contact = db.prepare(`
    SELECT ct.*, co.name AS company_name, co.website AS company_website FROM contacts ct
    LEFT JOIN companies co ON co.id = ct.company_id WHERE ct.id = ?
  `).get(id);
  if (contact) contact.tags = getTagsFor('contact_tags', 'contact_id', contact.id);
  return contact;
}

router.get('/:id', (req, res) => {
  const contact = getContact(req.params.id);
  if (!contact) return res.status(404).json({ error: 'Contact not found' });
  contact.jobs = db.prepare(`
    SELECT j.id, j.title, j.stage, j.next_step, j.next_step_due, jc.relationship, c.name AS company_name,
      (j.referred_by_contact_id = ?) AS is_referrer
    FROM job_contacts jc
    JOIN jobs j ON j.id = jc.job_id
    JOIN companies c ON c.id = j.company_id
    WHERE jc.contact_id = ? ORDER BY j.updated_at DESC
  `).all(contact.id, contact.id);
  contact.activities = db.prepare(`
    SELECT a.*, j.title AS job_title FROM activities a
    LEFT JOIN jobs j ON j.id = a.job_id
    WHERE a.contact_id = ? ORDER BY a.occurred_at DESC, a.id DESC
  `).all(contact.id);
  res.json(contact);
});

router.patch('/:id', (req, res) => {
  const contact = getContact(req.params.id);
  if (!contact) return res.status(404).json({ error: 'Contact not found' });
  const body = normalizeDates({ ...req.body });
  if (body.company_name !== undefined && body.company_id === undefined) {
    body.company_id = resolveCompany(body);
  }
  if (body.conversation_status !== undefined && body.conversation_status !== contact.conversation_status) {
    logActivity({
      contact_id: contact.id, activity_type: 'status_change',
      title: `Status → ${STATUS_LABELS[body.conversation_status] || body.conversation_status}`,
    });
  }
  buildUpdate('contacts', contact.id, body, CONTACT_FIELDS);
  if (Array.isArray(body.tags)) syncTags('contact_tags', 'contact_id', contact.id, body.tags);
  res.json(getContact(contact.id));
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM contacts WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
