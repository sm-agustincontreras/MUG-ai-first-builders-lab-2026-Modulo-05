import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../hooks/use-auth';
import * as authService from '../services/auth.service';
import { LoginPage } from './LoginPage';

vi.mock('../services/auth.service', async () => {
  const actual = await vi.importActual<typeof import('../services/auth.service')>(
    '../services/auth.service',
  );
  return { ...actual, login: vi.fn() };
});

function renderLoginPage() {
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin/users" element={<p>Panel de administración</p>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe('LoginPage', () => {
  afterEach(() => {
    vi.mocked(authService.login).mockReset();
  });

  it('un envío exitoso llama a auth.service.login() con los valores del formulario y redirige', async () => {
    vi.mocked(authService.login).mockResolvedValue({
      accessToken: 'token-123',
      user: {
        id: '1',
        email: 'admin@tabsum.com',
        name: 'Admin Tabsum',
        role: 'ADMIN',
        createdAt: new Date().toISOString(),
      },
    });

    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText(/email/i), 'admin@tabsum.com');
    await user.type(screen.getByLabelText(/contraseña/i), 'password123');
    await user.click(screen.getByRole('button', { name: /ingresar/i }));

    expect(authService.login).toHaveBeenCalledWith('admin@tabsum.com', 'password123');
    expect(await screen.findByText('Panel de administración')).toBeInTheDocument();
  });

  it('si la API responde error (401), el mensaje se muestra en pantalla', async () => {
    vi.mocked(authService.login).mockRejectedValue(new Error('Credenciales inválidas'));

    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText(/email/i), 'admin@tabsum.com');
    await user.type(screen.getByLabelText(/contraseña/i), 'wrong-password');
    await user.click(screen.getByRole('button', { name: /ingresar/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Credenciales inválidas');
  });
});
