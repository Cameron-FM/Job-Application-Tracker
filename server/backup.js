const fs = require('fs');
const path = require('path');
const { DATA_DIR, FILES_DIR, DB_PATH } = require('./db-paths');
const { loadConfig, resolveBackupDir, detectStorageMode } = require('./config');

// NOTE: this module never `require('./db')` at the top level — that would create a
// cycle (db.js needs the file-swap helpers here at startup). createSnapshot pulls
// the db handle lazily, by which point db.js has fully loaded.

const STATE_PATH = path.join(DATA_DIR, 'backup-state.json');
const PENDING_PATH = path.join(DATA_DIR, 'pending-restore.json');
const PREFIX = 'ats-backup-';

let busy = false;   // guards against overlapping snapshots (timer + manual click)
let timer = null;   // scheduler handle

// ---------- small helpers ----------

function slug(s) {
  return String(s || 'device').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'device';
}

function stamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function readState() { return readJson(STATE_PATH, {}); }
function writeState(patch) {
  const next = { ...readState(), ...patch };
  fs.writeFileSync(STATE_PATH, JSON.stringify(next, null, 2));
  return next;
}

function readMeta(backupPath) { return readJson(path.join(backupPath, 'meta.json'), null); }

function isValidBackup(backupPath) {
  return fs.existsSync(path.join(backupPath, 'ats.db')) && !!readMeta(backupPath);
}

function dirSize(dir) {
  let total = 0;
  const walk = (p) => {
    for (const e of fs.readdirSync(p, { withFileTypes: true })) {
      const full = path.join(p, e.name);
      if (e.isDirectory()) walk(full);
      else try { total += fs.statSync(full).size; } catch { /* ignore */ }
    }
  };
  try { walk(dir); } catch { /* ignore */ }
  return total;
}

function currentDir() {
  return resolveBackupDir(loadConfig());
}

// ---------- snapshot creation ----------

function countRows(db) {
  const one = (t) => db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n;
  return { jobs: one('jobs'), companies: one('companies'), contacts: one('contacts'), documents: one('documents') };
}

// Takes a consistent point-in-time snapshot into the backup directory. Fully
// synchronous (VACUUM INTO + cpSync), so it's also safe to call during shutdown.
function createSnapshot(reason = 'manual') {
  if (busy) return { skipped: true, reason: 'A backup is already in progress.' };
  busy = true;
  try {
    const { db } = require('./db');
    const config = loadConfig();
    const { dir, error } = currentDir();

    let name = `${PREFIX}${slug(config.deviceName)}-${stamp()}`;
    if (fs.existsSync(path.join(dir, name))) name += `-${Math.random().toString(36).slice(2, 6)}`;

    const tmp = path.join(dir, `.tmp-${name}`);
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.mkdirSync(tmp, { recursive: true });

    // Consistent copy of the live DB (safe while the app is writing).
    db.exec(`VACUUM INTO '${path.join(tmp, 'ats.db').replace(/'/g, "''")}'`);

    // Copy the CV files.
    if (fs.existsSync(FILES_DIR)) fs.cpSync(FILES_DIR, path.join(tmp, 'files'), { recursive: true });
    else fs.mkdirSync(path.join(tmp, 'files'));

    const counts = countRows(db);
    const meta = { name, device: config.deviceName, createdAt: new Date().toISOString(), reason, counts };
    // meta.json written LAST so a half-written folder is never treated as valid.
    fs.writeFileSync(path.join(tmp, 'meta.json'), JSON.stringify(meta, null, 2));

    fs.renameSync(tmp, path.join(dir, name)); // atomic completion

    writeState({ lastBackupAt: meta.createdAt, lastBackupName: name });
    pruneOld(dir, config.retentionCount);
    return { ...meta, dirError: error };
  } finally {
    busy = false;
  }
}

function pruneOld(dir, keep) {
  const all = listSnapshots().filter((b) => !b.invalid);
  const excess = all.slice(keep); // listSnapshots is newest-first
  for (const b of excess) {
    try { fs.rmSync(b.path, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

// ---------- listing ----------

function listSnapshots() {
  const { dir } = currentDir();
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name.startsWith(PREFIX));
  } catch { return []; }

  const out = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    const meta = readMeta(full);
    if (!meta || !fs.existsSync(path.join(full, 'ats.db'))) continue; // skip incomplete
    out.push({
      name: e.name,
      path: full,
      device: meta.device || '—',
      createdAt: meta.createdAt || null,
      counts: meta.counts || {},
      reason: meta.reason || null,
      sizeBytes: dirSize(full),
    });
  }
  out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)); // newest first
  return out;
}

function findLatestBackup() {
  const latest = listSnapshots()[0];
  if (!latest) return null;
  const c = latest.counts || {};
  const hasRows = (c.jobs || 0) + (c.companies || 0) + (c.contacts || 0) > 0;
  return { ...latest, hasRows };
}

