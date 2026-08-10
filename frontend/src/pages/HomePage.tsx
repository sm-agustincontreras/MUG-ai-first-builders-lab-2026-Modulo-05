import { useAuth } from '../hooks/use-auth';
import type { UserRole } from '../services/auth.service';
import './HomePage.css';

// Dato de presentación puro (no regla de negocio ni contrato de API), mismo
// criterio que `ROLE_NAV_LINKS` en `AppHeader` (ver spec de FEAT-004).
const ROLE_LABELS: Record<UserRole, string> = {
  PM: 'PM',
  LEADER: 'Líder',
  RESOURCE: 'Recurso',
  ADMIN: 'Admin',
};

/**
 * Contenido de `/home`: mensaje de bienvenida con nombre y rol del usuario
 * (FR-05). No incluye ningún control de logout (FR-06) — vive centralizado
 * en `AppHeader`, montado por `ProtectedRoute`.
 */
export function HomePage() {
  const { user } = useAuth();

  // Caso defensivo (no debería ocurrir dentro de `ProtectedRoute`, que solo
  // monta este contenido con sesión activa): sin `user`, no hay nombre/rol
  // que mostrar — se evita leer propiedades de un valor nulo.
  if (user === null) {
    return null;
  }

  return (
    <div className="home-page">
      <p>
        Bienvenido, {user.name}. Estás logueado como {ROLE_LABELS[user.role]}.
      </p>
    </div>
  );
}
