import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import * as authService from '../services/auth.service';
import { AuthProvider, useAuth } from './use-auth';

vi.mock('../services/auth.service', () => ({
  login: vi.fn(),
  logout: vi.fn(),
}));

describe('useAuth', () => {
  it('lanza un error cuando se usa fuera de un <AuthProvider>', () => {
    expect(() => renderHook(() => useAuth())).toThrow(
      'useAuth debe usarse dentro de un <AuthProvider>',
    );
  });

  it('logout() limpia el estado local incluso si authService.logout() rechaza', async () => {
    const loggedInUser = {
      id: 'u1',
      email: 'user@example.com',
      name: 'User Uno',
      role: 'ADMIN' as const,
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    vi.mocked(authService.login).mockResolvedValue({
      accessToken: 'access-token',
      user: loggedInUser,
    });
    vi.mocked(authService.logout).mockRejectedValue(new Error('network down'));

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await act(async () => {
      await result.current.login('user@example.com', 'password123');
    });

    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    expect(result.current.accessToken).toBe('access-token');

    await act(async () => {
      await expect(result.current.logout()).rejects.toThrow('network down');
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.accessToken).toBeNull();
  });
});
