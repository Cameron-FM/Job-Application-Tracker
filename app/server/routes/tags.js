const express = require('express');
const { db } = require('../db');
const { buildUpdate } = require('../helpers');

const router = express.Router();

router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT t.*,
      (SELECT COUNT(*) FROM job_tags jt WHERE jt.tag_id = t.id) AS job_count,
      (SELECT COUNT(*) FROM company_tags ct WHERE ct.tag_id = t.id) AS company_count,
      (SELECT COUNT(*) FROM contact_tags cnt WHERE cnt.tag_id = t.id) AS contact_count,
      (SELECT COUNT(*) FROM document_tags dt WHERE dt.tag_id = t.id) AS document_count
    FROM tags t
    ORDER BY t.name COLLATE NOCASE
  `).all();
  res.json(rows);
});

router.post('/', (req, res) => {
  const { name, color = '#64748b' } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Tag name is required' });
  const existing = db.prepare('SELECT id FROM tags WHERE name = ? COLLATE NOCASE').get(name.trim());
  if (existing) return res.status(409).json({ error: 'A tag with that name already exists' });
  const info = db.prepare('INSERT INTO tags (name, color) VALUES (?, ?)').run(name.trim(), color);
  res.status(201).json(db.prepare('SELECT * FROM tags WHERE id = ?').get(info.lastInsertRowid));
});

router.patch('/:id', (req, res) => {
  const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(req.params.id);
  if (!tag) return res.status(404).json({ error: 'Tag not found' });
  if (req.body.name !== undefined) {
    const dup = db.prepare('SELECT id FROM tags WHERE name = ? COLLATE NOCASE AND id != ?').get(req.body.name.trim(), tag.id);
    if (dup) return res.status(409).json({ error: 'A tag with that name already exists' });
  }
  buildUpdate('tags', tag.id, req.body, ['name', 'color']);
  res.json(db.prepare('SELECT * FROM tags WHERE id = ?').get(tag.id));
});

router.delete('/:id', (req, res) => {
  // Cascades to job_tags/company_tags/contact_tags/document_tags automatically via their FKs.
  db.prepare('DELETE FROM tags WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
