import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AppHeader } from './AppHeader';

const mockUseAuth = vi.fn();
vi.mock('../hooks/use-auth', () => ({
  useAuth: () => mockUseAuth(),
}));

function renderWithRouter(initialEntries: string[] = ['/home']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="*" element={<AppHeader />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AppHeader', () => {
  it('con user.role === "PM", renderiza exactamente los enlaces "Clientes" y "Composición de equipos"', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'u1', email: 'pm@example.com', role: 'PM', createdAt: '2026-01-01T00:00:00.000Z' },
      logout: vi.fn(),
    });

    renderWithRouter();

    const nav = screen.getByRole('navigation');
    const links = within(nav).getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(within(nav).getByRole('link', { name: 'Clientes' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Composición de equipos' })).toBeInTheDocument();
  });

  it('con user.role === "LEADER", renderiza exactamente "Equipos" y "Composición de equipos"', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'u2', email: 'leader@example.com', role: 'LEADER', createdAt: '2026-01-01T00:00:00.000Z' },
      logout: vi.fn(),
    });

    renderWithRouter();

    const nav = screen.getByRole('navigation');
    const links = within(nav).getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(within(nav).getByRole('link', { name: 'Equipos' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Composición de equipos' })).toBeInTheDocument();
  });

  it('con user.role === "RESOURCE", renderiza únicamente "Composición de equipos"', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'u3', email: 'resource@example.com', role: 'RESOURCE', createdAt: '2026-01-01T00:00:00.000Z' },
      logout: vi.fn(),
    });

    renderWithRouter();

    const nav = screen.getByRole('navigation');
    const links = within(nav).getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(within(nav).getByRole('link', { name: 'Composición de equipos' })).toBeInTheDocument();
  });

  it('con user.role === "ADMIN", renderiza "Alta de usuarios"', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'u4', email: 'admin@example.com', role: 'ADMIN', createdAt: '2026-01-01T00:00:00.000Z' },
      logout: vi.fn(),
    });

    renderWithRouter();

    const nav = screen.getByRole('navigation');
    const links = within(nav).getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(within(nav).getByRole('link', { name: 'Alta de usuarios' })).toBeInTheDocument();
  });

  it('click en el nombre de la app navega a /home', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'u4', email: 'admin@example.com', role: 'ADMIN', createdAt: '2026-01-01T00:00:00.000Z' },
      logout: vi.fn(),
    });
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/admin/users']}>
        <Routes>
          <Route path="/admin/users" element={<AppHeader />} />
          <Route path="/home" element={<p>Página de inicio</p>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('link', { name: 'TabSum+' }));

    expect(screen.getByText('Página de inicio')).toBeInTheDocument();
  });

  it('click en el botón de cerrar sesión invoca logout()', async () => {
    const logoutMock = vi.fn();
    mockUseAuth.mockReturnValue({
      user: { id: 'u4', email: 'admin@example.com', role: 'ADMIN', createdAt: '2026-01-01T00:00:00.000Z' },
      logout: logoutMock,
    });
    const user = userEvent.setup();

    renderWithRouter();

    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

    expect(logoutMock).toHaveBeenCalledTimes(1);
  });

  it('marca aria-current="page" únicamente en el link activo', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'u1', email: 'pm@example.com', role: 'PM', createdAt: '2026-01-01T00:00:00.000Z' },
      logout: vi.fn(),
    });

    renderWithRouter(['/pm/clients']);

    const nav = screen.getByRole('navigation');
    const activeLink = within(nav).getByRole('link', { name: 'Clientes' });
    const inactiveLink = within(nav).getByRole('link', { name: 'Composición de equipos' });

    expect(activeLink).toHaveAttribute('aria-current', 'page');
    expect(inactiveLink).not.toHaveAttribute('aria-current');
  });

  it('con user === null, no renderiza enlaces de sección ni botón de logout, y no lanza excepción', () => {
    mockUseAuth.mockReturnValue({ user: null, logout: vi.fn() });

    expect(() => renderWithRouter()).not.toThrow();

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'TabSum+' })).toBeInTheDocument();
  });
});
