import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ProtectedRoute } from './ProtectedRoute';

// `AppHeader` (Block 1) lee la sesión con su propio `useAuth()` — se mockea
// acá con el mismo mock compartido para que sus asserts (nombre de app,
// enlaces por rol) reflejen el mismo estado de sesión que `ProtectedRoute`.
const mockUseAuth = vi.fn();
vi.mock('../hooks/use-auth', () => ({
  useAuth: () => mockUseAuth(),
}));

describe('ProtectedRoute', () => {
  it('sin sesión, redirige a /login en vez de renderizar el contenido protegido', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, user: null, accessToken: null });

    render(
      <MemoryRouter initialEntries={['/admin/users']}>
        <Routes>
          <Route path="/login" element={<p>Página de login</p>} />
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute requiredRole="ADMIN">
                <p>Contenido protegido</p>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Página de login')).toBeInTheDocument();
    expect(screen.queryByText('Contenido protegido')).not.toBeInTheDocument();
  });

  it('con sesión y rol correcto, renderiza AppHeader junto con el contenido protegido', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: {
        id: 'u1',
        email: 'admin@example.com',
        name: 'Admin Uno',
        role: 'ADMIN',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      accessToken: 'token',
      logout: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/admin/users']}>
        <Routes>
          <Route path="/login" element={<p>Página de login</p>} />
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute requiredRole="ADMIN">
                <p>Contenido protegido</p>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Contenido protegido')).toBeInTheDocument();
    expect(screen.getByText('TabSum+')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Alta de usuarios' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cerrar sesión/i })).toBeInTheDocument();
    expect(screen.queryByText('Página de login')).not.toBeInTheDocument();
  });

  it('con sesión pero rol incorrecto, muestra AppHeader junto con el mensaje de acceso denegado (no solo el mensaje solo)', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: {
        id: 'u2',
        email: 'resource@example.com',
        name: 'Recurso Dos',
        role: 'RESOURCE',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      accessToken: 'token',
      logout: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/admin/users']}>
        <Routes>
          <Route path="/login" element={<p>Página de login</p>} />
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute requiredRole="ADMIN">
                <p>Contenido protegido</p>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('No tenés permiso para acceder a esta página.');
    expect(screen.getByText('TabSum+')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cerrar sesión/i })).toBeInTheDocument();
    expect(screen.queryByText('Contenido protegido')).not.toBeInTheDocument();
    expect(screen.queryByText('Página de login')).not.toBeInTheDocument();
  });

  it('con requiredRole array y un rol incluido en ese array, renderiza el contenido protegido', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: { id: 'u3', email: 'leader@example.com', role: 'LEADER', createdAt: '2026-01-01T00:00:00.000Z' },
      accessToken: 'token',
    });

    render(
      <MemoryRouter initialEntries={['/teams/composition']}>
        <Routes>
          <Route path="/login" element={<p>Página de login</p>} />
          <Route
            path="/teams/composition"
            element={
              <ProtectedRoute requiredRole={['PM', 'LEADER', 'RESOURCE']}>
                <p>Contenido protegido</p>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Contenido protegido')).toBeInTheDocument();
    expect(screen.queryByText('Página de login')).not.toBeInTheDocument();
  });

  it('con requiredRole array y un rol fuera de ese array, muestra el mensaje de acceso denegado', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: { id: 'u4', email: 'admin@example.com', role: 'ADMIN', createdAt: '2026-01-01T00:00:00.000Z' },
      accessToken: 'token',
    });

    render(
      <MemoryRouter initialEntries={['/teams/composition']}>
        <Routes>
          <Route path="/login" element={<p>Página de login</p>} />
          <Route
            path="/teams/composition"
            element={
              <ProtectedRoute requiredRole={['PM', 'LEADER', 'RESOURCE']}>
                <p>Contenido protegido</p>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('No tenés permiso para acceder a esta página.');
    expect(screen.queryByText('Contenido protegido')).not.toBeInTheDocument();
    expect(screen.queryByText('Página de login')).not.toBeInTheDocument();
  });
});
