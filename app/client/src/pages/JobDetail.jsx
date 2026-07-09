import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useFetch } from '../hooks';
import { STAGES, REJECTED_WITHDRAWN_STAGE } from '../constants';
import { celebrateStageChange } from '../stageEffects';
import { askRejectionReason } from '../rejectionReasonPrompt';
import { StatusBadge, TypeBadge, DueBadge, ReferralBadge } from '../components/Badges';
import TagsCard from '../components/TagsCard';
import Timeline from '../components/Timeline';
import { JobFormModal, LinkContactModal, AttachDocModal, ActivityFormModal, CompanyDatalist } from '../components/forms';
import CompanyLogo from '../components/CompanyLogo';
import { fmtDate } from '../utils';

export default function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: job, error, reload } = useFetch(`/api/jobs/${id}`);
  const { data: companies } = useFetch('/api/companies');
  const [modal, setModal] = useState(null); // 'edit' | 'contact' | 'doc' | 'activity'
  const [nextStep, setNextStep] = useState(null); // local edit state for the next-step box

  if (error) return <div className="page"><div className="form-error">{error}</div></div>;
  if (!job) return <div className="page" />;

  const closeAndReload = () => { setModal(null); reload(); };

  const setStage = async (stage) => {
    const oldStage = job.stage;
    const payload = { stage };
    if (stage === REJECTED_WITHDRAWN_STAGE && oldStage !== REJECTED_WITHDRAWN_STAGE) {
      const reason = await askRejectionReason();
      if (!reason) return; // cancelled — the <select> reverts on its own since it reflects job.stage
      payload.rejection_reason = reason;
    }
    await api.patch(`/api/jobs/${job.id}`, payload);
    celebrateStageChange(oldStage, stage);
    reload();
  };

  const saveNextStep = async () => {
    await api.patch(`/api/jobs/${job.id}`, nextStep);
    setNextStep(null);
    reload();
  };

  const deleteJob = async () => {
    if (!window.confirm(`Delete "${job.title}" at ${job.company_name}? This also removes its timeline.`)) return;
    await api.del(`/api/jobs/${job.id}`);
    navigate('/jobs');
  };

  const unlinkContact = async (c) => {
    await api.del(`/api/jobs/${job.id}/contacts/${c.id}`);
    reload();
  };

  const setTags = async (tagIds) => {
    await api.patch(`/api/jobs/${job.id}`, { tags: tagIds });
    reload();
  };

  const toggleReferrer = async (c) => {
    const isCurrent = job.referred_by_contact_id === c.id;
    await api.patch(`/api/jobs/${job.id}`, { referred_by_contact_id: isCurrent ? null : c.id });
    reload();
  };

  const detachDoc = async (d) => {
    await api.del(`/api/jobs/${job.id}/documents/${d.id}`);
    reload();
  };

  const deleteActivity = async (a) => {
    if (!window.confirm('Delete this timeline entry?')) return;
    await api.del(`/api/activities/${a.id}`);
    reload();
  };

  const ns = nextStep || { next_step: job.next_step, next_step_due: job.next_step_due || '' };

  return (
    <div className="page">
      <Link to="/jobs" className="back-link">← All jobs</Link>
      <div className="page-header">
        <div>
          <h1>{job.title}</h1>
          <div className="page-sub company-cell">
            <CompanyLogo name={job.company_name} website={job.company_website} size={18} />
            <Link to={`/companies/${job.company_id}`}>{job.company_name}</Link>
            {job.location && <span> · {job.location}</span>}
            {job.salary_range && <span> · {job.salary_range}</span>}
          </div>
          {job.summary && <div className="page-summary">{job.summary}</div>}
          <div className="badge-row" style={{ marginTop: 8 }}>
            <ReferralBadge name={job.referred_by_name} />
          </div>
        </div>
        <div className="header-actions">
          <select className="stage-select" value={job.stage} onChange={(e) => setStage(e.target.value)}>
            {STAGES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <button className="btn" onClick={() => setModal('edit')}>Edit</button>
          <button className="btn btn-danger" onClick={deleteJob}>Delete</button>
        </div>
      </div>

      <div className="detail-grid">
        <div className="detail-main">
          <div className="card">
            <h2>Next step</h2>
            <div className="next-step-row">
              <input
                value={ns.next_step}
                placeholder="What's the next action on this job?"
                onChange={(e) => setNextStep({ ...ns, next_step: e.target.value })}
              />
              <input
                type="date"
                value={ns.next_step_due}
                onChange={(e) => setNextStep({ ...ns, next_step_due: e.target.value })}
              />
              {nextStep && <button className="btn btn-primary btn-sm" onClick={saveNextStep}>Save</button>}
              {!nextStep && <DueBadge date={job.next_step_due} />}
            </div>
          </div>

          <div className="card">
            <h2>Details</h2>
            <dl className="detail-list">
              <div><dt>Applied</dt><dd>{fmtDate(job.applied_date) || 'Not yet applied'}</dd></div>
              <div><dt>Source</dt><dd>{job.source || '—'}</dd></div>
              <div><dt>Posting</dt><dd>{job.url ? <a href={job.url} target="_blank" rel="noreferrer">View posting ↗</a> : '—'}</dd></div>
              <div><dt>Application form</dt><dd>{job.application_url ? <a href={job.application_url} target="_blank" rel="noreferrer">Open application ↗</a> : '—'}</dd></div>
              {job.rejection_reason && <div><dt>Reason</dt><dd>{job.rejection_reason}</dd></div>}
            </dl>
            {job.description && (
              <>
                <h3>Job description</h3>
                <p className="prewrap">{job.description}</p>
              </>
            )}
            {job.notes && (
              <>
                <h3>Notes</h3>
                <p className="prewrap">{job.notes}</p>
              </>
            )}
            {job.raw_posting && (
              <details className="raw-posting">
                <summary>Original posting</summary>
                <p className="prewrap">{job.raw_posting}</p>
              </details>
            )}
          </div>

          <div className="card">
            <div className="card-header">
              <h2>Timeline</h2>
              <button className="btn btn-sm" onClick={() => setModal('activity')}>+ Add entry</button>
            </div>
            <Timeline
              activities={job.activities.map((a) => ({ ...a, job_title: null }))}
              onDelete={deleteActivity}
            />
          </div>
        </div>

        <div className="detail-side">
          <TagsCard tags={job.tags} onChange={setTags} />

          <div className="card">
            <div className="card-header">
              <h2>People</h2>
              <button className="btn btn-sm" onClick={() => setModal('contact')}>+ Add</button>
            </div>
            {job.contacts.length === 0 && <div className="empty">No people linked yet.</div>}
            {job.contacts.map((c) => {
              const isReferrer = job.referred_by_contact_id === c.id;
              return (
                <div className="side-item" key={c.id}>
                  <Link to={`/people/${c.id}`} className="side-item-title">{c.name}</Link>
                  {c.relationship && <div className="muted-small">{c.relationship}</div>}
                  <div className="badge-row">
                    <TypeBadge type={c.contact_type} />
                    <StatusBadge status={c.conversation_status} />
                    {isReferrer && <ReferralBadge name={c.name} />}
                  </div>
                  <div className="badge-row">
                    <button className={isReferrer ? 'link' : 'link-muted'} onClick={() => toggleReferrer(c)}>
                      {isReferrer ? '✓ referred you' : 'mark as referrer'}
                    </button>
                    <button className="link-danger" onClick={() => unlinkContact(c)}>unlink</button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="card">
            <div className="card-header">
              <h2>Documents</h2>
              <button className="btn btn-sm" onClick={() => setModal('doc')}>+ Attach</button>
            </div>
            {job.documents.length === 0 && <div className="empty">No CV attached yet.</div>}
            {job.documents.map((d) => (
              <div className="side-item" key={d.id}>
                <a href={`/api/documents/${d.id}/file`} target="_blank" rel="noreferrer" className="side-item-title">📄 {d.label}</a>
                <div className="muted-small">{d.filename}</div>
                <div className="badge-row">
                  <a className="link" href={`/api/documents/${d.id}/file?download=1`}>download</a>
                  <button className="link-danger" onClick={() => detachDoc(d)}>detach</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {modal === 'edit' && (
        <JobFormModal job={job} companies={companies} onClose={() => setModal(null)} onSaved={closeAndReload} />
      )}
      {modal === 'contact' && (
        <LinkContactModal job={job} onClose={() => setModal(null)} onSaved={closeAndReload} />
      )}
      {modal === 'doc' && (
        <AttachDocModal job={job} onClose={() => setModal(null)} onSaved={closeAndReload} />
      )}
      {modal === 'activity' && (
        <ActivityFormModal jobId={job.id} linkableContacts={job.contacts} onClose={() => setModal(null)} onSaved={closeAndReload} />
      )}
      <CompanyDatalist companies={companies} />
    </div>
  );
}
