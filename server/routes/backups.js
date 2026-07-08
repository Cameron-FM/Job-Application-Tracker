const express = require('express');
const backup = require('../backup');
const { saveConfig } = require('../config');

// Mounted at /api — defines /api/settings and /api/backups* explicitly.
const router = express.Router();

// --- settings + status (everything the Settings page needs) ---

router.get('/settings', (req, res) => {
  res.json(backup.getStatus());
});

router.patch('/settings', (req, res) => {
  const body = req.body || {};
  const patch = {};
  if (typeof body.deviceName === 'string' && body.deviceName.trim()) patch.deviceName = body.deviceName.trim();
  if (typeof body.backupDir === 'string' && body.backupDir.trim()) patch.backupDir = body.backupDir.trim();
  if (typeof body.backupOnClose === 'boolean') patch.backupOnClose = body.backupOnClose;
  if (typeof body.autoRestoreOnEmpty === 'boolean') patch.autoRestoreOnEmpty = body.autoRestoreOnEmpty;
  if (body.retentionCount !== undefined) patch.retentionCount = Math.max(1, Number(body.retentionCount) || 50);
  if (body.autoBackup && typeof body.autoBackup === 'object') {
    const ab = {};
    if (typeof body.autoBackup.enabled === 'boolean') ab.enabled = body.autoBackup.enabled;
    if (body.autoBackup.intervalMinutes !== undefined) ab.intervalMinutes = Math.max(1, Number(body.autoBackup.intervalMinutes) || 60);
    patch.autoBackup = ab;
  }
  saveConfig(patch);
  backup.startScheduler(); // re-reads config; reschedules or stops the timer
  res.json(backup.getStatus());
});

// --- backups ---

router.get('/backups', (req, res) => {
  // Don't leak absolute filesystem paths to the client.
  res.json(backup.listSnapshots().map(({ path, ...rest }) => rest));
});

router.post('/backups', (req, res) => {
  const result = backup.createSnapshot('manual');
  if (result.skipped) return res.status(409).json({ error: result.reason });
  res.status(201).json(result);
});

router.post('/backups/restore-latest', (req, res) => {
  const result = backup.stageRestore(); // newest
  res.json({
    staged: { name: result.staged.name, device: result.staged.device, createdAt: result.staged.createdAt },
    safety: result.safety && result.safety.name ? result.safety.name : null,
    message: 'Backup staged. Restart the app (Ctrl+C, then npm start) to load it.',
  });
});

router.delete('/backups/:name', (req, res) => {
  backup.deleteSnapshot(req.params.name);
  res.json({ ok: true });
});

module.exports = router;
