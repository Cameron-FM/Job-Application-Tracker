import { useState } from 'react';
import SettingsTabs from '../components/SettingsTabs';
import { isCelebrationEnabled, setCelebrationEnabled } from '../stageEffects';

export default function SettingsPreferences() {
  const [saved, setSaved] = useState(isCelebrationEnabled);
  const [celebrationsOn, setCelebrationsOn] = useState(saved);
  const [notice, setNotice] = useState(null);

  const dirty = celebrationsOn !== saved;

  const save = () => {
    setCelebrationEnabled(celebrationsOn);
    setSaved(celebrationsOn);
    setNotice('Preferences saved.');
  };

  return (
    <div className="page">
      <div className="page-header"><h1>Settings</h1></div>
      <SettingsTabs />

      {notice && (
        <div className="notice notice-ok">
          {notice}
          <button className="btn-icon" onClick={() => setNotice(null)} aria-label="Dismiss">✕</button>
        </div>
      )}

      <div className="card">
        <div className="card-header"><h2>Preferences</h2></div>
        <label className="check full">
          <input type="checkbox" checked={celebrationsOn} onChange={(e) => setCelebrationsOn(e.target.checked)} />
          🎉 Celebrate stage changes (confetti when a job reaches an interview stage or gets accepted)
        </label>
        <div className="header-actions" style={{ marginTop: 14 }}>
          <button className="btn btn-primary" disabled={!dirty} onClick={save}>Save preferences</button>
        </div>
      </div>
    </div>
  );
}
