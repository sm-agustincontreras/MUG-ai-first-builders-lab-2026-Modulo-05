import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthProvider, useAuth } from './hooks/use-auth';
import { AdminCreateUserPage } from './pages/AdminCreateUserPage';
import { LoginPage } from './pages/LoginPage';

/**
 * Placeholder mínimo para roles no-Admin tras el login (PM/Líder/Recurso).
 * Fuera de alcance de este ticket per PRD ("Vista de inicio diferenciada por
 * rol" queda para una feature posterior) — solo confirma la sesión y ofrece
 * cerrarla.
 */
function HomePlaceholder() {
  const { user, logout } = useAuth();
  return (
    <div>
      <p>
        Sesión iniciada como {user?.email} ({user?.role}).
      </p>
      <button type="button" onClick={() => void logout()}>
        Cerrar sesión
      </button>
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/home" element={<HomePlaceholder />} />
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute requiredRole="ADMIN">
                <AdminCreateUserPage />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
