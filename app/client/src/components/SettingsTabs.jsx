import { NavLink } from 'react-router-dom';

export default function SettingsTabs() {
  return (
    <nav className="settings-tabs">
      <NavLink to="/settings/preferences" className={({ isActive }) => `settings-tab${isActive ? ' active' : ''}`}>
        ⚙️ Preferences
      </NavLink>
      <NavLink to="/settings/backups" className={({ isActive }) => `settings-tab${isActive ? ' active' : ''}`}>
        ☁️ Backups
      </NavLink>
      <NavLink to="/settings/tags" className={({ isActive }) => `settings-tab${isActive ? ' active' : ''}`}>
        🏷️ Tags
      </NavLink>
    </nav>
  );
}
