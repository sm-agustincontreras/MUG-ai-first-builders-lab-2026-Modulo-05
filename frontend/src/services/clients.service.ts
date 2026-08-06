// Único punto de la app que llama a `/clients`. Mismo patrón que
// users.service.ts: nunca traga errores, siempre los relanza.

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export interface CreateClientPayload {
  name: string;
  description: string;
}

export interface Client {
  id: string;
  name: string;
  description: string;
  createdAt: string;
}

async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    const message = (body as { message?: unknown } | null)?.message;
    if (Array.isArray(message)) {
      return message.join(', ');
    }
    if (typeof message === 'string') {
      return message;
    }
  } catch {
    // El body no era JSON parseable — se usa el mensaje genérico de abajo.
  }
  return `Error ${response.status}`;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }
  return (await response.json()) as T;
}

export async function createClient(
  accessToken: string,
  payload: CreateClientPayload,
): Promise<Client> {
  const response = await fetch(`${API_URL}/clients`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
  return handleResponse<Client>(response);
}

export async function listClients(accessToken: string): Promise<Client[]> {
  const response = await fetch(`${API_URL}/clients`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return handleResponse<Client[]>(response);
}
