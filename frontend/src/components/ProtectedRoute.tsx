import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { AppHeader } from './AppHeader';
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
 * contenido protegido o una pantalla rota (ni monta `AppHeader`, AC-09). Con
 * sesión, antepone `AppHeader` (navegación + logout centralizados) tanto si
 * el rol alcanza como si no: rol insuficiente → mensaje de acceso denegado
 * visible (NFR-04) junto con el header, no un crash ni una pantalla sin
 * forma de navegar (decisión de diseño registrada en el spec de FEAT-004).
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
    return (
      <>
        <AppHeader />
        <p role="alert">No tenés permiso para acceder a esta página.</p>
      </>
    );
  }

  return (
    <>
      <AppHeader />
      {children}
    </>
  );
}
