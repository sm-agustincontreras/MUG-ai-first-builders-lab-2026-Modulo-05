import { afterEach, describe, expect, it, vi } from 'vitest';
import { login, logout, refresh } from './auth.service';

describe('auth.service — login', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('relanza el error de la API cuando fetch responde !ok, en vez de devolver undefined', async () => {
    const fakeResponse = {
      ok: false,
      status: 401,
      json: () => Promise.resolve({ statusCode: 401, message: 'Credenciales inválidas', error: 'Unauthorized' }),
    } as Response;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse));

    await expect(login('user@example.com', 'password123')).rejects.toThrow('Credenciales inválidas');
  });

  it('une los mensajes en un array (formato de ValidationPipe) con coma al relanzar el error', async () => {
    const fakeResponse = {
      ok: false,
      status: 400,
      json: () =>
        Promise.resolve({
          statusCode: 400,
          message: ['email must be an email', 'password must be longer than 8 characters'],
          error: 'Bad Request',
        }),
    } as Response;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse));

    await expect(login('bad-email', '123')).rejects.toThrow(
      'email must be an email, password must be longer than 8 characters',
    );
  });

  it('relanza un mensaje genérico "Error {status}" cuando el body de la respuesta no es JSON parseable', async () => {
    const fakeResponse = {
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error('Unexpected token < in JSON')),
    } as Response;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse));

    await expect(login('user@example.com', 'password123')).rejects.toThrow('Error 500');
  });

  it('resuelve con { accessToken, user } y llama a fetch con método, credenciales y body correctos', async () => {
    const loginResponse = {
      accessToken: 'access-token-123',
      user: {
        id: 'user-1',
        email: 'user@example.com',
        role: 'ADMIN',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    };
    const fakeResponse = {
      ok: true,
      status: 200,
      json: () => Promise.resolve(loginResponse),
    } as Response;
    const fetchMock = vi.fn().mockResolvedValue(fakeResponse);

    vi.stubGlobal('fetch', fetchMock);

    await expect(login('user@example.com', 'password123')).resolves.toEqual(loginResponse);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/auth/login'),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com', password: 'password123' }),
      }),
    );
  });
});

describe('auth.service — refresh', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resuelve con { accessToken } cuando fetch responde ok', async () => {
    const refreshResponse = { accessToken: 'new-access-token' };
    const fakeResponse = {
      ok: true,
      status: 200,
      json: () => Promise.resolve(refreshResponse),
    } as Response;
    const fetchMock = vi.fn().mockResolvedValue(fakeResponse);

    vi.stubGlobal('fetch', fetchMock);

    await expect(refresh()).resolves.toEqual(refreshResponse);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/auth/refresh'),
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
  });

  it('relanza el error de la API cuando fetch responde !ok', async () => {
    const fakeResponse = {
      ok: false,
      status: 401,
      json: () => Promise.resolve({ statusCode: 401, message: 'Refresh token inválido', error: 'Unauthorized' }),
    } as Response;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse));

    await expect(refresh()).rejects.toThrow('Refresh token inválido');
  });
});

describe('auth.service — logout', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resuelve con { message } y envía el Authorization header cuando fetch responde ok', async () => {
    const logoutResponse = { message: 'Sesión cerrada' };
    const fakeResponse = {
      ok: true,
      status: 200,
      json: () => Promise.resolve(logoutResponse),
    } as Response;
    const fetchMock = vi.fn().mockResolvedValue(fakeResponse);

    vi.stubGlobal('fetch', fetchMock);

    await expect(logout('access-token-123')).resolves.toEqual(logoutResponse);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/auth/logout'),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: { Authorization: 'Bearer access-token-123' },
      }),
    );
  });

  it('relanza el error de la API cuando fetch responde !ok', async () => {
    const fakeResponse = {
      ok: false,
      status: 401,
      json: () => Promise.resolve({ statusCode: 401, message: 'Token inválido', error: 'Unauthorized' }),
    } as Response;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse));

    await expect(logout('bad-token')).rejects.toThrow('Token inválido');
  });
});
