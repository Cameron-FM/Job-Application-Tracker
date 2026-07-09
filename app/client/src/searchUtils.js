import { ACTIVITY_TYPES, ACTIVITY_ICONS, DOC_TYPES } from './constants';

export const RECORD_TYPES = {
  job: { label: 'Job', plural: 'Jobs', icon: '💼' },
  company: { label: 'Company', plural: 'Companies', icon: '🏢' },
  contact: { label: 'Person', plural: 'People', icon: '👥' },
  document: { label: 'Document', plural: 'Documents', icon: '📄' },
  activity: { label: 'Activity', plural: 'Activities', icon: '📌' },
};

// Where clicking a result should go. Documents have no per-record detail page — clicking one
// opens the file itself (an /api URL, not a client route) rather than the Documents list page.
function routeFor(r) {
  switch (r.type) {
    case 'job': return `/jobs/${r.id}`;
    case 'company': return `/companies/${r.id}`;
    case 'contact': return `/people/${r.id}`;
    case 'document': return `/api/documents/${r.id}/file`;
    case 'activity': return r.job_id ? `/jobs/${r.job_id}` : r.contact_id ? `/people/${r.contact_id}` : null;
    default: return null;
  }
}

function subtitleFor(r) {
  switch (r.type) {
    case 'job': return [r.company_name, r.stage].filter(Boolean).join(' · ');
    case 'company': return [r.industry, r.location].filter(Boolean).join(' · ');
    case 'contact': return [r.role_title, r.company_name].filter(Boolean).join(' · ');
    case 'document': return DOC_TYPES[r.doc_type] || r.doc_type;
    case 'activity':
      return [ACTIVITY_TYPES[r.activity_type] || r.activity_type, r.job_title || r.contact_name]
        .filter(Boolean).join(' · ');
    default: return '';
  }
}

// Turns a raw /api/search result row into everything a result row needs to render:
// icon, human type label, subtitle, and the route clicking it should navigate to.
export function annotateResult(r) {
  const meta = RECORD_TYPES[r.type] || { label: r.type, icon: '📌' };
  const icon = r.type === 'activity' ? (ACTIVITY_ICONS[r.activity_type] || meta.icon) : meta.icon;
  return {
    key: `${r.type}-${r.id}`,
    type: r.type,
    typeLabel: meta.label,
    icon,
    title: r.title,
    subtitle: subtitleFor(r),
    to: routeFor(r),
    external: r.type === 'document', // open in a new tab instead of client-side navigating
    date: r.date,
    score: r.score,
  };
}
