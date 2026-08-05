// Único punto de la app que llama a `/auth/*`. Usa `credentials: 'include'`
// para que el browser envíe/reciba la cookie httpOnly `refresh_token`
// (ver AGENTS.md — los componentes nunca llaman a la API directamente).

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export type UserRole = 'ADMIN' | 'PM' | 'LEADER' | 'RESOURCE';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export interface RefreshResponse {
  accessToken: string;
}

/**
 * Extrae el mensaje de error del formato `{ statusCode, message, error }` que
 * devuelve `HttpExceptionFilter` en el backend. `message` puede ser un string
 * (ConflictException, UnauthorizedException, ...) o un array de strings
 * (errores de `ValidationPipe`).
 */
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

export async function login(email: string, password: string): Promise<LoginResponse> {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return handleResponse<LoginResponse>(response);
}

export async function refresh(): Promise<RefreshResponse> {
  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  });
  return handleResponse<RefreshResponse>(response);
}

export async function logout(accessToken: string): Promise<{ message: string }> {
  const response = await fetch(`${API_URL}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return handleResponse<{ message: string }>(response);
}
