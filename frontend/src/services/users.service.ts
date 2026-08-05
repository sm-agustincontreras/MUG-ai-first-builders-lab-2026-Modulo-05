// Único punto de la app que llama a `/users`. Mismo patrón que
// auth.service.ts: nunca traga errores, siempre los relanza.
import type { UserRole } from './auth.service';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export type { UserRole };

export interface CreateUserPayload {
  email: string;
  password: string;
  role: UserRole;
}

export interface CreatedUser {
  id: string;
  email: string;
  role: UserRole;
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

export async function createUser(
  accessToken: string,
  payload: CreateUserPayload,
): Promise<CreatedUser> {
  const response = await fetch(`${API_URL}/users`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
  return handleResponse<CreatedUser>(response);
}
