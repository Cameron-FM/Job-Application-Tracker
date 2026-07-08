// Shared filesystem paths, split out so config.js and backup.js can use them
// without importing db.js (which would create a circular dependency, since db.js
// needs config/backup for startup auto-restore).
const path = require('path');
const fs = require('fs');

// Data lives in <project root>/data — that's TWO levels up from app/server/,
// because all program files live inside app/ while data/ sits at the root next
// to the launchers (user-friendly root layout). ATS_DATA_DIR can repoint it
// (useful for tests and for running a second isolated instance).
const DATA_DIR = process.env.ATS_DATA_DIR
  ? path.resolve(process.env.ATS_DATA_DIR)
  : path.join(__dirname, '..', '..', 'data');
const FILES_DIR = path.join(DATA_DIR, 'files');
const DB_PATH = path.join(DATA_DIR, 'ats.db');

fs.mkdirSync(FILES_DIR, { recursive: true });

module.exports = { DATA_DIR, FILES_DIR, DB_PATH };
