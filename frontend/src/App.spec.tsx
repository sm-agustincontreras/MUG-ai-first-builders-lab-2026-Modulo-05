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

  it('regresión: cerrar sesión desde /home navega a /login (no se queda en /home)', async () => {
    window.history.pushState({}, '', '/login');
    const user = userEvent.setup();
    render(<App />);

    await loginAsPm(user);

    // Login exitoso de un rol no-Admin navega a /home (LoginPage.tsx:34).
    expect(await screen.findByText(/Sesión iniciada como pm@tabsum\.com/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /cerrar sesión/i }));

    expect(await screen.findByRole('heading', { name: /iniciar sesión/i })).toBeInTheDocument();
    expect(screen.queryByText(/Sesión iniciada como/)).not.toBeInTheDocument();
  });

  it('sin sesión, montar /home redirige de inmediato a /login sin renderizar el placeholder', async () => {
    window.history.pushState({}, '', '/home');
    render(<App />);

    expect(await screen.findByRole('heading', { name: /iniciar sesión/i })).toBeInTheDocument();
    expect(screen.queryByText(/Sesión iniciada como/)).not.toBeInTheDocument();
  });

  it('con sesión iniciada, /home renderiza el placeholder normalmente (caso feliz no regresiona)', async () => {
    window.history.pushState({}, '', '/login');
    const user = userEvent.setup();
    render(<App />);

    await loginAsPm(user);

    expect(await screen.findByText(/Sesión iniciada como pm@tabsum\.com \(PM\)/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cerrar sesión/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /iniciar sesión/i })).not.toBeInTheDocument();
  });
});
