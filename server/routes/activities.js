const express = require('express');
const { db } = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const clauses = [];
  const params = [];
  if (req.query.job_id) { clauses.push('a.job_id = ?'); params.push(req.query.job_id); }
  if (req.query.contact_id) { clauses.push('a.contact_id = ?'); params.push(req.query.contact_id); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const limit = Math.min(Number(req.query.limit) || 200, 500);
  const rows = db.prepare(`
    SELECT a.*, j.title AS job_title, c.name AS company_name, ct.name AS contact_name
    FROM activities a
    LEFT JOIN jobs j ON j.id = a.job_id
    LEFT JOIN companies c ON c.id = j.company_id
    LEFT JOIN contacts ct ON ct.id = a.contact_id
    ${where}
    ORDER BY a.occurred_at DESC, a.id DESC
    LIMIT ?
  `).all(...params, limit);
  res.json(rows);
});

router.post('/', (req, res) => {
  const { job_id = null, contact_id = null, activity_type = 'note', title, detail = '', occurred_at = null } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: 'A title is required' });
  const info = db.prepare(`
    INSERT INTO activities (job_id, contact_id, activity_type, title, detail, occurred_at)
    VALUES (?, ?, ?, ?, ?, COALESCE(?, datetime('now','localtime')))
  `).run(job_id, contact_id, activity_type, title.trim(), detail, occurred_at || null);
  res.status(201).json(db.prepare('SELECT * FROM activities WHERE id = ?').get(info.lastInsertRowid));
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM activities WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
