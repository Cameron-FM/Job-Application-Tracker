const path = require('path');
const fs = require('fs');
const express = require('express');
require('./db'); // ensures schema exists (and applies any restore) before routes run
const backup = require('./backup');
const { loadConfig } = require('./config');
const session = require('./session');
const { version: APP_VERSION } = require('../package.json');

const app = express();
app.use(express.json({ limit: '2mb' }));

// Bare (not /api-prefixed) by convention — this is what the desktop launcher
// scripts poll to detect "is Job Tracker already running on this port" and
// "has the freshly-started server finished booting." Keep the shape stable
// (status/app/version) since launch.command / launch.bat parse it as JSON.
app.get('/health', (req, res) => {
  res.json({ status: 'ok', app: 'job-tracker', version: APP_VERSION });
});

app.use('/api/session', require('./routes/session'));
app.use('/api/companies', require('./routes/companies'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/contacts', require('./routes/contacts'));
app.use('/api/documents', require('./routes/documents'));
app.use('/api/activities', require('./routes/activities'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/search', require('./routes/search'));
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
  // No-op unless launched via launch.command/launch.bat (see server/session.js).
  session.startIdleMonitor(shutdown);
});

// Take one final snapshot on shutdown, then exit. Guarded so a double Ctrl+C, an
// OS signal arriving during the idle-shutdown path, or a backup error can't hang
// or double-run this. This is the SINGLE shutdown path — both a human Ctrl+C
// and the launcher-managed idle timeout (server/session.js) funnel through here,
// so the on-close backup always runs no matter how the process is asked to stop.
let shuttingDown = false;
function shutdown() {
  if (shuttingDown) process.exit(0);
  shuttingDown = true;
  backup.stopScheduler();
  session.stopIdleMonitor();
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
