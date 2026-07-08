import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useFetch } from '../hooks';
import { CONVERSATION_STATUSES } from '../constants';
import { StageBadge, TypeBadge, DueBadge, ReferralBadge } from '../components/Badges';
import Timeline from '../components/Timeline';
import { ContactFormModal, LogInteractionModal } from '../components/forms';
import CompanyLogo from '../components/CompanyLogo';
import { fmtDate } from '../utils';

export default function PersonDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: contact, error, reload } = useFetch(`/api/contacts/${id}`);
  const { data: companies } = useFetch('/api/companies');
  const [modal, setModal] = useState(null); // 'edit' | 'log'

  if (error) return <div className="page"><div className="form-error">{error}</div></div>;
  if (!contact) return <div className="page" />;

  const closeAndReload = () => { setModal(null); reload(); };

  const setStatus = async (conversation_status) => {
    await api.patch(`/api/contacts/${contact.id}`, { conversation_status });
    reload();
  };

  const deleteContact = async () => {
    if (!window.confirm(`Delete ${contact.name}? Their interaction history goes too.`)) return;
    await api.del(`/api/contacts/${contact.id}`);
    navigate('/people');
  };

  const deleteActivity = async (a) => {
    if (!window.confirm('Delete this entry?')) return;
    await api.del(`/api/activities/${a.id}`);
    reload();
  };

  return (
    <div className="page">
      <Link to="/people" className="back-link">← All people</Link>
      <div className="page-header">
        <div>
          <h1>{contact.name}</h1>
          <div className="page-sub company-cell">
            {contact.role_title}
            {contact.company_id && (
              <>
                {contact.role_title && '· '}
                <CompanyLogo name={contact.company_name} website={contact.company_website} size={18} />
                <Link to={`/companies/${contact.company_id}`}>{contact.company_name}</Link>
              </>
            )}
            {' '}<TypeBadge type={contact.contact_type} />
          </div>
        </div>
        <div className="header-actions">
          <select className="stage-select" value={contact.conversation_status} onChange={(e) => setStatus(e.target.value)}>
            {Object.entries(CONVERSATION_STATUSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button className="btn btn-primary" onClick={() => setModal('log')}>+ Log interaction</button>
          <button className="btn" onClick={() => setModal('edit')}>Edit</button>
          <button className="btn btn-danger" onClick={deleteContact}>Delete</button>
        </div>
      </div>

      <div className="detail-grid">
        <div className="detail-main">
          <div className="card">
            <h2>Interaction history</h2>
            <Timeline
              activities={contact.activities.map((a) => ({ ...a, contact_name: null }))}
              onDelete={deleteActivity}
            />
          </div>
        </div>

        <div className="detail-side">
          <div className="card">
            <h2>Details</h2>
            <dl className="detail-list detail-list-stack">
              <div><dt>Email</dt><dd>{contact.email ? <a href={`mailto:${contact.email}`}>{contact.email}</a> : '—'}</dd></div>
              <div><dt>Phone</dt><dd>{contact.phone || '—'}</dd></div>
              <div><dt>LinkedIn</dt><dd>{contact.linkedin_url ? <a href={contact.linkedin_url} target="_blank" rel="noreferrer">profile</a> : '—'}</dd></div>
              <div><dt>Last contacted</dt><dd>{fmtDate(contact.last_contacted) || '—'}</dd></div>
              <div><dt>Next follow-up</dt><dd><DueBadge date={contact.next_followup_due} /> {!contact.next_followup_due && '—'}</dd></div>
            </dl>
            {contact.notes && (
              <>
                <h3>Notes</h3>
                <p className="prewrap">{contact.notes}</p>
              </>
            )}
          </div>

          <div className="card">
            <h2>Linked jobs</h2>
            {contact.jobs.length === 0 && <div className="empty">Not linked to any jobs.</div>}
            {contact.jobs.map((j) => (
              <div className="side-item" key={j.id}>
                <Link to={`/jobs/${j.id}`} className="side-item-title">{j.title}</Link>
                <div className="muted-small">{j.company_name}{j.relationship ? ` · ${j.relationship}` : ''}</div>
                <div className="badge-row">
                  <StageBadge stage={j.stage} />
                  {!!j.is_referrer && <ReferralBadge name={contact.name} />}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {modal === 'edit' && (
        <ContactFormModal contact={contact} companies={companies} onClose={() => setModal(null)} onSaved={closeAndReload} />
      )}
      {modal === 'log' && (
        <LogInteractionModal contact={contact} onClose={() => setModal(null)} onSaved={closeAndReload} />
      )}
    </div>
  );
}
