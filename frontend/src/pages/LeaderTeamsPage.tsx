import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { z } from 'zod';
import { useAuth } from '../hooks/use-auth';
import {
  assignResource,
  createTeam,
  listAvailableResources,
  listMyTeams,
} from '../services/teams.service';
import type { Team, TeamMember } from '../services/teams.service';
import './LeaderTeamsPage.css';

// Espejo de `backend/src/teams/dto/create-team.dto.ts`: feedback inmediato de
// UX, nunca reemplaza la validación autoritativa del servidor.
const createTeamSchema = z.object({
  name: z.string().min(1, 'Ingresá un nombre').max(30, 'Máximo 30 caracteres'),
  description: z.string().min(1, 'Ingresá una descripción').max(255, 'Máximo 255 caracteres'),
});

export function LeaderTeamsPage() {
  const { user, accessToken } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoadingTeams, setIsLoadingTeams] = useState(true);

  const [availableResources, setAvailableResources] = useState<TeamMember[]>([]);
  const [isLoadingResources, setIsLoadingResources] = useState(true);

  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [selectedResourceId, setSelectedResourceId] = useState('');
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignSuccess, setAssignSuccess] = useState<string | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);

  const loadTeams = useCallback(async (): Promise<void> => {
    setIsLoadingTeams(true);
    try {
      const result = await listMyTeams(accessToken ?? '');
      setTeams(result);
    } catch (err) {
      // Nunca se traga el error de la API — se muestra en pantalla, y el
      // listado queda vacío en vez de romper la página.
      setCreateError(err instanceof Error ? err.message : 'No se pudo cargar el listado de equipos');
      setTeams([]);
    } finally {
      setIsLoadingTeams(false);
    }
  }, [accessToken]);

  const loadResources = useCallback(async (): Promise<void> => {
    setIsLoadingResources(true);
    try {
      const result = await listAvailableResources(accessToken ?? '');
      setAvailableResources(result);
    } catch (err) {
      setAssignError(
        err instanceof Error ? err.message : 'No se pudo cargar el listado de recursos libres',
      );
      setAvailableResources([]);
    } finally {
      setIsLoadingResources(false);
    }
  }, [accessToken]);

  useEffect(() => {
    // La segunda capa de defensa de más abajo también bloquea el render para
    // roles no-LEADER, pero evitamos además las llamadas de red innecesarias acá.
    if (user?.role !== 'LEADER') {
      setIsLoadingTeams(false);
      setIsLoadingResources(false);
      return;
    }

    void loadTeams();
    void loadResources();
  }, [user, accessToken, loadTeams, loadResources]);

  // Segunda capa de defensa además de `ProtectedRoute`: esta página nunca se
  // renderiza para alguien que no sea LEADER (per spec, mismo patrón que
  // PMClientsPage).
  if (user?.role !== 'LEADER') {
    return <p role="alert">No tenés permiso para acceder a esta página.</p>;
  }

  const handleCreateSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setCreateError(null);
    setCreateSuccess(null);

    const parsed = createTeamSchema.safeParse({ name, description });
    if (!parsed.success) {
      setCreateError(parsed.error.issues[0]?.message ?? 'Datos inválidos');
      return;
    }

    setIsCreating(true);
    try {
      const created = await createTeam(accessToken ?? '', parsed.data);
      setTeams((previous) => [...previous, created]);
      setCreateSuccess(`Equipo ${created.name} creado.`);
      setName('');
      setDescription('');
    } catch (err) {
      // Nunca se traga el error de la API — se muestra en pantalla (p. ej.
      // 409 nombre duplicado) y el formulario conserva lo tipeado.
      setCreateError(err instanceof Error ? err.message : 'No se pudo crear el equipo');
    } finally {
      setIsCreating(false);
    }
  };

  const handleAssign = async (): Promise<void> => {
    setAssignError(null);
    setAssignSuccess(null);

    if (!selectedTeamId || !selectedResourceId) {
      setAssignError('Seleccioná un equipo y un recurso');
      return;
    }

    setIsAssigning(true);
    try {
      await assignResource(accessToken ?? '', selectedTeamId, selectedResourceId);
      setAssignSuccess('Recurso asignado.');
      setSelectedResourceId('');
      // Se refrescan ambos listados: el equipo puede mostrar información
      // derivada de sus miembros más adelante, y la lista de libres ya no
      // debe incluir al recurso recién asignado.
      await Promise.all([loadTeams(), loadResources()]);
    } catch (err) {
      // Nunca se traga el error de la API (p. ej. 409 recurso ya asignado,
      // incluida la condición de carrera). Se refresca la lista de recursos
      // libres para reflejar el estado real del servidor.
      setAssignError(err instanceof Error ? err.message : 'No se pudo asignar el recurso');
      await loadResources();
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <div className="leader-teams-page">
      <h1>Equipos</h1>
      <form onSubmit={handleCreateSubmit} noValidate className="leader-teams-page__form">
        <div className="leader-teams-page__field">
          <label htmlFor="team-name">Nombre</label>
          <input
            id="team-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="leader-teams-page__field">
          <label htmlFor="team-description">Descripción</label>
          <textarea
            id="team-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        <button type="submit" disabled={isCreating}>
          Crear equipo
        </button>
      </form>
      {createError && <p role="alert">{createError}</p>}
      {createSuccess && <p role="status">{createSuccess}</p>}

      <h2>Mis equipos</h2>
      {isLoadingTeams ? (
        <p>Cargando equipos...</p>
      ) : teams.length === 0 ? (
        <p>No tenés equipos creados todavía.</p>
      ) : (
        <ul className="leader-teams-page__list">
          {teams.map((team) => (
            <li key={team.id} className="leader-teams-page__list-item">
              <strong>{team.name}</strong>
              <span>{team.description}</span>
            </li>
          ))}
        </ul>
      )}

      <h2>Asignar recursos</h2>
      {teams.length > 0 && (
        <div className="leader-teams-page__field">
          <label htmlFor="assign-team">Equipo</label>
          <select
            id="assign-team"
            value={selectedTeamId}
            onChange={(event) => setSelectedTeamId(event.target.value)}
          >
            <option value="">Seleccioná un equipo</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {isLoadingResources ? (
        <p>Cargando recursos...</p>
      ) : availableResources.length === 0 ? (
        <p>No hay recursos libres para asignar.</p>
      ) : (
        <div className="leader-teams-page__field">
          <label htmlFor="assign-resource">Recurso</label>
          <select
            id="assign-resource"
            value={selectedResourceId}
            onChange={(event) => setSelectedResourceId(event.target.value)}
          >
            <option value="">Seleccioná un recurso</option>
            {availableResources.map((resource) => (
              <option key={resource.id} value={resource.id}>
                {resource.name} ({resource.email})
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void handleAssign()}
            disabled={isAssigning || !selectedTeamId || !selectedResourceId}
          >
            Asignar recurso
          </button>
        </div>
      )}
      {assignError && <p role="alert">{assignError}</p>}
      {assignSuccess && <p role="status">{assignSuccess}</p>}
    </div>
  );
}