// ---------- file swaps (pure fs; used at startup while the DB is closed) ----------

// Replaces the live data files with those from a backup folder. MUST run only when
// no Database handle is open on DB_PATH.
function swapBackupIntoData(backupPath) {
  fs.copyFileSync(path.join(backupPath, 'ats.db'), DB_PATH);
  for (const suffix of ['-wal', '-shm']) {
    fs.rmSync(DB_PATH + suffix, { force: true }); // drop stale WAL sidecars
  }
  fs.rmSync(FILES_DIR, { recursive: true, force: true });
  const backupFiles = path.join(backupPath, 'files');
  if (fs.existsSync(backupFiles)) fs.cpSync(backupFiles, FILES_DIR, { recursive: true });
  else fs.mkdirSync(FILES_DIR, { recursive: true });
}

// Applies a manual restore that was staged before the last shutdown. Returns info
// about what was restored, or null. Called at the very top of db.js.
function applyPendingRestore() {
  const pending = readJson(PENDING_PATH);
  if (!pending || !pending.backupPath || !isValidBackup(pending.backupPath)) {
    fs.rmSync(PENDING_PATH, { force: true });
    return null;
  }
  swapBackupIntoData(pending.backupPath);
  const info = { name: pending.name, device: pending.device, at: new Date().toISOString(), auto: false };
  writeState({ restoredFrom: info });
  fs.rmSync(PENDING_PATH, { force: true });
  return info;
}

// ---------- restore staging (manual, from a route) ----------

function stageRestore(name) {
  const list = listSnapshots();
  const target = name ? list.find((b) => b.name === name) : list[0];
  if (!target) throw Object.assign(new Error('No backup available to restore.'), { status: 400 });

  // Safety net: snapshot the current data first so the restore is reversible.
  let safety = null;
  try { safety = createSnapshot('pre-restore-safety'); } catch (e) { safety = { error: e.message }; }

  fs.writeFileSync(PENDING_PATH, JSON.stringify({
    backupPath: target.path, name: target.name, device: target.device, stagedAt: new Date().toISOString(),
  }, null, 2));

  return { staged: target, safety };
}

function recordRestore(info) { writeState({ restoredFrom: info }); }

function deleteSnapshot(name) {
  if (!name || !name.startsWith(PREFIX) || name.includes('/') || name.includes('\\') || name.includes('..')) {
    throw Object.assign(new Error('Invalid backup name.'), { status: 400 });
  }
  const { dir } = currentDir();
  fs.rmSync(path.join(dir, name), { recursive: true, force: true });
}

// ---------- status (for the Settings page) ----------

function getStatus() {
  const config = loadConfig();
  const { dir, ok, error } = currentDir();
  const mode = detectStorageMode(dir);
  const state = readState();
  let liveCounts = null;
  try { liveCounts = countRows(require('./db').db); } catch { /* db may not expose during rare states */ }
  return {
    config,
    backupDir: dir,
    writable: ok,
    dirError: error,
    storage: mode,           // { mode: 'local' | 'cloud', provider }
    lastBackupAt: state.lastBackupAt || null,
    lastBackupName: state.lastBackupName || null,
    restoredFrom: state.restoredFrom || null,
    liveCounts,
    pendingRestore: readJson(PENDING_PATH),
  };
}

// ---------- scheduler ----------

function startScheduler() {
  stopScheduler();
  const config = loadConfig();
  if (config.autoBackup && config.autoBackup.enabled) {
    const ms = Math.max(1, Number(config.autoBackup.intervalMinutes) || 60) * 60 * 1000;
    timer = setInterval(() => {
      try { createSnapshot('scheduled'); } catch (e) { console.error('Scheduled backup failed:', e.message); }
    }, ms);
    if (timer.unref) timer.unref();
  }
}

function stopScheduler() {
  if (timer) { clearInterval(timer); timer = null; }
}

// Rewrites documents.stored_path to the canonical local path (by filename), so CV
// links keep working after a cross-device restore or a moved project folder.
// Idempotent — a no-op on a normal start.
function normalizeDocumentPaths(db) {
  const rows = db.prepare('SELECT id, stored_path FROM documents').all();
  const upd = db.prepare('UPDATE documents SET stored_path = ? WHERE id = ?');
  for (const r of rows) {
    const canonical = path.join(FILES_DIR, path.basename(r.stored_path));
    if (canonical !== r.stored_path) upd.run(canonical, r.id);
  }
}

module.exports = {
  createSnapshot, listSnapshots, findLatestBackup, stageRestore, deleteSnapshot,
  applyPendingRestore, swapBackupIntoData, recordRestore, getStatus,
  startScheduler, stopScheduler, normalizeDocumentPaths,
};
