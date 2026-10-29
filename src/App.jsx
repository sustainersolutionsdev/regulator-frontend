import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AppLayout from './layout/AppLayout';
import BusinessUnitSetup from './pages/BusinessUnitSetup';
import PeopleDirectory from './pages/PeopleDirectory';
import AddRegulationForm from './components/AddRegulationForm';
import RegulationRoadmap from './pages/RegulationRoadmap';
import MonthlyCalendar from './pages/MonthlyCalendar';
import ComplianceDashboard from './pages/ComplianceDashboard';
import EmailAlertsSettings from './pages/EmailAlertsSettings';
import LoginScreen, { AccountNotReady } from './pages/LoginScreen';
import { isAdminOrSme } from './constants/access';

export default function App() {
  const { user, claims, loading, logout } = useAuth();

  if (loading) {
    return (
      <p role="status" className="p-6 text-body text-text-secondary dark:text-slate-300">
        Loading…
      </p>
    );
  }
  // Signed out: the Login screen (T051) shows at the same URL, so a link from
  // an alert email (/dashboard?reg=..., /account/email-alerts) opens its page
  // straight after sign-in (T025).
  if (!user) return <LoginScreen />;
  // Signed in, but no company or role on the account (T051).
  if (!claims?.tenantId || !claims?.role) {
    return <AccountNotReady email={user.email} onSignOut={logout} />;
  }

  // T066: Add Regulation and Settings are Admin/SME pages; a User who opens
  // one by its address lands on the Roadmap instead.
  const adminOnly = (element) => (isAdminOrSme(claims.role) ? element : <Navigate to="/roadmap" replace />);

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Navigate to="/roadmap" replace />} />
        <Route path="/roadmap" element={<RegulationRoadmap />} />
        <Route path="/roadmap/calendar" element={<MonthlyCalendar />} />
        <Route path="/dashboard" element={<ComplianceDashboard />} />
        <Route path="/settings" element={adminOnly(<BusinessUnitSetup />)} />
        <Route path="/directory" element={<PeopleDirectory />} />
        <Route path="/add-regulation" element={adminOnly(<AddRegulationForm />)} />
        <Route path="/account/email-alerts" element={<EmailAlertsSettings />} />
      </Route>
    </Routes>
  );
}
