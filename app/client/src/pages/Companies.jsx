import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFetch } from '../hooks';
import { CompanyFormModal } from '../components/forms';
import { WatchlistBadge, TagBadgeRow } from '../components/Badges';
import CompanyLogo from '../components/CompanyLogo';

export default function Companies() {
  const { data: companies, reload } = useFetch('/api/companies');
  const { data: allTags } = useFetch('/api/tags');
  const [showForm, setShowForm] = useState(false);
  const [watchlistOnly, setWatchlistOnly] = useState(false);
  const [tagId, setTagId] = useState('');
  const navigate = useNavigate();

  const filtered = useMemo(
    () => (companies || [])
      .filter((c) => !watchlistOnly || c.active_job_count === 0)
      .filter((c) => !tagId || (c.tags || []).some((t) => t.id === Number(tagId))),
    [companies, watchlistOnly, tagId]
  );

  return (
    <div className="page">
      <div className="page-header">
        <h1>Companies</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Add company</button>
      </div>

      <div className="toolbar">
        <select value={tagId} onChange={(e) => setTagId(e.target.value)}>
          <option value="">All tags</option>
          {(allTags || []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <label className="check">
          <input type="checkbox" checked={watchlistOnly} onChange={(e) => setWatchlistOnly(e.target.checked)} />
          👀 Watchlist only (no open roles)
        </label>
      </div>

      <div className="card card-table">
        <table className="table">
          <thead>
            <tr>
              <th>Company</th>
              <th>Industry</th>
              <th>Location</th>
              <th>Jobs (active / total)</th>
              <th>Contacts</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} onClick={() => navigate(`/companies/${c.id}`)}>
                <td className="td-strong">
                  <span className="company-cell">
                    <CompanyLogo name={c.name} website={c.website} size={24} />
                    <span className="company-cell-title">
                      <span>
                        {c.name}
                        <WatchlistBadge activeJobCount={c.active_job_count} />
                      </span>
                      {c.summary && <span className="td-subtle">{c.summary}</span>}
                      <TagBadgeRow tags={c.tags} />
                    </span>
                  </span>
                </td>
                <td className="td-muted">{c.industry || '—'}</td>
                <td className="td-muted">{c.location || '—'}</td>
                <td>{c.active_job_count} / {c.job_count}</td>
                <td>{c.contact_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {companies && companies.length === 0 && (
          <div className="empty">No companies yet — they're created automatically when you add jobs.</div>
        )}
        {companies && companies.length > 0 && filtered.length === 0 && (
          <div className="empty">No companies match. Turn off "Watchlist only" to see them all.</div>
        )}
      </div>

      {showForm && (
        <CompanyFormModal onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); reload(); }} />
      )}
    </div>
  );
}
