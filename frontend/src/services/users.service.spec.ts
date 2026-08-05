import { afterEach, describe, expect, it, vi } from 'vitest';
import { createUser } from './users.service';

describe('users.service — createUser', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resuelve con el body parseado cuando fetch responde ok', async () => {
    const createdUser = {
      id: 'user-1',
      email: 'nuevo@example.com',
      role: 'RESOURCE',
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    const fakeResponse = {
      ok: true,
      status: 201,
      json: () => Promise.resolve(createdUser),
    } as Response;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse));

    await expect(
      createUser('access-token', {
        email: 'nuevo@example.com',
        password: 'password123',
        role: 'RESOURCE',
      }),
    ).resolves.toEqual(createdUser);
  });

  it('relanza el error de la API cuando fetch responde !ok, en vez de devolver undefined', async () => {
    const fakeResponse = {
      ok: false,
      status: 409,
      json: () => Promise.resolve({ statusCode: 409, message: 'El email ya está en uso', error: 'Conflict' }),
    } as Response;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse));

    await expect(
      createUser('access-token', {
        email: 'duplicado@example.com',
        password: 'password123',
        role: 'RESOURCE',
      }),
    ).rejects.toThrow('El email ya está en uso');
  });
});
