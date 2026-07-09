import { NavLink } from 'react-router-dom';
import TextTooltip from './TextTooltip';
import GlobalSearch from './GlobalSearch';
import StageCelebration from './StageCelebration';
import RejectionReasonModal from './RejectionReasonModal';

const NAV = [
  { to: '/', label: 'Dashboard', icon: '🏠', end: true },
  { to: '/jobs', label: 'Jobs', icon: '💼' },
  { to: '/companies', label: 'Companies', icon: '🏢' },
  { to: '/people', label: 'People', icon: '👥' },
  { to: '/cvs', label: 'Documents', icon: '📄' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
];

export default function Layout({ children }) {
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">JT</span>
          <span>Job Tracker</span>
        </div>
        <nav>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">Runs locally · backups in Settings</div>
      </aside>
      <main className="content">
        <header className="topbar">
          <GlobalSearch />
        </header>
        {children}
      </main>
      <TextTooltip />
      <StageCelebration />
      <RejectionReasonModal />
    </div>
  );
}
