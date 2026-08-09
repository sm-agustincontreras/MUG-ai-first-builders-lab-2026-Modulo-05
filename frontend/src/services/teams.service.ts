// Único punto de la app que llama a `/teams`. Mismo patrón que
// clients.service.ts: nunca traga errores, siempre los relanza.

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export interface CreateTeamPayload {
  name: string;
  description: string;
}

export interface Team {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  createdAt: string;
}

export interface TeamMember {
  id: string;
  email: string;
  name: string;
}

export interface TeamCompositionMember {
  id: string;
  name: string;
}

export interface TeamComposition {
  id: string;
  name: string;
  description: string;
  owner: TeamCompositionMember;
  members: TeamCompositionMember[];
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

export async function createTeam(
  accessToken: string,
  payload: CreateTeamPayload,
): Promise<Team> {
  const response = await fetch(`${API_URL}/teams`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
  return handleResponse<Team>(response);
}

export async function assignResource(
  accessToken: string,
  teamId: string,
  resourceId: string,
): Promise<TeamMember> {
  const response = await fetch(`${API_URL}/teams/${teamId}/members`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ resourceId }),
  });
  return handleResponse<TeamMember>(response);
}

export async function listAvailableResources(accessToken: string): Promise<TeamMember[]> {
  const response = await fetch(`${API_URL}/teams/available-resources`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return handleResponse<TeamMember[]>(response);
}

export async function listMyTeams(accessToken: string): Promise<Team[]> {
  const response = await fetch(`${API_URL}/teams/mine`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return handleResponse<Team[]>(response);
}

export async function listAllTeamsComposition(accessToken: string): Promise<TeamComposition[]> {
  const response = await fetch(`${API_URL}/teams/composition`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return handleResponse<TeamComposition[]>(response);
}
