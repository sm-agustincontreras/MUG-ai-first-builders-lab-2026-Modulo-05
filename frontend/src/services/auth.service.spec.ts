import { afterEach, describe, expect, it, vi } from 'vitest';
import { login } from './auth.service';

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
});
