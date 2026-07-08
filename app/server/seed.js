// Loads a small set of sample data so the app has something to show on first run.
// Safe to run once only — it refuses to seed a non-empty database.
const { db } = require('./db');
const { logActivity } = require('./helpers');

if (db.prepare('SELECT COUNT(*) AS n FROM companies').get().n > 0) {
  console.log('Database already has data — not seeding. Delete the data/ folder to start fresh.');
  process.exit(0);
}

const day = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const addCompany = db.prepare('INSERT INTO companies (name, website, location, industry, summary, description) VALUES (?, ?, ?, ?, ?, ?)');
const acme = addCompany.run('Acme Corp', 'https://acme.example.com', 'London, UK', 'Fintech',
  'B2B payments infrastructure for online marketplaces.',
  'Acme provides payment rails and payout tooling for marketplaces and platforms, competing with the likes of Stripe Connect. Series C, ~400 people.').lastInsertRowid;
const nimbus = addCompany.run('Nimbus Labs', 'https://nimbus.example.com', 'Remote (UK)', 'Cloud / SaaS',
  'Developer platform for deploying and scaling cloud apps.',
  'Nimbus is a PaaS that lets engineering teams ship and scale services without managing infrastructure. Remote-first, ~120 people.').lastInsertRowid;
const orbital = addCompany.run('Orbital Media', 'https://orbital.example.com', 'Manchester, UK', 'Media',
  'Digital publisher running several consumer news brands.',
  'Orbital runs a portfolio of consumer news and lifestyle titles, monetised through advertising and subscriptions.').lastInsertRowid;

const addJob = db.prepare(`
  INSERT INTO jobs (company_id, title, location, salary_range, source, stage, applied_date, next_step, next_step_due, summary)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
const j1 = addJob.run(acme, 'Senior Product Manager', 'London (hybrid)', '£85–95k', 'LinkedIn',
  'Interviewing', day(-14), 'Prepare for panel interview', day(2),
  'Own the payments product line; lead a squad of 6.').lastInsertRowid;
const j2 = addJob.run(acme, 'Product Lead, Payments', 'London (hybrid)', '£100–110k', 'Referral',
  'Applied', day(-5), 'Chase recruiter for update', day(-1),
  'Set payments strategy across the whole platform.').lastInsertRowid;
const j3 = addJob.run(nimbus, 'Product Manager, Platform', 'Remote', '£75–85k', 'Company site',
  'Screening', day(-8), 'Complete take-home task', day(3),
  'Shape the core developer platform and its APIs.').lastInsertRowid;
const j4 = addJob.run(orbital, 'Head of Product', 'Manchester', '', 'Otta',
  'Interested', null, 'Tailor CV and apply', day(1),
  'Build and run the product function from the ground up.').lastInsertRowid;

const addContact = db.prepare(`
  INSERT INTO contacts (name, company_id, role_title, contact_type, email, conversation_status, last_contacted, next_followup_due)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
const sarah = addContact.run('Sarah Chen', acme, 'Senior Talent Partner', 'recruiter',
  'sarah.chen@acme.example.com', 'in_conversation', day(-3), day(1)).lastInsertRowid;
const marcus = addContact.run('Marcus Webb', acme, 'VP Product', 'hiring_manager',
  'm.webb@acme.example.com', 'awaiting_reply', day(-6), day(-2)).lastInsertRowid;
const priya = addContact.run('Priya Patel', nimbus, 'Talent Acquisition', 'recruiter',
  'priya@nimbus.example.com', 'reached_out', day(-2), day(4)).lastInsertRowid;
const dan = addContact.run('Dan Okafor', null, 'Former colleague — now at Orbital', 'connection',
  '', 'follow_up_needed', day(-10), day(0)).lastInsertRowid;

const link = db.prepare('INSERT INTO job_contacts (job_id, contact_id, relationship) VALUES (?, ?, ?)');
link.run(j1, sarah, 'Recruiter for this role');
link.run(j1, marcus, 'Hiring manager');
link.run(j2, sarah, 'Recruiter for this role');
link.run(j3, priya, 'Recruiter for this role');
link.run(j4, dan, 'Possible referral');

logActivity({ job_id: j1, activity_type: 'interview', title: 'First-round interview with Marcus', detail: 'Went well — focus on payments strategy. Panel next.', occurred_at: day(-4) });
logActivity({ job_id: j1, contact_id: sarah, activity_type: 'call', title: 'Call with Sarah re: panel format', detail: '3 interviewers, 90 minutes, case study included.', occurred_at: day(-3) });
logActivity({ job_id: j2, activity_type: 'email', title: 'Application submitted via referral', occurred_at: day(-5) });
logActivity({ job_id: j3, activity_type: 'email', title: 'Received take-home task', detail: 'Due back within a week.', occurred_at: day(-2) });
logActivity({ contact_id: dan, activity_type: 'note', title: 'Dan mentioned Head of Product opening', detail: 'Said he can intro me to their COO.', occurred_at: day(-10) });

console.log('Seeded sample data: 3 companies, 4 jobs, 4 contacts, 5 activities.');
