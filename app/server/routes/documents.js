const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');
const { db, FILES_DIR } = require('../db');
const { buildUpdate, scanForNewDocuments } = require('../helpers');

const router = express.Router();

const storage = multer.diskStorage({
  destination: FILES_DIR,
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^\w.\- ]+/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 25 * 1024 * 1024 } });

router.get('/', (req, res) => {
  const docs = db.prepare('SELECT * FROM documents ORDER BY uploaded_at DESC').all();
  const links = db.prepare(`
    SELECT jd.document_id, j.id AS job_id, j.title, j.stage, c.name AS company_name
    FROM job_documents jd
    JOIN jobs j ON j.id = jd.job_id
    JOIN companies c ON c.id = j.company_id
  `).all();
  for (const doc of docs) {
    doc.jobs = links.filter((l) => l.document_id === doc.id);
  }
  res.json(docs);
});

router.post('/', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const label = (req.body.label || '').trim() || req.file.originalname;
  const docType = req.body.doc_type || 'cv';
  const info = db.prepare(
    'INSERT INTO documents (label, doc_type, filename, stored_path) VALUES (?, ?, ?, ?)'
  ).run(label, docType, req.file.originalname, req.file.path);
  res.status(201).json(db.prepare('SELECT * FROM documents WHERE id = ?').get(info.lastInsertRowid));
});

// Picks up files dropped straight into data/files/ (outside the app) and
// registers them so they appear in the CV Library.
router.post('/scan', (req, res) => {
  const added = scanForNewDocuments();
  res.json({ added });
});

router.get('/:id/file', (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  if (!fs.existsSync(doc.stored_path)) return res.status(410).json({ error: 'File missing from disk' });
  if (req.query.download === '1') return res.download(doc.stored_path, doc.filename);
  // Inline so PDFs preview in the browser.
  res.setHeader('Content-Disposition', `inline; filename="${doc.filename.replace(/"/g, '')}"`);
  res.sendFile(path.resolve(doc.stored_path));
});

router.patch('/:id', (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  buildUpdate('documents', doc.id, req.body, ['label', 'doc_type']);
  res.json(db.prepare('SELECT * FROM documents WHERE id = ?').get(doc.id));
});

router.delete('/:id', (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (doc) {
    try { fs.unlinkSync(doc.stored_path); } catch { /* file already gone */ }
    db.prepare('DELETE FROM documents WHERE id = ?').run(doc.id);
  }
  res.json({ ok: true });
});

module.exports = router;
