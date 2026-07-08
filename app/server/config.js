const fs = require('fs');
const os = require('os');
const path = require('path');
const { DATA_DIR } = require('./db-paths');

const CONFIG_PATH = path.join(DATA_DIR, 'config.json');

const DEFAULTS = {
  deviceName: os.hostname().replace(/\.local$/, ''),
  backupDir: path.join(DATA_DIR, 'backups'),
  autoBackup: { enabled: true, intervalMinutes: 60 },
  backupOnClose: true,
  autoRestoreOnEmpty: true,
  retentionCount: 50,
  // Manual cloud-sync override (a provider name string, or null = auto-detect).
  // Covers setups path-detection can't see — e.g. Google Drive's "sync this
  // folder from computer" feature mirroring data/backups in place, where the
  // path stays local but the folder IS cloud-synced.
  storageOverride: null,
};

function loadConfig() {
  let saved = {};
  try {
    saved = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch { /* no config yet — use defaults */ }
  // Merge shallowly, but keep nested autoBackup defaults if partially provided.
  return {
    ...DEFAULTS,
    ...saved,
    autoBackup: { ...DEFAULTS.autoBackup, ...(saved.autoBackup || {}) },
  };
}

function saveConfig(patch) {
  const next = { ...loadConfig(), ...patch };
  if (patch.autoBackup) next.autoBackup = { ...loadConfig().autoBackup, ...patch.autoBackup };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2));
  return next;
}

// Best-effort: is backupDir inside a known cloud-sync folder? Pure string match on
// the resolved path — the app itself never talks to any cloud API.
function detectStorageMode(backupDir) {
  const p = path.resolve(backupDir);
  const rules = [
    [/Library\/CloudStorage\/GoogleDrive-/i, 'Google Drive'],
    [/Library\/CloudStorage\/OneDrive-/i, 'OneDrive'],
    [/Library\/CloudStorage\/Dropbox/i, 'Dropbox'],
    [/Library\/CloudStorage\/Box-/i, 'Box'],
    [/Library\/Mobile Documents\/com~apple~CloudDocs/i, 'iCloud Drive'],
    [/[/\\]Google Drive([/\\]|$)/i, 'Google Drive'],
    [/[/\\]My Drive([/\\]|$)/i, 'Google Drive'],
    [/[/\\]Dropbox([/\\]|$)/i, 'Dropbox'],
    [/[/\\]OneDrive[^/\\]*([/\\]|$)/i, 'OneDrive'],
    [/[/\\]Box( Sync)?([/\\]|$)/i, 'Box'],
    [/[/\\]iCloud[^/\\]*([/\\]|$)/i, 'iCloud Drive'],
  ];
  for (const [re, provider] of rules) {
    if (re.test(p)) return { mode: 'cloud', provider };
  }
  return { mode: 'local', provider: null };
}

// Ensures backupDir exists and is writable; falls back to the local default if not,
// so a bad/unreachable cloud path never silently breaks backups.
function resolveBackupDir(config) {
  const dir = config.backupDir || DEFAULTS.backupDir;
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.accessSync(dir, fs.constants.W_OK);
    return { dir, ok: true, error: null };
  } catch (e) {
    try { fs.mkdirSync(DEFAULTS.backupDir, { recursive: true }); } catch { /* ignore */ }
    return { dir: DEFAULTS.backupDir, ok: false, error: `Can't write to "${dir}" (${e.code || e.message}); using local default.` };
  }
}

module.exports = { loadConfig, saveConfig, detectStorageMode, resolveBackupDir, DEFAULTS, CONFIG_PATH };
