import { useState, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useFetch } from '../hooks';
import { DOC_TYPES } from '../constants';
import { StageBadge } from '../components/Badges';
import TagPicker from '../components/TagPicker';
import { fmtDate } from '../utils';

export default function CvLibrary() {
  const { data: docs, reload } = useFetch('/api/documents');
  const { data: allTags } = useFetch('/api/tags');
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState(null);
  const [error, setError] = useState(null);
  const [tagId, setTagId] = useState('');
  const fileInput = useRef();

  const filtered = useMemo(
    () => (docs || []).filter((d) => !tagId || (d.tags || []).some((t) => t.id === Number(tagId))),
    [docs, tagId]
  );

  const scanFolder = async () => {
    setScanning(true);
    setScanMessage(null);
    setError(null);
    try {
      const { added } = await api.post('/api/documents/scan', {});
      setScanMessage(added.length
        ? `Added ${added.length} file(s) found in data/files/: ${added.map((d) => d.label).join(', ')}`
        : 'No new files found in data/files/.');
      reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setScanning(false);
    }
  };

  const uploadFiles = async (files) => {
    setUploading(true);
    setError(null);
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append('file', file);
        await api.upload('/api/documents', fd);
      }
      reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const renameDoc = async (doc) => {
    const label = window.prompt('New label for this document:', doc.label);
    if (label === null || !label.trim()) return;
    await api.patch(`/api/documents/${doc.id}`, { label: label.trim() });
    reload();
  };

  const setType = async (doc, doc_type) => {
    await api.patch(`/api/documents/${doc.id}`, { doc_type });
    reload();
  };

  const setTags = async (doc, tagIds) => {
    await api.patch(`/api/documents/${doc.id}`, { tags: tagIds });
    reload();
  };

  const deleteDoc = async (doc) => {
    const inUse = doc.jobs.length ? ` It's attached to ${doc.jobs.length} job(s).` : '';
    if (!window.confirm(`Delete "${doc.label}" and its file?${inUse}`)) return;
    await api.del(`/api/documents/${doc.id}`);
    reload();
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Documents</h1>
        <div className="header-actions">
          <button className="btn" onClick={scanFolder} disabled={scanning}>
            {scanning ? 'Scanning…' : '⟳ Scan data/files folder'}
          </button>
          <button className="btn btn-primary" onClick={() => fileInput.current.click()}>+ Upload</button>
        </div>
        <input
          ref={fileInput}
          type="file"
          multiple
          hidden
          onChange={(e) => { uploadFiles([...e.target.files]); e.target.value = ''; }}
        />
      </div>
      <p className="hint" style={{ marginTop: -12, marginBottom: 16 }}>
        Tip: you can also just drop CV files straight into the <code>data/files</code> folder on your
        computer, then click "Scan data/files folder" (or run <code>npm run scan-documents</code>) to pick them up.
      </p>
      {scanMessage && <div className="scan-message">{scanMessage}</div>}

      {docs && docs.length > 0 && (
        <div className="toolbar">
          <select value={tagId} onChange={(e) => setTagId(e.target.value)}>
            <option value="">All tags</option>
            {(allTags || []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      )}

      <div
        className={`dropzone${dragging ? ' dragging' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); uploadFiles([...e.dataTransfer.files]); }}
      >
        {uploading ? 'Uploading…' : 'Drag CVs here, or use the Upload button. One CV can be attached to many jobs.'}
      </div>
      {error && <div className="form-error">{error}</div>}

      {filtered.map((doc) => (
        <div className="card doc-card" key={doc.id}>
          <div className="doc-main">
            <a className="doc-title" href={`/api/documents/${doc.id}/file`} target="_blank" rel="noreferrer">📄 {doc.label}</a>
            <div className="muted-small">{doc.filename} · uploaded {fmtDate(doc.uploaded_at)}</div>
            <div className="doc-actions">
              <select value={doc.doc_type} onChange={(e) => setType(doc, e.target.value)}>
                {Object.entries(DOC_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <a className="link" href={`/api/documents/${doc.id}/file?download=1`}>download</a>
              <button className="link" onClick={() => renameDoc(doc)}>rename</button>
              <button className="link-danger" onClick={() => deleteDoc(doc)}>delete</button>
            </div>
            <div className="doc-tags">
              <TagPicker allTags={allTags} selectedIds={(doc.tags || []).map((t) => t.id)} onChange={(tagIds) => setTags(doc, tagIds)} />
            </div>
          </div>
          <div className="doc-jobs">
            <div className="field-label">Attached to</div>
            {doc.jobs.length === 0 && <div className="muted-small">No jobs yet</div>}
            {doc.jobs.map((j) => (
              <Link key={j.job_id} to={`/jobs/${j.job_id}`} className="doc-job-row">
                <span>{j.title} · {j.company_name}</span> <StageBadge stage={j.stage} />
              </Link>
            ))}
          </div>
        </div>
      ))}
      {docs && docs.length === 0 && <div className="empty">No documents yet — upload your first CV above.</div>}
      {docs && docs.length > 0 && filtered.length === 0 && <div className="empty">No documents match that tag.</div>}
    </div>
  );
}
