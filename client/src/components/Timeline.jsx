import { Link } from 'react-router-dom';
import { ACTIVITY_ICONS } from '../constants';
import { fmtDate } from '../utils';

export default function Timeline({ activities, onDelete }) {
  if (!activities.length) return <div className="empty">No activity yet.</div>;
  return (
    <div className="timeline">
      {activities.map((a) => (
        <div className="timeline-item" key={a.id}>
          <div className="timeline-icon">{ACTIVITY_ICONS[a.activity_type] || '📌'}</div>
          <div className="timeline-body">
            <div className="timeline-title-row">
              <span className="timeline-title">{a.title}</span>
              <span className="timeline-date">{fmtDate(a.occurred_at)}</span>
            </div>
            {a.detail && <div className="timeline-detail">{a.detail}</div>}
            <div className="timeline-meta">
              {a.contact_name && (
                <Link className="chip" to={`/people/${a.contact_id}`}>👤 {a.contact_name}</Link>
              )}
              {a.job_title && (
                <Link className="chip" to={`/jobs/${a.job_id}`}>💼 {a.job_title}</Link>
              )}
              {onDelete && (
                <button className="link-danger" onClick={() => onDelete(a)}>delete</button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
