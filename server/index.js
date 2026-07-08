const path = require('path');
const fs = require('fs');
const express = require('express');
require('./db'); // ensures schema exists (and applies any restore) before routes run
const backup = require('./backup');
const { loadConfig } = require('./config');

const app = express();
app.use(express.json({ limit: '2mb' }));

app.use('/api/companies', require('./routes/companies'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/contacts', require('./routes/contacts'));
app.use('/api/documents', require('./routes/documents'));
app.use('/api/activities', require('./routes/activities'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api', require('./routes/backups')); // /api/settings + /api/backups*

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// Serve the built client (npm start); in dev, Vite serves the client itself.
const dist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

// better-sqlite3 is synchronous, so route errors land here.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

const PORT = process.env.PORT || 3400;
app.listen(PORT, () => {
  console.log(`Job tracker running at http://localhost:${PORT}`);
  backup.startScheduler(); // hourly (or configured) snapshots
});

// Take one final snapshot on shutdown, then exit. Guarded so a double Ctrl+C or a
// backup error can't hang the process.
let shuttingDown = false;
function shutdown() {
  if (shuttingDown) process.exit(0);
  shuttingDown = true;
  backup.stopScheduler();
  try {
    if (loadConfig().backupOnClose) {
      const r = backup.createSnapshot('on-close');
      if (r && r.name) console.log(`On-close backup saved: ${r.name}`);
    }
  } catch (e) {
    console.error('On-close backup failed:', e.message);
  }
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
