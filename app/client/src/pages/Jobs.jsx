import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useFetch } from '../hooks';
import { STAGES, TERMINAL_STAGES, REJECTED_WITHDRAWN_STAGE } from '../constants';
import { celebrateStageChange } from '../stageEffects';
import { askRejectionReason } from '../rejectionReasonPrompt';
import { StageBadge, DueBadge, ReferralBadge, TagBadgeRow } from '../components/Badges';
import CompanyLogo from '../components/CompanyLogo';
import KanbanBoard from '../components/KanbanBoard';
import { JobFormModal } from '../components/forms';
import { fmtDate } from '../utils';

const SORTS = {
  updated: (a, b) => (a.updated_at < b.updated_at ? 1 : -1),
  company: (a, b) => a.company_name.localeCompare(b.company_name),
  title: (a, b) => a.title.localeCompare(b.title),
  stage: (a, b) => STAGES.indexOf(a.stage) - STAGES.indexOf(b.stage),
  applied: (a, b) => (a.applied_date || '9999') < (b.applied_date || '9999') ? -1 : 1,
  due: (a, b) => (a.next_step_due || '9999') < (b.next_step_due || '9999') ? -1 : 1,
};

export default function Jobs() {
  const { data: jobs, reload } = useFetch('/api/jobs');
  const { data: companies } = useFetch('/api/companies');
  const { data: allTags } = useFetch('/api/tags');
  const [q, setQ] = useState('');
  const [stage, setStage] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [tagId, setTagId] = useState('');
  const [referred, setReferred] = useState('');
  const [hideClosed, setHideClosed] = useState(false);
  const [view, setView] = useState(() => localStorage.getItem('jobs-view') || 'table');
  const [hideInterested, setHideInterested] = useState(() => localStorage.getItem('kanban-hide-interested') === '1');
  const [sort, setSort] = useState('updated');
  const [showForm, setShowForm] = useState(false);
  const navigate = useNavigate();

  const switchView = (v) => { setView(v); localStorage.setItem('jobs-view', v); };
  const toggleHideInterested = (checked) => {
    setHideInterested(checked);
    localStorage.setItem('kanban-hide-interested', checked ? '1' : '0');
  };

  const filtered = useMemo(() => {
    if (!jobs) return [];
    const term = q.trim().toLowerCase();
    return jobs
      .filter((j) => !stage || j.stage === stage)
      .filter((j) => !companyId || String(j.company_id) === companyId)
      .filter((j) => !tagId || (j.tags || []).some((t) => t.id === Number(tagId)))
      .filter((j) => !referred || (referred === '1' ? !!j.referred_by_contact_id : !j.referred_by_contact_id))
      .filter((j) => !hideInterested || j.stage !== 'Interested')
      .filter((j) => !hideClosed || !TERMINAL_STAGES.includes(j.stage))
      .filter((j) => !term || j.title.toLowerCase().includes(term) || j.company_name.toLowerCase().includes(term))
      .sort(SORTS[sort]);
  }, [jobs, q, stage, companyId, tagId, referred, hideInterested, hideClosed, sort]);

  const moveJob = async (id, newStage) => {
    const oldStage = jobs?.find((j) => j.id === id)?.stage;
    const payload = { stage: newStage };
    if (newStage === REJECTED_WITHDRAWN_STAGE && oldStage !== REJECTED_WITHDRAWN_STAGE) {
      const reason = await askRejectionReason();
      if (!reason) return; // cancelled — no reload happened, so the card stays in its old column
      payload.rejection_reason = reason;
    }
    await api.patch(`/api/jobs/${id}`, payload);
    celebrateStageChange(oldStage, newStage);
    reload();
  };

  const Th = ({ id, children }) => (
    <th className={sort === id ? 'sorted' : ''} onClick={() => setSort(id)}>{children}</th>
  );

  return (
    <div className="page page-full">
      <div className="page-header">
        <h1>Jobs</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Add job</button>
      </div>

      <div className="toolbar">
        <input className="search" placeholder="Search title or company…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={stage} onChange={(e) => setStage(e.target.value)}>
          <option value="">All stages</option>
          {STAGES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
          <option value="">All companies</option>
          {(companies || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={tagId} onChange={(e) => setTagId(e.target.value)}>
          <option value="">All tags</option>
          {(allTags || []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select value={referred} onChange={(e) => setReferred(e.target.value)}>
          <option value="">Referred + open</option>
          <option value="1">Referred only</option>
          <option value="0">Open applications only</option>
        </select>
        <label className="check">
          <input type="checkbox" checked={hideClosed} onChange={(e) => setHideClosed(e.target.checked)} />
          Hide closed
        </label>
        <label className="check">
          <input type="checkbox" checked={hideInterested} onChange={(e) => toggleHideInterested(e.target.checked)} />
          {view === 'board' ? 'Hide "Interested" column' : 'Hide "Interested"'}
        </label>
        <div className="spacer" />
        <div className="toggle-row">
          <button className={`btn btn-sm${view === 'table' ? ' btn-primary' : ''}`} onClick={() => switchView('table')}>☰ Table</button>
          <button className={`btn btn-sm${view === 'board' ? ' btn-primary' : ''}`} onClick={() => switchView('board')}>▦ Board</button>
        </div>
      </div>

      {view === 'board' ? (
        <KanbanBoard jobs={filtered} onMove={moveJob} hideInterested={hideInterested} />
      ) : (
        <div className="card card-table">
          <table className="table">
            <thead>
              <tr>
                <Th id="company">Company</Th>
                <Th id="title">Job title</Th>
                <Th id="stage">Stage</Th>
                <th>Referral</th>
                <Th id="applied">Applied</Th>
                <th>Next step</th>
                <Th id="due">Due</Th>
                <th>People</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((j) => (
                <tr key={j.id} onClick={() => navigate(`/jobs/${j.id}`)}>
                  <td className="td-strong">
                    <span className="company-cell">
                      <CompanyLogo name={j.company_name} website={j.company_website} size={20} />
                      {j.company_name}
                    </span>
                  </td>
                  <td>
                    <div>{j.title}</div>
                    {j.summary && <div className="td-subtle">{j.summary}</div>}
                    <TagBadgeRow tags={j.tags} />
                  </td>
                  <td><StageBadge stage={j.stage} /></td>
                  <td><ReferralBadge name={j.referred_by_name} /></td>
                  <td className="td-muted">{fmtDate(j.applied_date) || '—'}</td>
                  <td className="td-truncate">{j.next_step || '—'}</td>
                  <td><DueBadge date={j.next_step_due} /></td>
                  <td className="td-muted">{j.contact_count || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="empty">No jobs match. Add your first job to get started.</div>}
        </div>
      )}

      {showForm && (
        <JobFormModal
          companies={companies}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); reload(); }}
        />
      )}
    </div>
  );
}
