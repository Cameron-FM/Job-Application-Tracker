const express = require('express');
const { db } = require('../db');

const router = express.Router();

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 200;

// Relevance: primary field starting with the query ranks highest, then a plain
// contains match on the primary field, then a match that only hit a secondary
// field (company name, location, etc — still fetched by the WHERE clause below).
function scoreMatch(primary, q) {
  const p = (primary || '').toLowerCase();
  if (p.startsWith(q)) return 90;
  if (p.includes(q)) return 70;
  return 40;
}

router.get('/', (req, res) => {
  const q = (req.query.q || '').trim();
  const limit = Math.min(Number(req.query.limit) || DEFAULT_LIMIT, MAX_LIMIT);
  if (q.length < 2) return res.json({ results: [], total: 0 });
  const qLower = q.toLowerCase();
  const like = `%${q}%`;

  const jobs = db.prepare(`
    SELECT j.id, j.title, j.stage, j.updated_at, c.name AS company_name
    FROM jobs j JOIN companies c ON c.id = j.company_id
    WHERE j.title LIKE ? OR c.name LIKE ? OR j.location LIKE ? OR j.summary LIKE ? OR j.next_step LIKE ?
  `).all(like, like, like, like, like);

  const companies = db.prepare(`
    SELECT id, name, industry, location, created_at
    FROM companies
    WHERE name LIKE ? OR industry LIKE ? OR location LIKE ? OR summary LIKE ?
  `).all(like, like, like, like);

  const contacts = db.prepare(`
    SELECT ct.id, ct.name, ct.role_title, ct.created_at, co.name AS company_name
    FROM contacts ct LEFT JOIN companies co ON co.id = ct.company_id
    WHERE ct.name LIKE ? OR ct.role_title LIKE ? OR co.name LIKE ? OR ct.email LIKE ?
  `).all(like, like, like, like);

  const documents = db.prepare(`
    SELECT id, label, doc_type, uploaded_at
    FROM documents
    WHERE label LIKE ? OR filename LIKE ?
  `).all(like, like);

  const activities = db.prepare(`
    SELECT a.id, a.title, a.activity_type, a.occurred_at, a.job_id, a.contact_id,
      j.title AS job_title, ct.name AS contact_name
    FROM activities a
    LEFT JOIN jobs j ON j.id = a.job_id
    LEFT JOIN contacts ct ON ct.id = a.contact_id
    WHERE a.title LIKE ? OR a.detail LIKE ?
  `).all(like, like);

  const results = [
    ...jobs.map((j) => ({
      type: 'job', id: j.id, title: j.title, company_name: j.company_name, stage: j.stage,
      date: j.updated_at, score: scoreMatch(j.title, qLower),
    })),
    ...companies.map((c) => ({
      type: 'company', id: c.id, title: c.name, industry: c.industry, location: c.location,
      date: c.created_at, score: scoreMatch(c.name, qLower),
    })),
    ...contacts.map((ct) => ({
      type: 'contact', id: ct.id, title: ct.name, role_title: ct.role_title, company_name: ct.company_name,
      date: ct.created_at, score: scoreMatch(ct.name, qLower),
    })),
    ...documents.map((d) => ({
      type: 'document', id: d.id, title: d.label, doc_type: d.doc_type,
      date: d.uploaded_at, score: scoreMatch(d.label, qLower),
    })),
    ...activities.map((a) => ({
      type: 'activity', id: a.id, title: a.title, activity_type: a.activity_type,
      job_id: a.job_id, contact_id: a.contact_id, job_title: a.job_title, contact_name: a.contact_name,
      date: a.occurred_at, score: scoreMatch(a.title, qLower),
    })),
  ];

  results.sort((a, b) => b.score - a.score || (b.date || '').localeCompare(a.date || ''));

  res.json({ results: results.slice(0, limit), total: results.length });
});

module.exports = router;
