import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../hooks/use-auth';
import { listAllTeamsComposition } from '../services/teams.service';
import type { TeamComposition } from '../services/teams.service';
import type { UserRole } from '../services/auth.service';
import './TeamsCompositionPage.css';

// Segunda capa de defensa además de `ProtectedRoute`: esta página nunca se
// renderiza para alguien fuera de PM/LEADER/RESOURCE (mismo patrón que
// LeaderTeamsPage.tsx/PMClientsPage.tsx).
const ALLOWED_ROLES: UserRole[] = ['PM', 'LEADER', 'RESOURCE'];

export function TeamsCompositionPage() {
  const { user, accessToken } = useAuth();
  const [teams, setTeams] = useState<TeamComposition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAllowed = !!user?.role && ALLOWED_ROLES.includes(user.role);

  const loadComposition = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const result = await listAllTeamsComposition(accessToken ?? '');
      setTeams(result);
      setError(null);
    } catch (err) {
      // Nunca se traga el error de la API — se muestra en pantalla, y el
      // listado queda vacío en vez de romper la página.
      setError(err instanceof Error ? err.message : 'No se pudo cargar la composición de equipos');
      setTeams([]);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!isAllowed) {
      setIsLoading(false);
      return;
    }
    void loadComposition();
  }, [isAllowed, accessToken, loadComposition]);

  if (!isAllowed) {
    return <p role="alert">No tenés permiso para acceder a esta página.</p>;
  }

  return (
    <div className="teams-composition-page">
      <h1>Composición de equipos</h1>
      {error && <p role="alert">{error}</p>}
      {isLoading ? (
        <p>Cargando equipos...</p>
      ) : teams.length === 0 ? (
        <p>No hay equipos creados todavía.</p>
      ) : (
        <ul className="teams-composition-page__list">
          {teams.map((team) => (
            <li key={team.id} className="teams-composition-page__list-item">
              <strong>{team.name}</strong>
              <span>{team.description}</span>
              <p>
                Dueño: <span>{team.owner.name}</span>
              </p>
              {team.members.length === 0 ? (
                <p>Sin miembros asignados.</p>
              ) : (
                <ul>
                  {team.members.map((member) => (
                    <li key={member.id}>{member.name}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
