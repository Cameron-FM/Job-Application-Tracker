import { STAGE_COLORS, CONTACT_TYPES, CONTACT_TYPE_COLORS, CONVERSATION_STATUSES, STATUS_COLORS } from '../constants';
import { fmtDate, isOverdue, isToday } from '../utils';

export function Pill({ color, children }) {
  return (
    <span className="badge" style={{ background: `${color}1f`, color }}>
      {children}
    </span>
  );
}

export function StageBadge({ stage }) {
  return <Pill color={STAGE_COLORS[stage] || '#64748b'}>{stage}</Pill>;
}

export function TypeBadge({ type }) {
  return <Pill color={CONTACT_TYPE_COLORS[type] || '#64748b'}>{CONTACT_TYPES[type] || type}</Pill>;
}

export function StatusBadge({ status }) {
  return <Pill color={STATUS_COLORS[status] || '#64748b'}>{CONVERSATION_STATUSES[status] || status}</Pill>;
}

export function DueBadge({ date }) {
  if (!date) return null;
  if (isOverdue(date)) return <Pill color="#dc2626">Overdue · {fmtDate(date)}</Pill>;
  if (isToday(date)) return <Pill color="#d97706">Due today</Pill>;
  return <Pill color="#64748b">Due {fmtDate(date)}</Pill>;
}

// By default shows a badge either way; pass hideIfOpen to only show referred jobs
// (handy in dense views like the kanban board where "Open application" everywhere is noise).
export function ReferralBadge({ name, hideIfOpen }) {
  if (!name) return hideIfOpen ? null : <Pill color="#64748b">Open application</Pill>;
  return <Pill color="#0891b2">Referred by {name}</Pill>;
}

// A row of a record's tags — pass the `.tags` array attached by the server ([{id, name, color}]).
export function TagBadgeRow({ tags }) {
  if (!tags || tags.length === 0) return null;
  return (
    <span className="badge-row tag-badge-row">
      {tags.map((t) => <Pill key={t.id} color={t.color}>{t.name}</Pill>)}
    </span>
  );
}

// A company with no *open* roles right now — either nothing tracked at all, or every job
// tracked there has closed out (Accepted or Rejected/Withdrawn). activeJobCount should be
// the count of jobs NOT in a terminal stage (the list endpoint's active_job_count, or a
// detail page's jobs filtered against TERMINAL_STAGES) — not just total job count.
export function WatchlistBadge({ activeJobCount }) {
  if (activeJobCount > 0) return null;
  return (
    <span className="badge watchlist-badge" title="No open roles tracked right now — on your watchlist">
      👀 Watching
    </span>
  );
}
