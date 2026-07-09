const express = require('express');
const { db } = require('../db');
const { buildUpdate, syncTags, getTagsFor, attachTags } = require('../helpers');

const router = express.Router();

router.get('/', (req, res) => {
  const clauses = [];
  const params = [];
  if (req.query.tag_id) { clauses.push('c.id IN (SELECT company_id FROM company_tags WHERE tag_id = ?)'); params.push(req.query.tag_id); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM jobs j WHERE j.company_id = c.id) AS job_count,
      (SELECT COUNT(*) FROM jobs j WHERE j.company_id = c.id
         AND j.stage NOT IN ('Accepted','Rejected/Withdrawn')) AS active_job_count,
      (SELECT COUNT(*) FROM contacts ct WHERE ct.company_id = c.id) AS contact_count
    FROM companies c
    ${where}
    ORDER BY c.name COLLATE NOCASE
  `).all(...params);
  res.json(attachTags(rows, 'company_tags', 'company_id'));
});

router.post('/', (req, res) => {
  const { name, website = '', location = '', industry = '', summary = '', notes = '', tags } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Company name is required' });
  const existing = db.prepare('SELECT id FROM companies WHERE name = ? COLLATE NOCASE').get(name.trim());
  if (existing) return res.status(409).json({ error: 'A company with that name already exists' });
  const info = db.prepare(
    'INSERT INTO companies (name, website, location, industry, summary, notes) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(name.trim(), website, location, industry, summary, notes);
  if (Array.isArray(tags)) syncTags('company_tags', 'company_id', info.lastInsertRowid, tags);
  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(info.lastInsertRowid);
  company.tags = getTagsFor('company_tags', 'company_id', company.id);
  res.status(201).json(company);
});

router.get('/:id', (req, res) => {
  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id);
  if (!company) return res.status(404).json({ error: 'Company not found' });
  company.tags = getTagsFor('company_tags', 'company_id', company.id);
  company.jobs = db.prepare(`
    SELECT j.*,
      (SELECT COUNT(*) FROM job_contacts jc WHERE jc.job_id = j.id) AS contact_count
    FROM jobs j WHERE j.company_id = ? ORDER BY j.updated_at DESC
  `).all(company.id);
  company.contacts = db.prepare(
    'SELECT * FROM contacts WHERE company_id = ? ORDER BY name COLLATE NOCASE'
  ).all(company.id);
  res.json(company);
});

router.patch('/:id', (req, res) => {
  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id);
  if (!company) return res.status(404).json({ error: 'Company not found' });
  buildUpdate('companies', company.id, req.body, ['name', 'website', 'location', 'industry', 'summary', 'notes']);
  if (Array.isArray(req.body.tags)) syncTags('company_tags', 'company_id', company.id, req.body.tags);
  const updated = db.prepare('SELECT * FROM companies WHERE id = ?').get(company.id);
  updated.tags = getTagsFor('company_tags', 'company_id', company.id);
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM companies WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
