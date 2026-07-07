const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, '..', 'data');
const FILES_DIR = path.join(DATA_DIR, 'files');
fs.mkdirSync(FILES_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'ats.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  website TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  industry TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT NOT NULL DEFAULT '',
  application_url TEXT NOT NULL DEFAULT '',
  referred_by_contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
  location TEXT NOT NULL DEFAULT '',
  salary_range TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '',
  stage TEXT NOT NULL DEFAULT 'Interested',
  applied_date TEXT,
  next_step TEXT NOT NULL DEFAULT '',
  next_step_due TEXT,
  summary TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  raw_posting TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
  role_title TEXT NOT NULL DEFAULT '',
  contact_type TEXT NOT NULL DEFAULT 'recruiter',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  linkedin_url TEXT NOT NULL DEFAULT '',
  conversation_status TEXT NOT NULL DEFAULT 'not_contacted',
  last_contacted TEXT,
  next_followup_due TEXT,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS job_contacts (
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (job_id, contact_id)
);

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT NOT NULL,
  doc_type TEXT NOT NULL DEFAULT 'cv',
  filename TEXT NOT NULL,
  stored_path TEXT NOT NULL,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS job_documents (
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  PRIMARY KEY (job_id, document_id)
);

CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
  contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL DEFAULT 'note',
  title TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  occurred_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_activities_job ON activities(job_id);
CREATE INDEX IF NOT EXISTS idx_activities_contact ON activities(contact_id);
`);

// Idempotent migrations: add columns to databases created before these fields existed.
// (SQLite has no ADD COLUMN IF NOT EXISTS, so we check the table shape first.)
function ensureColumn(table, column, ddl) {
  const exists = db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
  if (!exists) db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
}
ensureColumn('companies', 'summary', "summary TEXT NOT NULL DEFAULT ''");
ensureColumn('companies', 'description', "description TEXT NOT NULL DEFAULT ''");
ensureColumn('jobs', 'application_url', "application_url TEXT NOT NULL DEFAULT ''");
ensureColumn('jobs', 'summary', "summary TEXT NOT NULL DEFAULT ''");
ensureColumn('jobs', 'raw_posting', "raw_posting TEXT NOT NULL DEFAULT ''");
ensureColumn('jobs', 'referred_by_contact_id', 'referred_by_contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL');

module.exports = { db, DATA_DIR, FILES_DIR };
