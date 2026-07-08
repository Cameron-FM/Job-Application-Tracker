import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFetch } from '../hooks';
import { CompanyFormModal } from '../components/forms';
import CompanyLogo from '../components/CompanyLogo';

export default function Companies() {
  const { data: companies, reload } = useFetch('/api/companies');
  const [showForm, setShowForm] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="page">
      <div className="page-header">
        <h1>Companies</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Add company</button>
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
            {(companies || []).map((c) => (
              <tr key={c.id} onClick={() => navigate(`/companies/${c.id}`)}>
                <td className="td-strong">
                  <span className="company-cell">
                    <CompanyLogo name={c.name} website={c.website} size={24} />
                    <span className="company-cell-title">
                      {c.name}
                      {c.summary && <span className="td-subtle">{c.summary}</span>}
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
      </div>

      {showForm && (
        <CompanyFormModal onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); reload(); }} />
      )}
    </div>
  );
}
