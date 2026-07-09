import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useFetch } from '../hooks';
import { StageBadge, StatusBadge, TypeBadge, DueBadge, WatchlistBadge } from '../components/Badges';
import TagsCard from '../components/TagsCard';
import { CompanyFormModal, JobFormModal, ContactFormModal } from '../components/forms';
import CompanyLogo from '../components/CompanyLogo';
import { TERMINAL_STAGES } from '../constants';
import { fmtDate } from '../utils';

export default function CompanyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: company, error, reload } = useFetch(`/api/companies/${id}`);
  const [modal, setModal] = useState(null); // 'edit' | 'job' | 'contact'

  if (error) return <div className="page"><div className="form-error">{error}</div></div>;
  if (!company) return <div className="page" />;

  const activeJobCount = company.jobs.filter((j) => !TERMINAL_STAGES.includes(j.stage)).length;

  const closeAndReload = () => { setModal(null); reload(); };

  const setTags = async (tagIds) => {
    await api.patch(`/api/companies/${company.id}`, { tags: tagIds });
    reload();
  };

  const deleteCompany = async () => {
    if (!window.confirm(`Delete ${company.name}? This deletes its ${company.jobs.length} job(s) too.`)) return;
    await api.del(`/api/companies/${company.id}`);
    navigate('/companies');
  };

  return (
    <div className="page">
      <Link to="/companies" className="back-link">← All companies</Link>
      <div className="page-header">
        <div>
          <h1 className="company-cell">
            <CompanyLogo name={company.name} website={company.website} size={32} />
            {company.name}
            <WatchlistBadge activeJobCount={activeJobCount} />
          </h1>
          <div className="page-sub">
            {[company.industry, company.location].filter(Boolean).join(' · ')}
            {company.website && (
              <> · <a href={company.website} target="_blank" rel="noreferrer">{company.website.replace(/^https?:\/\//, '')}</a></>
            )}
          </div>
          {company.summary && <div className="page-summary">{company.summary}</div>}
        </div>
        <div className="header-actions">
          <button className="btn" onClick={() => setModal('edit')}>Edit</button>
          <button className="btn btn-danger" onClick={deleteCompany}>Delete</button>
        </div>
      </div>

      <TagsCard tags={company.tags} onChange={setTags} />

      {(company.description || company.notes) && (
        <div className="card">
          {company.description && <p className="prewrap">{company.description}</p>}
          {company.notes && (
            <>
              {company.description && <h3>Notes</h3>}
              <p className="prewrap">{company.notes}</p>
            </>
          )}
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h2>Jobs at {company.name}</h2>
          <button className="btn btn-sm" onClick={() => setModal('job')}>+ Add job here</button>
        </div>
        {company.jobs.length === 0 && <div className="empty">No jobs tracked at this company yet.</div>}
        {company.jobs.map((j) => (
          <Link to={`/jobs/${j.id}`} key={j.id} className="list-row">
            <div className="list-main">
              <div className="list-title">{j.title}</div>
              <div className="list-sub">
                {j.applied_date ? `Applied ${fmtDate(j.applied_date)}` : 'Not applied yet'}
                {j.next_step ? ` · Next: ${j.next_step}` : ''}
              </div>
            </div>
            <div className="list-side">
              <StageBadge stage={j.stage} />
              <DueBadge date={j.next_step_due} />
            </div>
          </Link>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <h2>People at {company.name}</h2>
          <button className="btn btn-sm" onClick={() => setModal('contact')}>+ Add contact</button>
        </div>
        {company.contacts.length === 0 && <div className="empty">No contacts at this company yet.</div>}
        {company.contacts.map((c) => (
          <Link to={`/people/${c.id}`} key={c.id} className="list-row">
            <div className="list-main">
              <div className="list-title">{c.name}</div>
              <div className="list-sub">{c.role_title || '—'}</div>
            </div>
            <div className="list-side">
              <TypeBadge type={c.contact_type} />
              <StatusBadge status={c.conversation_status} />
              <DueBadge date={c.next_followup_due} />
            </div>
          </Link>
        ))}
      </div>

      {modal === 'edit' && (
        <CompanyFormModal company={company} onClose={() => setModal(null)} onSaved={closeAndReload} />
      )}
      {modal === 'job' && (
        <JobFormModal initialCompanyName={company.name} companies={[company]} onClose={() => setModal(null)} onSaved={closeAndReload} />
      )}
      {modal === 'contact' && (
        <ContactFormModal initialCompanyName={company.name} companies={[company]} onClose={() => setModal(null)} onSaved={closeAndReload} />
      )}
    </div>
  );
}
