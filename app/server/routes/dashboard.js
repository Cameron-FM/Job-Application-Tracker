const express = require('express');
const { db } = require('../db');
const { localToday } = require('../helpers');

const router = express.Router();

router.get('/', (req, res) => {
  const today = localToday();

  const counts = {
    total_jobs: db.prepare('SELECT COUNT(*) AS n FROM jobs').get().n,
    active_jobs: db.prepare(`SELECT COUNT(*) AS n FROM jobs WHERE stage NOT IN ('Accepted','Rejected/Withdrawn')`).get().n,
    interviewing: db.prepare(`SELECT COUNT(*) AS n FROM jobs WHERE stage IN ('Screening','Interviewing','Final Interview')`).get().n,
    offers: db.prepare(`SELECT COUNT(*) AS n FROM jobs WHERE stage = 'Offer'`).get().n,
    overdue: db.prepare(`SELECT COUNT(*) AS n FROM jobs WHERE next_step_due < ? AND stage NOT IN ('Accepted','Rejected/Withdrawn')`).get(today).n
      + db.prepare('SELECT COUNT(*) AS n FROM contacts WHERE next_followup_due < ?').get(today).n,
    referred: db.prepare('SELECT COUNT(*) AS n FROM jobs WHERE referred_by_contact_id IS NOT NULL').get().n,
  };

  const job_next_steps = db.prepare(`
    SELECT j.id, j.title, j.stage, j.next_step, j.next_step_due, c.name AS company_name
    FROM jobs j JOIN companies c ON c.id = j.company_id
    WHERE j.stage NOT IN ('Accepted','Rejected/Withdrawn')
      AND (j.next_step_due IS NOT NULL OR j.next_step != '')
    ORDER BY j.next_step_due IS NULL, j.next_step_due
  `).all();

  const contact_followups = db.prepare(`
    SELECT ct.id, ct.name, ct.contact_type, ct.conversation_status, ct.next_followup_due, ct.role_title,
           co.name AS company_name
    FROM contacts ct LEFT JOIN companies co ON co.id = ct.company_id
    WHERE ct.next_followup_due IS NOT NULL
    ORDER BY ct.next_followup_due
  `).all();

  const recent_activity = db.prepare(`
    SELECT a.*, j.title AS job_title, c.name AS company_name, ct.name AS contact_name
    FROM activities a
    LEFT JOIN jobs j ON j.id = a.job_id
    LEFT JOIN companies c ON c.id = j.company_id
    LEFT JOIN contacts ct ON ct.id = a.contact_id
    ORDER BY a.occurred_at DESC, a.id DESC
    LIMIT 15
  `).all();

  res.json({ today, counts, job_next_steps, contact_followups, recent_activity });
});

module.exports = router;
