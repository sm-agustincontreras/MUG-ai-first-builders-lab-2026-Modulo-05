import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as teamsService from '../services/teams.service';
import { LeaderTeamsPage } from './LeaderTeamsPage';

const mockUseAuth = vi.fn();
vi.mock('../hooks/use-auth', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../services/teams.service', async () => {
  const actual = await vi.importActual<typeof import('../services/teams.service')>(
    '../services/teams.service',
  );
  return {
    ...actual,
    createTeam: vi.fn(),
    assignResource: vi.fn(),
    listAvailableResources: vi.fn(),
    listMyTeams: vi.fn(),
  };
});

const leaderUser = {
  id: 'leader-1',
  email: 'leader@tabsum.com',
  role: 'LEADER',
  createdAt: new Date().toISOString(),
};

describe('LeaderTeamsPage', () => {
  afterEach(() => {
    vi.mocked(teamsService.createTeam).mockReset();
    vi.mocked(teamsService.assignResource).mockReset();
    vi.mocked(teamsService.listAvailableResources).mockReset();
    vi.mocked(teamsService.listMyTeams).mockReset();
  });

  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: leaderUser,
      accessToken: 'leader-token',
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
    });
  });

  it('un usuario con rol distinto de LEADER ve el mensaje de acceso denegado y no ve el formulario', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'r-1', email: 'recurso@tabsum.com', role: 'RESOURCE', createdAt: new Date().toISOString() },
      accessToken: 'resource-token',
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
    });

    render(<LeaderTeamsPage />);

    expect(screen.getByRole('alert')).toHaveTextContent('No tenés permiso para acceder a esta página.');
    expect(screen.queryByLabelText(/nombre/i)).not.toBeInTheDocument();
    expect(teamsService.listMyTeams).not.toHaveBeenCalled();
    expect(teamsService.listAvailableResources).not.toHaveBeenCalled();
  });

  it('un listado vacío de equipos y recursos muestra los empty states en vez de listas en blanco', async () => {
    vi.mocked(teamsService.listMyTeams).mockResolvedValue([]);
    vi.mocked(teamsService.listAvailableResources).mockResolvedValue([]);

    render(<LeaderTeamsPage />);

    expect(await screen.findByText(/no tenés equipos creados todavía/i)).toBeInTheDocument();
    expect(await screen.findByText(/no hay recursos libres para asignar/i)).toBeInTheDocument();
  });

  it('completar el formulario y crear un equipo llama a createTeam con el payload correcto y lo agrega al selector de equipos', async () => {
    vi.mocked(teamsService.listMyTeams).mockResolvedValue([]);
    vi.mocked(teamsService.listAvailableResources).mockResolvedValue([]);
    vi.mocked(teamsService.createTeam).mockResolvedValue({
      id: 'team-1',
      name: 'Backend',
      description: 'Equipo de backend',
      ownerId: 'leader-1',
      createdAt: new Date().toISOString(),
    });

    const user = userEvent.setup();
    render(<LeaderTeamsPage />);
    await screen.findByText(/no tenés equipos creados todavía/i);

    await user.type(screen.getByLabelText(/^nombre$/i), 'Backend');
    await user.type(screen.getByLabelText(/^descripción$/i), 'Equipo de backend');
    await user.click(screen.getByRole('button', { name: /crear equipo/i }));

    expect(teamsService.createTeam).toHaveBeenCalledWith('leader-token', {
      name: 'Backend',
      description: 'Equipo de backend',
    });

    // El equipo recién creado aparece en el selector de "a qué equipo asignar".
    expect(await screen.findByRole('option', { name: 'Backend' })).toBeInTheDocument();
  });

  it('asignar un recurso libre a un equipo llama a assignResource con teamId/resourceId correctos y el recurso desaparece de la lista de libres', async () => {
    vi.mocked(teamsService.listMyTeams).mockResolvedValue([
      {
        id: 'team-1',
        name: 'Backend',
        description: 'Equipo de backend',
        ownerId: 'leader-1',
        createdAt: new Date().toISOString(),
      },
    ]);
    vi.mocked(teamsService.listAvailableResources).mockResolvedValueOnce([
      { id: 'resource-1', email: 'recurso@tabsum.com', name: 'Recurso Uno' },
    ]);
    vi.mocked(teamsService.assignResource).mockResolvedValue({
      id: 'resource-1',
      email: 'recurso@tabsum.com',
      name: 'Recurso Uno',
    });
    // Tras un assign exitoso, la página vuelve a pedir el listado de
    // recursos libres — ya no debe incluir al que se acaba de asignar.
    vi.mocked(teamsService.listAvailableResources).mockResolvedValueOnce([]);

    const user = userEvent.setup();
    render(<LeaderTeamsPage />);
    await screen.findByRole('option', { name: 'Recurso Uno (recurso@tabsum.com)' });

    await user.selectOptions(screen.getByLabelText(/^equipo$/i), 'team-1');
    await user.selectOptions(screen.getByLabelText(/^recurso$/i), 'resource-1');
    await user.click(screen.getByRole('button', { name: /asignar recurso/i }));

    expect(teamsService.assignResource).toHaveBeenCalledWith('leader-token', 'team-1', 'resource-1');
    expect(await screen.findByText(/no hay recursos libres para asignar/i)).toBeInTheDocument();
  });

  it('si la API responde 409 al asignar, el mensaje se muestra en pantalla y la lista de recursos se refresca', async () => {
    vi.mocked(teamsService.listMyTeams).mockResolvedValue([
      {
        id: 'team-1',
        name: 'Backend',
        description: 'Equipo de backend',
        ownerId: 'leader-1',
        createdAt: new Date().toISOString(),
      },
    ]);
    vi.mocked(teamsService.listAvailableResources).mockResolvedValueOnce([
      { id: 'resource-1', email: 'recurso@tabsum.com', name: 'Recurso Uno' },
    ]);
    vi.mocked(teamsService.assignResource).mockRejectedValue(
      new Error('El recurso ya pertenece a un equipo'),
    );
    // Tras el 409 la página refresca la lista de libres: ya no aparece (otro
    // proceso lo tomó primero, condición de carrera).
    vi.mocked(teamsService.listAvailableResources).mockResolvedValueOnce([]);

    const user = userEvent.setup();
    render(<LeaderTeamsPage />);
    await screen.findByRole('option', { name: 'Recurso Uno (recurso@tabsum.com)' });

    await user.selectOptions(screen.getByLabelText(/^equipo$/i), 'team-1');
    await user.selectOptions(screen.getByLabelText(/^recurso$/i), 'resource-1');
    await user.click(screen.getByRole('button', { name: /asignar recurso/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('El recurso ya pertenece a un equipo');
    expect(await screen.findByText(/no hay recursos libres para asignar/i)).toBeInTheDocument();
    expect(teamsService.listAvailableResources).toHaveBeenCalledTimes(2);
  });

  it('enviar el formulario con un nombre vacío muestra el error de validación de zod y no llama a createTeam', async () => {
    vi.mocked(teamsService.listMyTeams).mockResolvedValue([]);
    vi.mocked(teamsService.listAvailableResources).mockResolvedValue([]);

    const user = userEvent.setup();
    render(<LeaderTeamsPage />);
    await screen.findByText(/no tenés equipos creados todavía/i);

    await user.type(screen.getByLabelText(/^descripción$/i), 'Equipo sin nombre');
    await user.click(screen.getByRole('button', { name: /crear equipo/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Ingresá un nombre');
    expect(teamsService.createTeam).not.toHaveBeenCalled();
  });

  it('si la API responde 409 al crear un equipo, el mensaje se muestra en pantalla y el formulario conserva lo tipeado', async () => {
    vi.mocked(teamsService.listMyTeams).mockResolvedValue([]);
    vi.mocked(teamsService.listAvailableResources).mockResolvedValue([]);
    vi.mocked(teamsService.createTeam).mockRejectedValue(
      new Error('Ya existe un equipo con ese nombre'),
    );

    const user = userEvent.setup();
    render(<LeaderTeamsPage />);
    await screen.findByText(/no tenés equipos creados todavía/i);

    await user.type(screen.getByLabelText(/^nombre$/i), 'Backend');
    await user.type(screen.getByLabelText(/^descripción$/i), 'Equipo de backend');
    await user.click(screen.getByRole('button', { name: /crear equipo/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Ya existe un equipo con ese nombre');
    expect(screen.getByLabelText(/^nombre$/i)).toHaveValue('Backend');
  });

  it('si falla la carga inicial de equipos o recursos, se muestra el error y las listas quedan vacías en vez de romper la página', async () => {
    vi.mocked(teamsService.listMyTeams).mockRejectedValue(new Error('No se pudo cargar el listado de equipos'));
    vi.mocked(teamsService.listAvailableResources).mockRejectedValue(
      new Error('No se pudo cargar el listado de recursos libres'),
    );

    render(<LeaderTeamsPage />);

    expect(await screen.findByText('No se pudo cargar el listado de equipos')).toBeInTheDocument();
    expect(await screen.findByText('No se pudo cargar el listado de recursos libres')).toBeInTheDocument();
    expect(await screen.findByText(/no tenés equipos creados todavía/i)).toBeInTheDocument();
    expect(await screen.findByText(/no hay recursos libres para asignar/i)).toBeInTheDocument();
  });
});
