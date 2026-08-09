import { afterEach, describe, expect, it, vi } from 'vitest';
import { assignResource, createTeam, listAvailableResources, listMyTeams } from './teams.service';

describe('teams.service — createTeam', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resuelve con el equipo creado cuando fetch responde 201', async () => {
    const createdTeam = {
      id: 'team-1',
      name: 'Backend',
      description: 'Equipo de backend',
      ownerId: 'leader-1',
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    const fakeResponse = {
      ok: true,
      status: 201,
      json: () => Promise.resolve(createdTeam),
    } as Response;

    const fetchMock = vi.fn().mockResolvedValue(fakeResponse);
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      createTeam('access-token', {
        name: 'Backend',
        description: 'Equipo de backend',
      }),
    ).resolves.toEqual(createdTeam);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/teams'),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer access-token',
        }),
        body: JSON.stringify({ name: 'Backend', description: 'Equipo de backend' }),
      }),
    );
  });

  it('relanza el error de la API cuando fetch responde 409, en vez de devolver undefined', async () => {
    const fakeResponse = {
      ok: false,
      status: 409,
      json: () =>
        Promise.resolve({
          statusCode: 409,
          message: 'Ya existe un equipo con ese nombre',
          error: 'Conflict',
        }),
    } as Response;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse));

    await expect(
      createTeam('access-token', {
        name: 'Backend',
        description: 'Equipo duplicado',
      }),
    ).rejects.toThrow('Ya existe un equipo con ese nombre');
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
      createTeam('access-token', {
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
      createTeam('access-token', {
        name: 'Backend',
        description: 'Equipo de backend',
      }),
    ).rejects.toThrow('Error 500');
  });
});

describe('teams.service — assignResource', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resuelve con el miembro asignado cuando fetch responde 200 y arma la URL/body correctos', async () => {
    const assignedMember = {
      id: 'resource-1',
      email: 'recurso@tabsum.com',
      name: 'Recurso Uno',
    };
    const fakeResponse = {
      ok: true,
      status: 200,
      json: () => Promise.resolve(assignedMember),
    } as Response;

    const fetchMock = vi.fn().mockResolvedValue(fakeResponse);
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      assignResource('access-token', 'team-1', 'resource-1'),
    ).resolves.toEqual(assignedMember);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/teams/team-1/members'),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer access-token',
        }),
        body: JSON.stringify({ resourceId: 'resource-1' }),
      }),
    );
  });

  it('relanza el error de la API cuando fetch responde 409 (recurso ya asignado)', async () => {
    const fakeResponse = {
      ok: false,
      status: 409,
      json: () =>
        Promise.resolve({
          statusCode: 409,
          message: 'El recurso ya pertenece a un equipo',
          error: 'Conflict',
        }),
    } as Response;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse));

    await expect(
      assignResource('access-token', 'team-1', 'resource-1'),
    ).rejects.toThrow('El recurso ya pertenece a un equipo');
  });

  it('relanza el error de la API cuando fetch responde 403 (equipo ajeno)', async () => {
    const fakeResponse = {
      ok: false,
      status: 403,
      json: () =>
        Promise.resolve({
          statusCode: 403,
          message: 'No tenés permiso para realizar esta acción',
          error: 'Forbidden',
        }),
    } as Response;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse));

    await expect(
      assignResource('access-token', 'team-1', 'resource-1'),
    ).rejects.toThrow('No tenés permiso para realizar esta acción');
  });
});

describe('teams.service — listAvailableResources', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resuelve con el array de recursos libres cuando fetch responde 200', async () => {
    const resources = [
      { id: 'resource-1', email: 'r1@tabsum.com', name: 'Recurso Uno' },
      { id: 'resource-2', email: 'r2@tabsum.com', name: 'Recurso Dos' },
    ];
    const fakeResponse = {
      ok: true,
      status: 200,
      json: () => Promise.resolve(resources),
    } as Response;

    const fetchMock = vi.fn().mockResolvedValue(fakeResponse);
    vi.stubGlobal('fetch', fetchMock);

    await expect(listAvailableResources('access-token')).resolves.toEqual(resources);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/teams/available-resources'),
      expect.objectContaining({
        method: 'GET',
        credentials: 'include',
        headers: expect.objectContaining({
          Authorization: 'Bearer access-token',
        }),
      }),
    );
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

    await expect(listAvailableResources('access-token')).rejects.toThrow('Forbidden resource');
  });
});

describe('teams.service — listMyTeams', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resuelve con el array de equipos propios cuando fetch responde 200', async () => {
    const teams = [
      {
        id: 'team-1',
        name: 'Backend',
        description: 'Equipo de backend',
        ownerId: 'leader-1',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ];
    const fakeResponse = {
      ok: true,
      status: 200,
      json: () => Promise.resolve(teams),
    } as Response;

    const fetchMock = vi.fn().mockResolvedValue(fakeResponse);
    vi.stubGlobal('fetch', fetchMock);

    await expect(listMyTeams('access-token')).resolves.toEqual(teams);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/teams/mine'),
      expect.objectContaining({
        method: 'GET',
        credentials: 'include',
        headers: expect.objectContaining({
          Authorization: 'Bearer access-token',
        }),
      }),
    );
  });

  it('resuelve con [] cuando fetch responde 200 con lista vacía', async () => {
    const fakeResponse = {
      ok: true,
      status: 200,
      json: () => Promise.resolve([]),
    } as Response;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse));

    await expect(listMyTeams('access-token')).resolves.toEqual([]);
  });

  it('relanza un mensaje genérico "Error {status}" cuando el body no es JSON parseable', async () => {
    const fakeResponse = {
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error('Unexpected token < in JSON')),
    } as Response;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse));

    await expect(listMyTeams('access-token')).rejects.toThrow('Error 500');
  });
});
