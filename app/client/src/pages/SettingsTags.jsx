import { useState } from 'react';
import { api } from '../api';
import { useFetch } from '../hooks';
import Modal from '../components/Modal';
import SettingsTabs from '../components/SettingsTabs';
import { Pill } from '../components/Badges';

// Curated palette (mirrors CompanyLogo.jsx's AVATAR_COLORS) so tag colors stay
// consistent and legible instead of a raw color picker.
const TAG_COLORS = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626', '#0891b2', '#db2777', '#65a30d', '#64748b'];

function ColorSwatchPicker({ value, onChange }) {
  return (
    <div className="tag-color-picker">
      {TAG_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          className={`tag-color-swatch${value === c ? ' selected' : ''}`}
          style={{ background: c }}
          onClick={() => onChange(c)}
          aria-label={c}
        />
      ))}
    </div>
  );
}

export default function SettingsTags() {
  const { data: tags, reload } = useFetch('/api/tags');
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null); // { name, color }
  const [newForm, setNewForm] = useState({ name: '', color: TAG_COLORS[0] });
  const [notice, setNotice] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);

  const startEdit = (tag) => { setEditingId(tag.id); setEditForm({ name: tag.name, color: tag.color }); };
  const cancelEdit = () => { setEditingId(null); setEditForm(null); };

  const saveEdit = async (tag) => {
    setBusy(true);
    try {
      await api.patch(`/api/tags/${tag.id}`, editForm);
      cancelEdit();
      reload();
    } catch (e) {
      setNotice({ type: 'err', text: e.message });
    } finally { setBusy(false); }
  };

  const addTag = async (e) => {
    e.preventDefault();
    if (!newForm.name.trim()) return;
    setBusy(true);
    try {
      await api.post('/api/tags', newForm);
      setNewForm({ name: '', color: TAG_COLORS[0] });
      reload();
    } catch (e) {
      setNotice({ type: 'err', text: e.message });
    } finally { setBusy(false); }
  };

  const deleteTag = async (tag) => {
    setBusy(true);
    try {
      await api.del(`/api/tags/${tag.id}`);
      reload();
    } catch (e) {
      setNotice({ type: 'err', text: e.message });
    } finally { setBusy(false); setConfirm(null); }
  };

  const confirmDelete = (tag) => {
    const total = tag.job_count + tag.company_count + tag.contact_count + tag.document_count;
    setConfirm({
      title: `Delete "${tag.name}"?`,
      danger: true,
      body: total > 0
        ? `This tag is used on ${tag.job_count} job(s), ${tag.company_count} compan(y/ies), ${tag.contact_count} contact(s) and ${tag.document_count} document(s) — it will be removed from all of them. This can't be undone.`
        : `This tag isn't used anywhere yet. This can't be undone.`,
      label: 'Delete',
      onConfirm: () => deleteTag(tag),
    });
  };

  const list = tags || [];

  return (
    <div className="page">
      <div className="page-header"><h1>Settings</h1></div>
      <SettingsTabs />

      <div className="banner">
        <strong>Tags are a standardized vocabulary</strong> — a fixed, in-app-managed list applied
        across jobs, companies, people and documents. Add, rename or recolor them here; they can
        then be multi-selected on any record, and filtered/searched everywhere.
      </div>

      {notice && (
        <div className={`notice notice-${notice.type}`}>
          {notice.text}
          <button className="btn-icon" onClick={() => setNotice(null)} aria-label="Dismiss">✕</button>
        </div>
      )}

      <div className="card card-table">
        <div className="card-header"><h2>Tags ({list.length})</h2></div>
        <table className="table">
          <thead>
            <tr><th>Tag</th><th>Jobs</th><th>Companies</th><th>People</th><th>Documents</th><th></th></tr>
          </thead>
          <tbody>
            {list.map((t) => (
              <tr key={t.id}>
                <td>
                  {editingId === t.id ? (
                    <div className="tag-edit-row">
                      <input
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        autoFocus
                      />
                      <ColorSwatchPicker value={editForm.color} onChange={(color) => setEditForm({ ...editForm, color })} />
                    </div>
                  ) : (
                    <Pill color={t.color}>{t.name}</Pill>
                  )}
                </td>
                <td className="td-muted">{t.job_count}</td>
                <td className="td-muted">{t.company_count}</td>
                <td className="td-muted">{t.contact_count}</td>
                <td className="td-muted">{t.document_count}</td>
                <td>
                  {editingId === t.id ? (
                    <div className="toggle-row">
                      <button className="btn btn-sm btn-primary" disabled={busy || !editForm.name.trim()} onClick={() => saveEdit(t)}>Save</button>
                      <button className="btn btn-sm" onClick={cancelEdit}>Cancel</button>
                    </div>
                  ) : (
                    <div className="toggle-row">
                      <button className="link" onClick={() => startEdit(t)}>rename</button>
                      <button className="link-danger" onClick={() => confirmDelete(t)}>delete</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <div className="empty">No tags yet — add your first one below.</div>}
      </div>

      <div className="card">
        <div className="card-header"><h2>Add a tag</h2></div>
        <form onSubmit={addTag} className="form-grid">
          <div className="field">
            <label className="field-label">Name</label>
            <input value={newForm.name} onChange={(e) => setNewForm({ ...newForm, name: e.target.value })} placeholder="e.g. Sales" />
          </div>
          <div className="field">
            <label className="field-label">Color</label>
            <ColorSwatchPicker value={newForm.color} onChange={(color) => setNewForm({ ...newForm, color })} />
          </div>
          <div className="modal-actions full">
            <button type="submit" className="btn btn-primary" disabled={busy || !newForm.name.trim()}>+ Add tag</button>
          </div>
        </form>
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
