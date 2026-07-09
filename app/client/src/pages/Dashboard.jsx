import { Link, useNavigate } from 'react-router-dom';
import { useFetch } from '../hooks';
import { StageBadge, StatusBadge, TypeBadge, DueBadge } from '../components/Badges';
import CompanyLogo from '../components/CompanyLogo';
import ScrollCapped from '../components/ScrollCapped';
import { isOverdue } from '../utils';

export default function Dashboard() {
  const { data, error } = useFetch('/api/dashboard');
  const { data: toApply } = useFetch('/api/jobs?stage=Interested');
  const navigate = useNavigate();
  if (error) return <div className="page"><div className="form-error">{error}</div></div>;
  if (!data) return <div className="page" />;

  const { counts, job_next_steps, contact_followups } = data;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Dashboard</h1>
        <Link to="/jobs" className="btn btn-primary">+ Add job</Link>
      </div>

      <div className="stats">
        <div className="stat">
          <div className="stat-value">{counts.active_jobs}</div>
          <div className="stat-label">Active applications</div>
        </div>
        <div className="stat">
          <div className="stat-value">{counts.interviewing}</div>
          <div className="stat-label">In screening / interviews</div>
        </div>
        <div className="stat">
          <div className="stat-value">{counts.offers}</div>
          <div className="stat-label">Offers</div>
        </div>
        <div className={`stat${counts.overdue > 0 ? ' stat-alert' : ''}`}>
          <div className="stat-value">{counts.overdue}</div>
          <div className="stat-label">Overdue items</div>
        </div>
        <div className="stat">
          <div className="stat-value">{counts.referred}</div>
          <div className="stat-label">Referred applications</div>
        </div>
      </div>

      <div className="two-col">
        <div className="card">
          <h2>Next steps on jobs</h2>
          <ScrollCapped rows={3}>
            {job_next_steps.length === 0 && <div className="empty">Nothing planned. Add next steps to your jobs.</div>}
            {job_next_steps.map((j) => (
              <Link to={`/jobs/${j.id}`} key={j.id} className={`list-row${isOverdue(j.next_step_due) ? ' row-overdue' : ''}`}>
                <div className="list-main">
                  <div className="list-title">{j.next_step || 'No next step set'}</div>
                  <div className="list-sub">{j.title} · {j.company_name}</div>
                </div>
                <div className="list-side">
                  <StageBadge stage={j.stage} />
                  <DueBadge date={j.next_step_due} />
                </div>
              </Link>
            ))}
          </ScrollCapped>
        </div>

        <div className="card">
          <h2>People to follow up with</h2>
          <ScrollCapped rows={3}>
            {contact_followups.length === 0 && <div className="empty">No follow-ups scheduled.</div>}
            {contact_followups.map((c) => (
              <Link to={`/people/${c.id}`} key={c.id} className={`list-row${isOverdue(c.next_followup_due) ? ' row-overdue' : ''}`}>
                <div className="list-main">
                  <div className="list-title">{c.name}</div>
                  <div className="list-sub">{[c.role_title, c.company_name].filter(Boolean).join(' · ')}</div>
                </div>
                <div className="list-side">
                  <TypeBadge type={c.contact_type} />
                  <StatusBadge status={c.conversation_status} />
                  <DueBadge date={c.next_followup_due} />
                </div>
              </Link>
            ))}
          </ScrollCapped>
        </div>
      </div>

      <div className="card">
        <h2>Apply</h2>
        {toApply && toApply.length === 0 && <div className="empty">Nothing waiting on an application — every "Interested" job has moved on.</div>}
        {toApply && toApply.length > 0 && (
          <ScrollCapped rows={3} className="job-board-grid">
            {toApply.map((j) => (
              <div className="job-board-card" key={j.id} onClick={() => navigate(`/jobs/${j.id}`)}>
                <div className="job-board-title">{j.title}</div>
                <div className="job-board-company">
                  <CompanyLogo name={j.company_name} website={j.company_website} size={20} />
                  {j.company_name}
                </div>
                {j.summary && <div className="job-board-summary">{j.summary}</div>}
                <div className="job-board-footer">
                  <span className="muted-small">{j.contact_count > 0 ? `👤 ${j.contact_count}` : ''}</span>
                  {(j.application_url || j.url) && (
                    <a
                      className="btn btn-primary btn-sm"
                      href={j.application_url || j.url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Apply ↗
                    </a>
                  )}
                </div>
              </div>
            ))}
          </ScrollCapped>
        )}
      </div>
    </div>
  );
}
