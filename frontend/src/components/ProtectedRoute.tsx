import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/use-auth';
import type { UserRole } from '../services/auth.service';

interface ProtectedRouteProps {
  children: ReactNode;
  /** Si se indica, además de requerir sesión, exige ese rol exacto. */
  requiredRole?: UserRole;
}

/**
 * Envuelve rutas que requieren sesión (y opcionalmente un rol). Sin sesión →
 * redirige a `/login` en vez de renderizar el contenido protegido o una
 * pantalla rota. Con sesión pero rol insuficiente → mensaje de acceso
 * denegado visible (NFR-04), no un crash.
 */
export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user?.role !== requiredRole) {
    return <p role="alert">No tenés permiso para acceder a esta página.</p>;
  }

  return <>{children}</>;
}
