import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/use-auth';
import type { UserRole } from '../services/auth.service';

interface ProtectedRouteProps {
  children: ReactNode;
  /** Si se indica, además de requerir sesión, exige ese rol (o uno de esos roles) exacto. */
  requiredRole?: UserRole | UserRole[];
}

/**
 * Envuelve rutas que requieren sesión (y opcionalmente un rol, o uno de
 * varios roles). Sin sesión → redirige a `/login` en vez de renderizar el
 * contenido protegido o una pantalla rota. Con sesión pero rol insuficiente
 * → mensaje de acceso denegado visible (NFR-04), no un crash.
 */
export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // `user?.role` tipa como `UserRole | undefined` bajo `strict: true`:
  // `Array<UserRole>.includes()` no acepta `undefined`, por eso el guard
  // `!!user?.role &&` antes de `.includes(user.role)`.
  const hasRequiredRole =
    requiredRole === undefined ||
    (Array.isArray(requiredRole)
      ? !!user?.role && requiredRole.includes(user.role)
      : user?.role === requiredRole);

  if (!hasRequiredRole) {
    return <p role="alert">No tenés permiso para acceder a esta página.</p>;
  }

  return <>{children}</>;
}
