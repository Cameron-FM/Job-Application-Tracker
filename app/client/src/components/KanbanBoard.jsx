import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { STAGES, STAGE_COLORS } from '../constants';
import { DueBadge, ReferralBadge, TagBadgeRow } from './Badges';
import CompanyLogo from './CompanyLogo';

export default function KanbanBoard({ jobs, onMove, hideInterested }) {
  const [dropStage, setDropStage] = useState(null);
  const navigate = useNavigate();
  const visibleStages = hideInterested ? STAGES.filter((s) => s !== 'Interested') : STAGES;

  return (
    <div className="kanban" style={{ '--kanban-col-w': hideInterested ? '292px' : '232px' }}>
      {visibleStages.map((stage) => {
        const cards = jobs.filter((j) => j.stage === stage);
        return (
          <div
            key={stage}
            className={`kanban-col${dropStage === stage ? ' drop-target' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDropStage(stage); }}
            onDragLeave={() => setDropStage(null)}
            onDrop={(e) => {
              e.preventDefault();
              setDropStage(null);
              const id = Number(e.dataTransfer.getData('text/plain'));
              if (id) onMove(id, stage);
            }}
          >
            <div className="kanban-col-header">
              <span className="stage-dot" style={{ background: STAGE_COLORS[stage] }} />
              <span>{stage}</span>
              <span className="kanban-count">{cards.length}</span>
            </div>
            {cards.map((job) => (
              <div
                key={job.id}
                className="kanban-card"
                draggable
                onDragStart={(e) => e.dataTransfer.setData('text/plain', String(job.id))}
                onClick={() => navigate(`/jobs/${job.id}`)}
              >
                <div className="kanban-card-title">{job.title}</div>
                <div className="kanban-card-company">
                  <CompanyLogo name={job.company_name} website={job.company_website} size={16} />
                  {job.company_name}
                </div>
                {job.summary && <div className="kanban-card-summary">{job.summary}</div>}
                <TagBadgeRow tags={job.tags} />
                <div className="kanban-card-footer">
                  <DueBadge date={job.next_step_due} />
                  <ReferralBadge name={job.referred_by_name} hideIfOpen />
                  {job.contact_count > 0 && <span className="muted-small">👤 {job.contact_count}</span>}
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
