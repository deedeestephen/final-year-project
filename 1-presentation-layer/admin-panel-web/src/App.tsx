import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { useSession } from './auth/session-context';
import { Layout } from './components/Layout';
import { ConnectionBanner } from './components/ui';
import { AuditLogPage } from './pages/AuditLogPage';
import { ChangePasswordPage, LoginPage } from './pages/AuthPages';
import { FhirExportPage } from './pages/FhirExportPage';
import { PatientAccountsPage } from './pages/PatientAccountsPage';
import { RolePermissionsPage, RolesPage } from './pages/RolesPages';
import { CreateUserPage, UserDetailPage, UsersPage } from './pages/UsersPages';

function NotFound() {
  return (
    <>
      <h1>Page not found</h1>
      <p>
        <Link to="/users">Go to Users</Link>
      </p>
    </>
  );
}

/** Chooses what to show from the session: sign in, new password, or the portal. */
export default function App() {
  return (
    <>
      <ConnectionBanner />
      <Screens />
    </>
  );
}

function Screens() {
  const { session } = useSession();
  const queryClient = useQueryClient();

  // Nothing fetched for one administrator may be shown to the next.
  useEffect(() => {
    if (session.status === 'signedOut') queryClient.clear();
  }, [session.status, queryClient]);

  if (session.status === 'restoring') {
    return (
      <div className="center" role="status">
        Loading…
      </div>
    );
  }
  if (session.status === 'signedOut') return <LoginPage />;
  if (session.user.mustChangePassword) return <ChangePasswordPage />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/users" replace />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="users/new" element={<CreateUserPage />} />
        <Route path="users/:id" element={<UserDetailPage />} />
        <Route path="roles" element={<RolesPage />} />
        <Route path="roles/:name" element={<RolePermissionsPage />} />
        <Route path="patient-accounts" element={<PatientAccountsPage />} />
        <Route path="fhir-export" element={<FhirExportPage />} />
        <Route path="audit-log" element={<AuditLogPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
