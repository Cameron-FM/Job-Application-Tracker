import { useState, useEffect } from 'react';
import { api } from '../api';
import { useFetch } from '../hooks';
import Modal from '../components/Modal';
import { fmtDate } from '../utils';

function fmtBytes(n) {
  if (!n) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function relTime(iso) {
  if (!iso) return 'never';
  const secs = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)} min ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)} hr ago`;
  return `${Math.floor(secs / 86400)} days ago`;
}

function countsSummary(c = {}) {
  return `${c.jobs || 0} jobs · ${c.companies || 0} companies · ${c.contacts || 0} contacts · ${c.documents || 0} CVs`;
}

export default function Settings() {
  const { data: status, reload: reloadStatus } = useFetch('/api/settings');
  const { data: backups, reload: reloadBackups } = useFetch('/api/backups');
  const [form, setForm] = useState(null);
  const [notice, setNotice] = useState(null);   // { type, text }
  const [confirm, setConfirm] = useState(null);  // { title, body, danger, label, onConfirm }
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status && !form) {
      const c = status.config;
      setForm({
        deviceName: c.deviceName,
        backupDir: c.backupDir,
        intervalMinutes: c.autoBackup.intervalMinutes,
        autoEnabled: c.autoBackup.enabled,
        backupOnClose: c.backupOnClose,
        autoRestoreOnEmpty: c.autoRestoreOnEmpty,
        retentionCount: c.retentionCount,
        storageOverride: c.storageOverride || '',
      });
    }
  }, [status, form]);

  if (!status || !form) return <div className="page" />;

  const refresh = () => { reloadStatus(); reloadBackups(); };

  const backupNow = async () => {
    setBusy(true);
    try {
      const r = await api.post('/api/backups', {});
      setNotice({ type: 'ok', text: `Backup created: ${r.name}` });
      refresh();
    } catch (e) {
      setNotice({ type: 'err', text: e.message });
    } finally { setBusy(false); setConfirm(null); }
  };

  const restoreLatest = async () => {
    setBusy(true);
    try {
      const r = await api.post('/api/backups/restore-latest', {});
      setNotice({ type: 'warn', text: r.message + (r.safety ? ` (a safety copy "${r.safety}" was saved first)` : '') });
      refresh();
    } catch (e) {
      setNotice({ type: 'err', text: e.message });
    } finally { setBusy(false); setConfirm(null); }
  };

  const deleteBackup = async (name) => {
    setBusy(true);
    try {
      await api.del(`/api/backups/${encodeURIComponent(name)}`);
      refresh();
    } catch (e) {
      setNotice({ type: 'err', text: e.message });
    } finally { setBusy(false); setConfirm(null); }
  };

  const saveSettings = async () => {
    setBusy(true);
    try {
      await api.patch('/api/settings', {
        deviceName: form.deviceName,
        backupDir: form.backupDir,
        backupOnClose: form.backupOnClose,
        autoRestoreOnEmpty: form.autoRestoreOnEmpty,
        retentionCount: Number(form.retentionCount),
        autoBackup: { enabled: form.autoEnabled, intervalMinutes: Number(form.intervalMinutes) },
        storageOverride: form.storageOverride || null,
      });
      setNotice({ type: 'ok', text: 'Settings saved.' });
      reloadStatus();
    } catch (e) {
      setNotice({ type: 'err', text: e.message });
    } finally { setBusy(false); }
  };

  const cloud = status.storage.mode === 'cloud';
  const provenance = status.restoredFrom
    ? `Restored from "${status.restoredFrom.name}" (from ${status.restoredFrom.device}) on ${fmtDate(status.restoredFrom.at)}${status.restoredFrom.auto ? ' — automatically, on first run' : ''}`
    : 'Original database, created on this device';

  const list = backups || [];

  return (
    <div className="page">
      <div className="page-header"><h1>Settings &amp; Backups</h1></div>

      {/* How backups work */}
      <div className="banner">
        <strong>Your data is backed up automatically</strong> — every {form.intervalMinutes} minutes while the app runs,
        and once more when you shut it down. You can also back it up manually any time with the button below.
        Backups include your database and all CV files.
      </div>

      {notice && (
        <div className={`notice notice-${notice.type}`}>
          {notice.text}
          <button className="btn-icon" onClick={() => setNotice(null)} aria-label="Dismiss">✕</button>
        </div>
      )}

      {/* Status */}
      <div className="card">
        <div className="card-header">
          <h2>Current status</h2>
          <span className={`badge-mode ${cloud ? 'is-cloud' : 'is-local'}`}>
            {cloud
              ? `☁ Cloud-synced · ${status.storage.provider}${status.storage.overridden ? ' (set manually)' : ''}`
              : '💻 Local only'}
          </span>
        </div>
        <dl className="detail-list detail-list-stack">
          <div><dt>This device</dt><dd>{status.config.deviceName}</dd></div>
          <div><dt>Backup folder</dt><dd><code>{status.backupDir}</code>{!status.writable && <span className="inline-warn"> ⚠ {status.dirError}</span>}</dd></div>
          <div><dt>Last backup</dt><dd>{status.lastBackupAt ? `${relTime(status.lastBackupAt)} (${fmtDate(status.lastBackupAt)})` : 'never backed up yet'}</dd></div>
          <div><dt>This database</dt><dd>{provenance}</dd></div>
          {status.liveCounts && <div><dt>Contains</dt><dd>{countsSummary(status.liveCounts)}</dd></div>}
        </dl>
        {!cloud && (
          <p className="hint" style={{ marginTop: 10 }}>
            Tip: to back up to the cloud, either set the backup folder below to a synced folder
            (e.g. Google Drive, Dropbox, or iCloud Drive), or — if your cloud app syncs this
            project's own backups folder in place (like Google Drive's "sync this folder from
            computer") — pick your provider under "This folder is synced by" below. The app writes
            the files; your cloud app uploads them — no accounts or keys needed here.
          </p>
        )}
        <div className="header-actions" style={{ marginTop: 14 }}>
          <button className="btn btn-primary" disabled={busy}
            onClick={() => setConfirm({
              title: 'Create a backup now?',
              body: 'This saves a fresh snapshot of your current data and CV files to the backup folder.',
              label: 'Back up now',
              onConfirm: backupNow,
            })}>Back up now</button>
          <button className="btn btn-danger" disabled={busy || list.length === 0}
            onClick={() => setConfirm({
              title: 'Restore most recent backup?',
              danger: true,
              body: list.length
                ? `This will REPLACE this device's current data with the most recent backup — "${list[0].name}" (from ${list[0].device}, ${fmtDate(list[0].createdAt)}). A safety copy of your current data is saved first, and the app must be restarted to finish. Continue?`
                : 'No backups available.',
              label: 'Restore latest',
              onConfirm: restoreLatest,
            })}>Restore most recent backup</button>
        </div>
      </div>

      {/* Backups list */}
      <div className="card card-table">
        <div className="card-header"><h2>Backup history ({list.length})</h2></div>
        <table className="table">
          <thead>
            <tr><th>When</th><th>Device</th><th>Contents</th><th>Size</th><th>Type</th><th></th></tr>
          </thead>
          <tbody>
            {list.map((b) => (
              <tr key={b.name}>
                <td className="td-strong">{fmtDate(b.createdAt)}<div className="td-subtle">{relTime(b.createdAt)}</div></td>
                <td className="td-muted">{b.device}</td>
                <td className="td-muted">{countsSummary(b.counts)}</td>
                <td className="td-muted">{fmtBytes(b.sizeBytes)}</td>
                <td className="td-muted">{b.reason || '—'}</td>
                <td>
                  <button className="link-danger" disabled={busy}
                    onClick={() => setConfirm({
                      title: 'Delete this backup?',
                      danger: true,
                      body: `Permanently delete "${b.name}"? This can't be undone.`,
                      label: 'Delete',
                      onConfirm: () => deleteBackup(b.name),
                    })}>delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <div className="empty">No backups yet. Click “Back up now”, or wait for the automatic hourly backup.</div>}
      </div>

      {/* Settings form */}
      <div className="card">
        <div className="card-header"><h2>Backup settings</h2></div>
        <div className="form-grid">
          <div className="field full">
            <label className="field-label">Backup folder</label>
            <div className="input-row">
              <input value={form.backupDir} onChange={(e) => setForm({ ...form, backupDir: e.target.value })}
                placeholder="/Users/you/Library/CloudStorage/GoogleDrive-…/JobTracker" />
              <button type="button" className="btn"
                disabled={form.backupDir === status.defaultBackupDir}
                title={`Reset to the project's own backups folder:\n${status.defaultBackupDir}`}
                onClick={() => setForm({ ...form, backupDir: status.defaultBackupDir })}>
                Reset to default
              </button>
            </div>
          </div>
          <div className="field full">
            <label className="field-label">This folder is synced by</label>
            <select value={form.storageOverride}
              onChange={(e) => setForm({ ...form, storageOverride: e.target.value })}>
              <option value="">Auto-detect from the folder path</option>
              <option value="Google Drive">Google Drive (e.g. "sync this folder from computer")</option>
              <option value="Dropbox">Dropbox</option>
              <option value="iCloud Drive">iCloud Drive</option>
              <option value="OneDrive">OneDrive</option>
              <option value="Box">Box</option>
              <option value="Cloud">Other cloud sync</option>
            </select>
            <span className="hint">Only needed when your cloud app syncs the folder in place and
              the badge still says "Local only" — this tells the app it's actually cloud-synced.</span>
          </div>
          <div className="field">
            <label className="field-label">This device's name</label>
            <input value={form.deviceName} onChange={(e) => setForm({ ...form, deviceName: e.target.value })} />
          </div>
          <div className="field">
            <label className="field-label">Backup every (minutes)</label>
            <input type="number" min="1" value={form.intervalMinutes}
              onChange={(e) => setForm({ ...form, intervalMinutes: e.target.value })} />
          </div>
          <div className="field">
            <label className="field-label">Keep newest N backups</label>
            <input type="number" min="1" value={form.retentionCount}
              onChange={(e) => setForm({ ...form, retentionCount: e.target.value })} />
          </div>
          <label className="check full">
            <input type="checkbox" checked={form.autoEnabled} onChange={(e) => setForm({ ...form, autoEnabled: e.target.checked })} />
            Automatically back up on a timer
          </label>
          <label className="check full">
            <input type="checkbox" checked={form.backupOnClose} onChange={(e) => setForm({ ...form, backupOnClose: e.target.checked })} />
            Back up when the app shuts down
          </label>
          <label className="check full">
            <input type="checkbox" checked={form.autoRestoreOnEmpty} onChange={(e) => setForm({ ...form, autoRestoreOnEmpty: e.target.checked })} />
            On a new/empty device, automatically restore the most recent backup on first launch
          </label>
        </div>
        <div className="header-actions" style={{ marginTop: 14 }}>
          <button className="btn btn-primary" disabled={busy} onClick={saveSettings}>Save settings</button>
        </div>
      </div>

      {confirm && (
        <Modal title={confirm.title} onClose={() => setConfirm(null)}>
          <div className="modal-body">
            <p className={confirm.danger ? 'prewrap danger-text' : 'prewrap'}>{confirm.body}</p>
          </div>
          <div className="modal-actions">
            <button className="btn" onClick={() => setConfirm(null)}>Cancel</button>
            <button className={`btn ${confirm.danger ? 'btn-danger' : 'btn-primary'}`} disabled={busy}
              onClick={confirm.onConfirm}>{confirm.label}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
