import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFetch } from '../hooks';
import { CONTACT_TYPES, CONVERSATION_STATUSES } from '../constants';
import { TypeBadge, StatusBadge, DueBadge, TagBadgeRow } from '../components/Badges';
import { ContactFormModal } from '../components/forms';
import CompanyLogo from '../components/CompanyLogo';
import { fmtDate } from '../utils';

export default function People() {
  const { data: contacts, reload } = useFetch('/api/contacts');
  const { data: companies } = useFetch('/api/companies');
  const { data: allTags } = useFetch('/api/tags');
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [tagId, setTagId] = useState('');
  const [showForm, setShowForm] = useState(false);
  const navigate = useNavigate();

  const filtered = useMemo(() => {
    if (!contacts) return [];
    const term = q.trim().toLowerCase();
    return contacts
      .filter((c) => !type || c.contact_type === type)
      .filter((c) => !status || c.conversation_status === status)
      .filter((c) => !tagId || (c.tags || []).some((t) => t.id === Number(tagId)))
      .filter((c) => !term
        || c.name.toLowerCase().includes(term)
        || (c.company_name || '').toLowerCase().includes(term)
        || (c.role_title || '').toLowerCase().includes(term));
  }, [contacts, q, type, status, tagId]);

  return (
    <div className="page">
      <div className="page-header">
        <h1>People</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Add contact</button>
      </div>

      <div className="toolbar">
        <input className="search" placeholder="Search people…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          {Object.entries(CONTACT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {Object.entries(CONVERSATION_STATUSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={tagId} onChange={(e) => setTagId(e.target.value)}>
          <option value="">All tags</option>
          {(allTags || []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      <div className="card card-table">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Company</th>
              <th>Role</th>
              <th>Type</th>
              <th>Status</th>
              <th>Last contacted</th>
              <th>Follow-up</th>
              <th>Jobs</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} onClick={() => navigate(`/people/${c.id}`)}>
                <td className="td-strong">
                  {c.name}
                  <TagBadgeRow tags={c.tags} />
                </td>
                <td className="td-muted">
                  {c.company_name ? (
                    <span className="company-cell">
                      <CompanyLogo name={c.company_name} website={c.company_website} size={18} />
                      {c.company_name}
                    </span>
                  ) : '—'}
                </td>
                <td className="td-muted td-truncate">{c.role_title || '—'}</td>
                <td><TypeBadge type={c.contact_type} /></td>
                <td><StatusBadge status={c.conversation_status} /></td>
                <td className="td-muted">{fmtDate(c.last_contacted) || '—'}</td>
                <td><DueBadge date={c.next_followup_due} /></td>
                <td className="td-muted">{c.job_count || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="empty">No contacts match.</div>}
      </div>

      {showForm && (
        <ContactFormModal companies={companies} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); reload(); }} />
      )}
    </div>
  );
}
