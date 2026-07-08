import { Link } from 'react-router-dom';
import { useFetch } from '../hooks';
import { StageBadge, StatusBadge, TypeBadge, DueBadge } from '../components/Badges';
import { ACTIVITY_ICONS } from '../constants';
import { fmtDate, isOverdue } from '../utils';

export default function Dashboard() {
  const { data, error } = useFetch('/api/dashboard');
  if (error) return <div className="page"><div className="form-error">{error}</div></div>;
  if (!data) return <div className="page" />;

  const { counts, job_next_steps, contact_followups, recent_activity } = data;

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
        </div>

        <div className="card">
          <h2>People to follow up with</h2>
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
        </div>
      </div>

      <div className="card">
        <h2>Recent activity</h2>
        {recent_activity.length === 0 && <div className="empty">Activity will appear here as you work your pipeline.</div>}
        {recent_activity.map((a) => (
          <div className="feed-row" key={a.id}>
            <span className="feed-icon">{ACTIVITY_ICONS[a.activity_type] || '📌'}</span>
            <span className="feed-title">{a.title}</span>
            <span className="feed-context">
              {a.job_title && <Link to={`/jobs/${a.job_id}`}>{a.job_title}{a.company_name ? ` · ${a.company_name}` : ''}</Link>}
              {!a.job_title && a.contact_name && <Link to={`/people/${a.contact_id}`}>{a.contact_name}</Link>}
            </span>
            <span className="feed-date">{fmtDate(a.occurred_at)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
