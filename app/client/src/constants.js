export const STAGES = ['Interested', 'Applied', 'Screening', 'Interviewing', 'Offer', 'Accepted', 'Rejected', 'Withdrawn'];
export const TERMINAL_STAGES = ['Accepted', 'Rejected', 'Withdrawn'];

export const STAGE_COLORS = {
  Interested: '#64748b',
  Applied: '#2563eb',
  Screening: '#d97706',
  Interviewing: '#7c3aed',
  Offer: '#059669',
  Accepted: '#16a34a',
  Rejected: '#dc2626',
  Withdrawn: '#94a3b8',
};

export const CONTACT_TYPES = {
  recruiter: 'Recruiter',
  hiring_manager: 'Hiring manager',
  connection: 'Connection',
  other: 'Other',
};

export const CONTACT_TYPE_COLORS = {
  recruiter: '#2563eb',
  hiring_manager: '#7c3aed',
  connection: '#059669',
  other: '#64748b',
};

export const CONVERSATION_STATUSES = {
  not_contacted: 'Not contacted',
  reached_out: 'Reached out',
  in_conversation: 'In conversation',
  awaiting_reply: 'Awaiting reply',
  follow_up_needed: 'Follow-up needed',
  dormant: 'Dormant',
};

export const STATUS_COLORS = {
  not_contacted: '#94a3b8',
  reached_out: '#2563eb',
  in_conversation: '#059669',
  awaiting_reply: '#d97706',
  follow_up_needed: '#dc2626',
  dormant: '#64748b',
};

export const ACTIVITY_TYPES = {
  note: 'Note',
  email: 'Email',
  call: 'Call',
  meeting: 'Meeting',
  interview: 'Interview',
  task: 'Task',
  other: 'Other',
};

export const ACTIVITY_ICONS = {
  note: '📝',
  email: '✉️',
  call: '📞',
  meeting: '🤝',
  interview: '🎤',
  task: '✅',
  stage_change: '➡️',
  status_change: '🔄',
  other: '📌',
};

export const DOC_TYPES = {
  cv: 'CV',
  cover_letter: 'Cover letter',
  other: 'Other',
};
