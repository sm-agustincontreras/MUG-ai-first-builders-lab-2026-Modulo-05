import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import * as authService from './services/auth.service';

// El único punto de entrada al backend en esta app (`AGENTS.md`): se mockea
// acá, igual que en `LoginPage.spec.tsx`, para poder ejercitar el flujo
// login → /home → logout de punta a punta con `<AuthProvider>` real (el
// access token vive solo en memoria — no hay forma de "sembrar" una sesión
// sin pasar por `login()`, ver nota de assumptions en el reporte del bloque).
vi.mock('./services/auth.service', async () => {
  const actual = await vi.importActual<typeof import('./services/auth.service')>(
    './services/auth.service',
  );
  return { ...actual, login: vi.fn(), logout: vi.fn() };
});

const mockUser = {
  id: 'u1',
  email: 'pm@tabsum.com',
  name: 'Pau Martínez',
  role: 'PM' as const,
  createdAt: '2026-01-01T00:00:00.000Z',
};

async function loginAsPm(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.type(screen.getByLabelText(/email/i), mockUser.email);
  await user.type(screen.getByLabelText(/contraseña/i), 'password123');
  await user.click(screen.getByRole('button', { name: /ingresar/i }));
}

describe('App — ruta /home (FIX-001: logout debe redirigir a /login)', () => {
  beforeEach(() => {
    vi.mocked(authService.login).mockResolvedValue({
      accessToken: 'token-abc',
      user: mockUser,
    });
    vi.mocked(authService.logout).mockResolvedValue({ message: 'ok' });
  });

  afterEach(() => {
    vi.mocked(authService.login).mockReset();
    vi.mocked(authService.logout).mockReset();
  });

  it('regresión: login como PM navega a /home con el header de sus enlaces y bienvenida, y cerrar sesión desde el header navega a /login', async () => {
    window.history.pushState({}, '', '/login');
    const user = userEvent.setup();
    render(<App />);

    await loginAsPm(user);

    // Login exitoso de un rol no-Admin navega a /home (LoginPage.tsx:34).
    expect(await screen.findByText(/Bienvenido, Pau Martínez\. Estás logueado como PM\./)).toBeInTheDocument();
    // El header (AppHeader, Block 1) muestra los enlaces de PM (AC-01/AC-02).
    expect(screen.getByRole('link', { name: 'Clientes' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Composición de equipos' })).toBeInTheDocument();
    // El contenido de HomePage (AC-07) no incluye ningún botón de logout propio:
    // el único botón "Cerrar sesión" en pantalla es el del header (AC-08).
    expect(screen.getAllByRole('button', { name: /cerrar sesión/i })).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: /cerrar sesión/i }));

    expect(await screen.findByRole('heading', { name: /iniciar sesión/i })).toBeInTheDocument();
    expect(screen.queryByText(/Bienvenido,/)).not.toBeInTheDocument();
  });

  it('sin sesión, montar /home redirige de inmediato a /login sin renderizar AppHeader ni el contenido de HomePage', async () => {
    window.history.pushState({}, '', '/home');
    render(<App />);

    expect(await screen.findByRole('heading', { name: /iniciar sesión/i })).toBeInTheDocument();
    expect(screen.queryByText(/Bienvenido,/)).not.toBeInTheDocument();
    expect(screen.queryByText('TabSum+')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cerrar sesión/i })).not.toBeInTheDocument();
  });
});
