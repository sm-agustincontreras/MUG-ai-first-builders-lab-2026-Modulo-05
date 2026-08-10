import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthProvider } from './hooks/use-auth';
import { AdminCreateUserPage } from './pages/AdminCreateUserPage';
import { HomePage } from './pages/HomePage';
import { LeaderTeamsPage } from './pages/LeaderTeamsPage';
import { LoginPage } from './pages/LoginPage';
import { PMClientsPage } from './pages/PMClientsPage';
import { TeamsCompositionPage } from './pages/TeamsCompositionPage';

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/home"
            element={
              <ProtectedRoute>
                <HomePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute requiredRole="ADMIN">
                <AdminCreateUserPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pm/clients"
            element={
              <ProtectedRoute requiredRole="PM">
                <PMClientsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/leader/teams"
            element={
              <ProtectedRoute requiredRole="LEADER">
                <LeaderTeamsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teams/composition"
            element={
              <ProtectedRoute requiredRole={['PM', 'LEADER', 'RESOURCE']}>
                <TeamsCompositionPage />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
