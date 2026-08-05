import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as usersService from '../services/users.service';
import { AdminCreateUserPage } from './AdminCreateUserPage';

const mockUseAuth = vi.fn();
vi.mock('../hooks/use-auth', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../services/users.service', async () => {
  const actual = await vi.importActual<typeof import('../services/users.service')>(
    '../services/users.service',
  );
  return { ...actual, createUser: vi.fn() };
});

describe('AdminCreateUserPage', () => {
  afterEach(() => {
    vi.mocked(usersService.createUser).mockReset();
  });

  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: { id: 'admin-1', email: 'admin@tabsum.com', role: 'ADMIN', createdAt: new Date().toISOString() },
      accessToken: 'admin-token',
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
    });
  });

  it('un envío exitoso llama a users.service.createUser() y muestra confirmación', async () => {
    vi.mocked(usersService.createUser).mockResolvedValue({
      id: 'u2',
      email: 'nuevo@tabsum.com',
      role: 'PM',
      createdAt: new Date().toISOString(),
    });

    const user = userEvent.setup();
    render(<AdminCreateUserPage />);

    await user.type(screen.getByLabelText(/email/i), 'nuevo@tabsum.com');
    await user.type(screen.getByLabelText(/contraseña/i), 'password123');
    await user.selectOptions(screen.getByLabelText(/rol/i), 'PM');
    await user.click(screen.getByRole('button', { name: /crear usuario/i }));

    expect(usersService.createUser).toHaveBeenCalledWith('admin-token', {
      email: 'nuevo@tabsum.com',
      password: 'password123',
      role: 'PM',
    });
    expect(await screen.findByText(/nuevo@tabsum\.com/)).toBeInTheDocument();
  });

  it('si la API responde 409 (email duplicado), el mensaje se muestra en pantalla', async () => {
    vi.mocked(usersService.createUser).mockRejectedValue(new Error('Ya existe una cuenta con ese email'));

    const user = userEvent.setup();
    render(<AdminCreateUserPage />);

    await user.type(screen.getByLabelText(/email/i), 'repetido@tabsum.com');
    await user.type(screen.getByLabelText(/contraseña/i), 'password123');
    await user.selectOptions(screen.getByLabelText(/rol/i), 'PM');
    await user.click(screen.getByRole('button', { name: /crear usuario/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Ya existe una cuenta con ese email');
  });
});
