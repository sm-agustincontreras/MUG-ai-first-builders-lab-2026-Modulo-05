import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HomePage } from './HomePage';

const mockUseAuth = vi.fn();
vi.mock('../hooks/use-auth', () => ({
  useAuth: () => mockUseAuth(),
}));

describe('HomePage', () => {
  it('con usuario autenticado, muestra el mensaje de bienvenida con nombre y rol legible, sin ningún botón de logout en su contenido', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: {
        id: 'u1',
        email: 'lider@tabsum.com',
        name: 'Lucía Líder',
        role: 'LEADER',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      accessToken: 'token',
      logout: vi.fn(),
    });

    render(<HomePage />);

    expect(
      screen.getByText('Bienvenido, Lucía Líder. Estás logueado como Líder.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cerrar sesión/i })).not.toBeInTheDocument();
  });

  it('con user === null, no renderiza el mensaje de bienvenida y no lanza ninguna excepción', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      user: null,
      accessToken: null,
      logout: vi.fn(),
    });

    expect(() => render(<HomePage />)).not.toThrow();
    expect(screen.queryByText(/Bienvenido,/)).not.toBeInTheDocument();
  });
});
