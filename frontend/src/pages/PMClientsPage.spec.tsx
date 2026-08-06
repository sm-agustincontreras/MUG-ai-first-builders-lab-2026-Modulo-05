import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as clientsService from '../services/clients.service';
import type { Client } from '../services/clients.service';
import { PMClientsPage } from './PMClientsPage';

const mockUseAuth = vi.fn();
vi.mock('../hooks/use-auth', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../services/clients.service', async () => {
  const actual = await vi.importActual<typeof import('../services/clients.service')>(
    '../services/clients.service',
  );
  return { ...actual, createClient: vi.fn(), listClients: vi.fn() };
});

const pmUser = {
  id: 'pm-1',
  email: 'pm@tabsum.com',
  role: 'PM',
  createdAt: new Date().toISOString(),
};

describe('PMClientsPage', () => {
  afterEach(() => {
    vi.mocked(clientsService.createClient).mockReset();
    vi.mocked(clientsService.listClients).mockReset();
  });

  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: pmUser,
      accessToken: 'pm-token',
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
    });
  });

  it('un usuario con rol PM ve el formulario y, al cargar, el listado de clientes existentes', async () => {
    vi.mocked(clientsService.listClients).mockResolvedValue([
      { id: 'c1', name: 'Acme', description: 'Cliente histórico', createdAt: new Date().toISOString() },
    ]);

    render(<PMClientsPage />);

    expect(screen.getByLabelText(/nombre/i)).toBeInTheDocument();
    expect(await screen.findByText('Acme')).toBeInTheDocument();
    expect(screen.getByText('Cliente histórico')).toBeInTheDocument();
  });

  it('un usuario con rol distinto de PM ve el mensaje de acceso denegado y no ve el formulario', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'r-1', email: 'recurso@tabsum.com', role: 'RESOURCE', createdAt: new Date().toISOString() },
      accessToken: 'resource-token',
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
    });

    render(<PMClientsPage />);

    expect(screen.getByRole('alert')).toHaveTextContent('No tenés permiso para acceder a esta página.');
    expect(screen.queryByLabelText(/nombre/i)).not.toBeInTheDocument();
    expect(clientsService.listClients).not.toHaveBeenCalled();
  });

  it('un listado vacío muestra el empty state en vez de una tabla en blanco', async () => {
    vi.mocked(clientsService.listClients).mockResolvedValue([]);

    render(<PMClientsPage />);

    expect(await screen.findByText(/no hay clientes cargados todavía/i)).toBeInTheDocument();
  });

  it('un envío válido crea el cliente, lo agrega al listado y limpia el formulario', async () => {
    vi.mocked(clientsService.listClients).mockResolvedValue([]);
    vi.mocked(clientsService.createClient).mockResolvedValue({
      id: 'c2',
      name: 'Globex',
      description: 'Cliente nuevo',
      createdAt: new Date().toISOString(),
    });

    const user = userEvent.setup();
    render(<PMClientsPage />);
    await screen.findByText(/no hay clientes cargados todavía/i);

    await user.type(screen.getByLabelText(/nombre/i), 'Globex');
    await user.type(screen.getByLabelText(/descripción/i), 'Cliente nuevo');
    await user.click(screen.getByRole('button', { name: /crear cliente/i }));

    expect(clientsService.createClient).toHaveBeenCalledWith('pm-token', {
      name: 'Globex',
      description: 'Cliente nuevo',
    });
    expect(await screen.findByText('Globex')).toBeInTheDocument();
    expect(screen.getByLabelText(/nombre/i)).toHaveValue('');
    expect(screen.getByLabelText(/descripción/i)).toHaveValue('');
  });

  it('un envío con nombre de 31 caracteres muestra el error de validación de UX sin llamar a la API', async () => {
    vi.mocked(clientsService.listClients).mockResolvedValue([]);

    const user = userEvent.setup();
    render(<PMClientsPage />);
    await screen.findByText(/no hay clientes cargados todavía/i);

    await user.type(screen.getByLabelText(/nombre/i), 'a'.repeat(31));
    await user.type(screen.getByLabelText(/descripción/i), 'Descripción válida');
    await user.click(screen.getByRole('button', { name: /crear cliente/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Máximo 30 caracteres');
    expect(clientsService.createClient).not.toHaveBeenCalled();
  });

  it('un envío que responde 409 (nombre duplicado) muestra el mensaje del backend sin perder lo tipeado', async () => {
    vi.mocked(clientsService.listClients).mockResolvedValue([]);
    vi.mocked(clientsService.createClient).mockRejectedValue(
      new Error('Ya existe un cliente con ese nombre'),
    );

    const user = userEvent.setup();
    render(<PMClientsPage />);
    await screen.findByText(/no hay clientes cargados todavía/i);

    await user.type(screen.getByLabelText(/nombre/i), 'Acme');
    await user.type(screen.getByLabelText(/descripción/i), 'Descripción');
    await user.click(screen.getByRole('button', { name: /crear cliente/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Ya existe un cliente con ese nombre');
    expect(screen.getByLabelText(/nombre/i)).toHaveValue('Acme');
    expect(screen.getByLabelText(/descripción/i)).toHaveValue('Descripción');
  });

  it('mientras listClients está en vuelo se muestra el indicador de carga', async () => {
    let resolveList: (value: Client[]) => void = () => {};
    vi.mocked(clientsService.listClients).mockReturnValue(
      new Promise((resolve) => {
        resolveList = resolve;
      }),
    );

    render(<PMClientsPage />);

    expect(screen.getByText(/cargando clientes/i)).toBeInTheDocument();

    resolveList([]);
    await screen.findByText(/no hay clientes cargados todavía/i);
  });

  it('si listClients falla al montar, se muestra el mensaje de error y clients queda en [] sin crashear', async () => {
    vi.mocked(clientsService.listClients).mockRejectedValue(
      new Error('No se pudo conectar con el servidor'),
    );

    render(<PMClientsPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar con el servidor');
    expect(await screen.findByText(/no hay clientes cargados todavía/i)).toBeInTheDocument();
  });

  it('si listClients falla con un valor que no es Error, muestra un mensaje genérico', async () => {
    vi.mocked(clientsService.listClients).mockRejectedValue('boom');

    render(<PMClientsPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo cargar el listado de clientes',
    );
  });

  it('si createClient falla con un valor que no es Error, muestra un mensaje genérico', async () => {
    vi.mocked(clientsService.listClients).mockResolvedValue([]);
    vi.mocked(clientsService.createClient).mockRejectedValue('boom');

    const user = userEvent.setup();
    render(<PMClientsPage />);
    await screen.findByText(/no hay clientes cargados todavía/i);

    await user.type(screen.getByLabelText(/nombre/i), 'Acme');
    await user.type(screen.getByLabelText(/descripción/i), 'Descripción');
    await user.click(screen.getByRole('button', { name: /crear cliente/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo crear el cliente');
  });

  it('si accessToken es null al montar, listClients se llama con string vacío', async () => {
    mockUseAuth.mockReturnValue({
      user: pmUser,
      accessToken: null,
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(clientsService.listClients).mockResolvedValue([]);

    render(<PMClientsPage />);
    await screen.findByText(/no hay clientes cargados todavía/i);

    expect(clientsService.listClients).toHaveBeenCalledWith('');
  });

  it('si accessToken es null al crear, createClient se llama con string vacío', async () => {
    mockUseAuth.mockReturnValue({
      user: pmUser,
      accessToken: null,
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(clientsService.listClients).mockResolvedValue([]);
    vi.mocked(clientsService.createClient).mockResolvedValue({
      id: 'c3',
      name: 'Acme',
      description: 'Descripción',
      createdAt: new Date().toISOString(),
    });

    const user = userEvent.setup();
    render(<PMClientsPage />);
    await screen.findByText(/no hay clientes cargados todavía/i);

    await user.type(screen.getByLabelText(/nombre/i), 'Acme');
    await user.type(screen.getByLabelText(/descripción/i), 'Descripción');
    await user.click(screen.getByRole('button', { name: /crear cliente/i }));

    expect(clientsService.createClient).toHaveBeenCalledWith('', {
      name: 'Acme',
      description: 'Descripción',
    });
  });

  it('si el componente se desmonta antes de que listClients resuelva, no actualiza estado tras desmontar', async () => {
    let resolveList: (value: Client[]) => void = () => {};
    vi.mocked(clientsService.listClients).mockReturnValue(
      new Promise((resolve) => {
        resolveList = resolve;
      }),
    );

    const { unmount } = render(<PMClientsPage />);
    unmount();
    resolveList([]);
    await Promise.resolve();

    expect(clientsService.listClients).toHaveBeenCalledTimes(1);
  });

  it('si el componente se desmonta antes de que listClients falle, no actualiza estado tras desmontar', async () => {
    let rejectList: (reason?: unknown) => void = () => {};
    vi.mocked(clientsService.listClients).mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectList = reject;
      }),
    );

    const { unmount } = render(<PMClientsPage />);
    unmount();
    rejectList(new Error('boom'));
    await Promise.resolve();

    expect(clientsService.listClients).toHaveBeenCalledTimes(1);
  });
});
