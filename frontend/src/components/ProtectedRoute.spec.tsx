import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ProtectedRoute } from './ProtectedRoute';

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

  it('con sesión y rol correcto, renderiza el contenido protegido', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: { id: 'u1', email: 'admin@example.com', role: 'ADMIN', createdAt: '2026-01-01T00:00:00.000Z' },
      accessToken: 'token',
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
    expect(screen.queryByText('Página de login')).not.toBeInTheDocument();
  });

  it('con sesión pero rol incorrecto, muestra el mensaje de acceso denegado en vez de redirigir o crashear', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: { id: 'u2', email: 'resource@example.com', role: 'RESOURCE', createdAt: '2026-01-01T00:00:00.000Z' },
      accessToken: 'token',
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
    expect(screen.queryByText('Contenido protegido')).not.toBeInTheDocument();
    expect(screen.queryByText('Página de login')).not.toBeInTheDocument();
  });
});
