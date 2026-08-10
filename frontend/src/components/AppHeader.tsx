import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/use-auth';
import type { UserRole } from '../services/auth.service';
import './AppHeader.css';

interface NavLinkDef {
  to: string;
  label: string;
}

// Dato de presentación puro (no regla de negocio ni contrato de API): vive
// acá y no en `services/` — ver decisión de diseño registrada en el spec.
const ROLE_NAV_LINKS: Record<UserRole, NavLinkDef[]> = {
  PM: [
    { to: '/pm/clients', label: 'Clientes' },
    { to: '/teams/composition', label: 'Composición de equipos' },
  ],
  LEADER: [
    { to: '/leader/teams', label: 'Equipos' },
    { to: '/teams/composition', label: 'Composición de equipos' },
  ],
  RESOURCE: [{ to: '/teams/composition', label: 'Composición de equipos' }],
  ADMIN: [{ to: '/admin/users', label: 'Alta de usuarios' }],
};

/**
 * Header de navegación persistente, renderizado dentro de `ProtectedRoute`
 * en toda pantalla protegida. Enlaces filtrados por rol (FR-03) + logout
 * centralizado (FR-04). Sin props: lee la sesión directamente de `useAuth()`
 * (NFR-02 — nunca llama a la API directamente).
 */
export function AppHeader() {
  const { user, logout } = useAuth();

  return (
    <header className="app-header">
      <Link to="/home" className="app-header__brand">
        TabSum+
      </Link>

      {user !== null && (
        <>
          <nav className="app-header__nav" aria-label="Navegación principal">
            {ROLE_NAV_LINKS[user.role].map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  isActive ? 'app-header__link app-header__link--active' : 'app-header__link'
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <button type="button" className="app-header__logout" onClick={() => void logout()}>
            Cerrar sesión
          </button>
        </>
      )}
    </header>
  );
}
