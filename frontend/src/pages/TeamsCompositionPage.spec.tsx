import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as teamsService from '../services/teams.service';
import type { TeamComposition } from '../services/teams.service';
import { TeamsCompositionPage } from './TeamsCompositionPage';

const mockUseAuth = vi.fn();
vi.mock('../hooks/use-auth', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../services/teams.service', async () => {
  const actual = await vi.importActual<typeof import('../services/teams.service')>(
    '../services/teams.service',
  );
  return { ...actual, listAllTeamsComposition: vi.fn() };
});

const composition: TeamComposition[] = [
  {
    id: 'team-1',
    name: 'Equipo Alfa',
    description: 'Equipo de backend',
    owner: { id: 'usr-1', name: 'Ana Líder' },
    members: [{ id: 'usr-2', name: 'Beto Recurso' }],
  },
];

function mockUser(role: string) {
  mockUseAuth.mockReturnValue({
    user: { id: 'u1', email: `${role.toLowerCase()}@tabsum.com`, role, createdAt: new Date().toISOString() },
    accessToken: 'a-token',
    isAuthenticated: true,
    login: vi.fn(),
    logout: vi.fn(),
  });
}

describe('TeamsCompositionPage', () => {
  afterEach(() => {
    vi.mocked(teamsService.listAllTeamsComposition).mockReset();
  });

  beforeEach(() => {
    mockUser('PM');
  });

  it('un usuario PM ve la composición completa de todos los equipos', async () => {
    vi.mocked(teamsService.listAllTeamsComposition).mockResolvedValue(composition);

    render(<TeamsCompositionPage />);

    expect(await screen.findByText('Equipo Alfa')).toBeInTheDocument();
    expect(screen.getByText('Equipo de backend')).toBeInTheDocument();
    expect(screen.getByText('Ana Líder')).toBeInTheDocument();
    expect(screen.getByText('Beto Recurso')).toBeInTheDocument();
  });

  it('un usuario LEADER ve la composición completa de todos los equipos', async () => {
    mockUser('LEADER');
    vi.mocked(teamsService.listAllTeamsComposition).mockResolvedValue(composition);

    render(<TeamsCompositionPage />);

    expect(await screen.findByText('Equipo Alfa')).toBeInTheDocument();
    expect(screen.getByText('Ana Líder')).toBeInTheDocument();
  });

  it('un usuario RESOURCE ve la composición completa en modo lectura, sin ningún control de mutación', async () => {
    mockUser('RESOURCE');
    vi.mocked(teamsService.listAllTeamsComposition).mockResolvedValue(composition);

    render(<TeamsCompositionPage />);

    expect(await screen.findByText('Equipo Alfa')).toBeInTheDocument();
    expect(screen.getByText('Beto Recurso')).toBeInTheDocument();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(document.querySelector('form')).toBeNull();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('un usuario con rol fuera de PM/LEADER/RESOURCE ve el mensaje de acceso denegado', () => {
    mockUser('ADMIN');

    render(<TeamsCompositionPage />);

    expect(screen.getByRole('alert')).toHaveTextContent('No tenés permiso para acceder a esta página.');
    expect(teamsService.listAllTeamsComposition).not.toHaveBeenCalled();
  });

  it('mientras listAllTeamsComposition está en vuelo se muestra el indicador de carga', async () => {
    let resolveList: (value: TeamComposition[]) => void = () => {};
    vi.mocked(teamsService.listAllTeamsComposition).mockReturnValue(
      new Promise((resolve) => {
        resolveList = resolve;
      }),
    );

    render(<TeamsCompositionPage />);

    expect(screen.getByText(/cargando equipos/i)).toBeInTheDocument();

    resolveList([]);
    await screen.findByText(/no hay equipos creados todavía/i);
  });

  it('sin equipos, se muestra el texto de estado vacío en vez de una lista vacía silenciosa', async () => {
    vi.mocked(teamsService.listAllTeamsComposition).mockResolvedValue([]);

    render(<TeamsCompositionPage />);

    expect(await screen.findByText(/no hay equipos creados todavía/i)).toBeInTheDocument();
  });

  it('un error de la API se muestra con role="alert" y no se traga', async () => {
    vi.mocked(teamsService.listAllTeamsComposition).mockRejectedValue(
      new Error('No se pudo conectar con el servidor'),
    );

    render(<TeamsCompositionPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar con el servidor');
  });
});
