import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Jobs from './pages/Jobs';
import JobDetail from './pages/JobDetail';
import Companies from './pages/Companies';
import CompanyDetail from './pages/CompanyDetail';
import People from './pages/People';
import PersonDetail from './pages/PersonDetail';
import CvLibrary from './pages/CvLibrary';
import SettingsPreferences from './pages/SettingsPreferences';
import SettingsBackups from './pages/SettingsBackups';
import SearchResults from './pages/SearchResults';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/jobs" element={<Jobs />} />
        <Route path="/jobs/:id" element={<JobDetail />} />
        <Route path="/companies" element={<Companies />} />
        <Route path="/companies/:id" element={<CompanyDetail />} />
        <Route path="/people" element={<People />} />
        <Route path="/people/:id" element={<PersonDetail />} />
        <Route path="/cvs" element={<CvLibrary />} />
        <Route path="/settings" element={<Navigate to="/settings/preferences" replace />} />
        <Route path="/settings/preferences" element={<SettingsPreferences />} />
        <Route path="/settings/backups" element={<SettingsBackups />} />
        <Route path="/search" element={<SearchResults />} />
      </Routes>
    </Layout>
  );
}
