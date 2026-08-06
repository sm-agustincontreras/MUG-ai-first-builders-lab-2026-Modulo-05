import { afterEach, describe, expect, it, vi } from 'vitest';
import { createClient, listClients } from './clients.service';

describe('clients.service — createClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resuelve con el cliente creado cuando fetch responde 201', async () => {
    const createdClient = {
      id: 'client-1',
      name: 'Acme',
      description: 'Cliente de prueba',
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    const fakeResponse = {
      ok: true,
      status: 201,
      json: () => Promise.resolve(createdClient),
    } as Response;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse));

    await expect(
      createClient('access-token', {
        name: 'Acme',
        description: 'Cliente de prueba',
      }),
    ).resolves.toEqual(createdClient);
  });

  it('relanza el error de la API cuando fetch responde 409, en vez de devolver undefined', async () => {
    const fakeResponse = {
      ok: false,
      status: 409,
      json: () =>
        Promise.resolve({
          statusCode: 409,
          message: 'Ya existe un cliente con ese nombre',
          error: 'Conflict',
        }),
    } as Response;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse));

    await expect(
      createClient('access-token', {
        name: 'Acme',
        description: 'Cliente duplicado',
      }),
    ).rejects.toThrow('Ya existe un cliente con ese nombre');
  });

  it('une los mensajes en un array (formato de ValidationPipe) con coma al relanzar el error', async () => {
    const fakeResponse = {
      ok: false,
      status: 400,
      json: () =>
        Promise.resolve({
          statusCode: 400,
          message: ['name should not be empty', 'description should not be empty'],
          error: 'Bad Request',
        }),
    } as Response;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse));

    await expect(
      createClient('access-token', {
        name: '',
        description: '',
      }),
    ).rejects.toThrow('name should not be empty, description should not be empty');
  });

  it('relanza un mensaje genérico "Error {status}" cuando el body de la respuesta no es JSON parseable', async () => {
    const fakeResponse = {
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error('Unexpected token < in JSON')),
    } as Response;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse));

    await expect(
      createClient('access-token', {
        name: 'Acme',
        description: 'Cliente de prueba',
      }),
    ).rejects.toThrow('Error 500');
  });
});

describe('clients.service — listClients', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resuelve con el array de clientes cuando fetch responde 200 con lista no vacía', async () => {
    const clients = [
      {
        id: 'client-1',
        name: 'Acme',
        description: 'Cliente de prueba',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'client-2',
        name: 'Globex',
        description: 'Otro cliente',
        createdAt: '2026-01-02T00:00:00.000Z',
      },
    ];
    const fakeResponse = {
      ok: true,
      status: 200,
      json: () => Promise.resolve(clients),
    } as Response;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse));

    await expect(listClients('access-token')).resolves.toEqual(clients);
  });

  it('resuelve con [] cuando fetch responde 200 con lista vacía', async () => {
    const fakeResponse = {
      ok: true,
      status: 200,
      json: () => Promise.resolve([]),
    } as Response;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse));

    await expect(listClients('access-token')).resolves.toEqual([]);
  });

  it('relanza el error de la API cuando fetch responde 403, en vez de devolver undefined', async () => {
    const fakeResponse = {
      ok: false,
      status: 403,
      json: () =>
        Promise.resolve({
          statusCode: 403,
          message: 'Forbidden resource',
          error: 'Forbidden',
        }),
    } as Response;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse));

    await expect(listClients('access-token')).rejects.toThrow('Forbidden resource');
  });
});
