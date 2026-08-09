# Spec FEAT-003c: Composición de equipos

| Field | Value |
|-------|-------|
| Ticket | FEAT-003c |
| PRD | docs/daw/prd/prd-FEAT-003c.md |
| Tier | FEATURE |
| Date | 2026-08-09 |
| Spec loops | 0 |

## Summary

Se agrega un endpoint de lectura `GET /teams/composition` que devuelve, para todos los equipos del
sistema, su nombre, descripción, dueño (nombre) y lista de miembros (nombre) — accesible a los
roles PM, LEADER y RESOURCE (primer uso real de `@Roles(...)` con más de un rol en el código). En
el frontend se agrega una página de solo lectura (`TeamsCompositionPage`) que consume ese endpoint,
reutilizando el patrón de servicio/estado vacío/manejo de errores ya establecido en
`LeaderTeamsPage`/`PMClientsPage`. `ProtectedRoute` se ensancha para aceptar un array de roles
permitidos, manteniendo compatibilidad hacia atrás con sus 3 usos actuales de rol único.

## Coverage: PRD → blocks

| Requirement | Covered by |
|---|---|
| FR-01 | Block 1, Block 2 |
| FR-02 | Block 1, Block 2 |
| NFR-01 | Block 1 (JwtAuthGuard rechaza no autenticado → AC-03) |
| NFR-02 | Strategy: sin paginación ni joins adicionales más allá de `include: {owner, members}`; volumen esperado (pymes) cumple <1s sin optimización adicional, consistente con NFR-03 de FEAT-002 |

## Dependencies between blocks

Block 2 depende de Block 1 (el frontend consume el endpoint que Block 1 crea). Ejecutar en orden:
Block 1 → Block 2.

## Block 1 — Backend: endpoint de composición de equipos

**Files**
- `backend/src/teams/dto/team-composition-member.dto.ts` (new) — DTO `{id, name}`.
- `backend/src/teams/dto/team-composition-response.dto.ts` (new) — DTO `{id, name, description, owner, members[]}`.
- `backend/src/teams/teams.service.ts` (modified) — agrega `listAllComposition()`.
- `backend/src/teams/teams.controller.ts` (modified) — agrega handler `GET /teams/composition`.
- `backend/src/teams/teams.controller.spec.ts` (modified) — extiende el mock de Prisma y agrega tests.

**Logic**

`team-composition-member.dto.ts`:
```ts
export interface TeamCompositionMemberEntityLike {
  id: string;
  name: string;
}

export class TeamCompositionMemberDto {
  readonly id: string;
  readonly name: string;

  private constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }

  static fromEntity(user: TeamCompositionMemberEntityLike): TeamCompositionMemberDto {
    return new TeamCompositionMemberDto(user.id, user.name);
  }
}
```
Deliberadamente excluye `email`/`role`/`passwordHash`/`refreshTokenHash` — mismo criterio de
minimización que `team-member-response.dto.ts` (FEAT-003b), reforzado acá porque este endpoint es
legible por RESOURCE (mitigación 2 del threat model).

`team-composition-response.dto.ts`:
```ts
export interface TeamCompositionEntityLike {
  id: string;
  name: string;
  description: string;
  owner: TeamCompositionMemberEntityLike;
  members: TeamCompositionMemberEntityLike[];
}

export class TeamCompositionResponseDto {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly owner: TeamCompositionMemberDto;
  readonly members: TeamCompositionMemberDto[];

  private constructor(
    id: string,
    name: string,
    description: string,
    owner: TeamCompositionMemberDto,
    members: TeamCompositionMemberDto[],
  ) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.owner = owner;
    this.members = members;
  }

  static fromEntity(team: TeamCompositionEntityLike): TeamCompositionResponseDto {
    return new TeamCompositionResponseDto(
      team.id,
      team.name,
      team.description,
      TeamCompositionMemberDto.fromEntity(team.owner),
      team.members.map((m) => TeamCompositionMemberDto.fromEntity(m)),
    );
  }
}
```

`teams.service.ts` — nuevo método:
```ts
async listAllComposition(): Promise<TeamCompositionResponseDto[]> {
  const teams = await this.prisma.team.findMany({
    include: { owner: true, members: true },
    orderBy: { name: 'asc' },
  });
  return teams.map((t) => TeamCompositionResponseDto.fromEntity(t));
}
```
`orderBy: { name: 'asc' }` da un orden estable para la UI (no requerido por el PRD, pero evita que
el listado "salte" entre renders).

`teams.controller.ts` — nuevo handler, agregado junto a los existentes:
```ts
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PM, UserRole.LEADER, UserRole.RESOURCE)
@Get('composition')
async listComposition(): Promise<TeamCompositionResponseDto[]> {
  return this.teamsService.listAllComposition();
}
```
`JwtAuthGuard` antes de `RolesGuard`, mismo orden que todo handler existente en el archivo (puebla
`request.user` antes de que `RolesGuard` lo lea).

**API contract**

- Method + path: `GET /teams/composition`
- Request: sin body, sin querystring (Out of Scope del PRD excluye filtros/búsqueda).
- Response `200`: `TeamCompositionResponseDto[]` — `[]` si no hay equipos creados (AC-04, el
  estado vacío lo renderiza el frontend, no el backend).
  ```json
  [
    {
      "id": "team_1",
      "name": "Equipo Alfa",
      "description": "...",
      "owner": { "id": "usr_1", "name": "Ana Líder" },
      "members": [{ "id": "usr_2", "name": "Beto Recurso" }]
    }
  ]
  ```
- Error codes: `401` (no autenticado, AC-03), `403` (autenticado con rol fuera de
  PM/LEADER/RESOURCE — p. ej. ADMIN, no contemplado por el PRD).
- Auth: `JwtAuthGuard` + `RolesGuard` con `@Roles(PM, LEADER, RESOURCE)`.

**Data model**

Ninguno nuevo — reutiliza `Team`/`User` y las relaciones `TeamOwner`/`TeamMembers` ya definidas en
`backend/prisma/schema.prisma:44-55`. Sin migración.

**Input validation**

No aplica — el endpoint no acepta input.

**Error handling**

`JwtAuthGuard`/`RolesGuard` lanzan `UnauthorizedException`/`ForbiddenException` (ya capturadas por
el exception filter global del proyecto). El service no introduce manejo de errores propio: no hay
`findUnique`/`findUniqueOrThrow` que pueda fallar por "no encontrado" (es un listado, no una
búsqueda puntual).

**Required tests**

- [ ] PM autenticado recibe `200` con la composición completa de todos los equipos (nombre,
  descripción, dueño, miembros) — valida AC-01.
- [ ] LEADER autenticado recibe `200` con la composición completa — valida AC-01.
- [ ] RESOURCE autenticado recibe `200` con la misma composición, sin que el payload incluya campos
  de acción/mutación (el DTO no los tiene) — valida AC-02.
- [ ] Request sin token recibe `401` — valida AC-03.
- [ ] Sin equipos creados, la respuesta es `200` con `[]` (no `404` ni error) — soporta AC-04.
- [ ] ADMIN autenticado (rol fuera de PM/LEADER/RESOURCE) recibe `403` — valida el código de error
  documentado en el contrato de API de este bloque.
- [ ] El mock de `createTeamPrismaMock` recibe la lista de usuarios sembrados como segundo
  argumento y resuelve `owner`/`members` contra ella cuando `findMany` se llama con `include`.

**Completion criterion**

Los 7 tests de arriba pasan; `GET /teams/composition` responde `200` con la forma documentada para
PM/LEADER/RESOURCE, `401` sin token y `403` para un rol no autorizado.

## Block 2 — Frontend: vista de composición de equipos

**Files**
- `frontend/src/services/teams.service.ts` (modified) — agrega tipos y `listAllTeamsComposition`.
- `frontend/src/components/ProtectedRoute.tsx` (modified) — `requiredRole` acepta array.
- `frontend/src/components/ProtectedRoute.spec.tsx` (modified) — cobertura del caso array.
- `frontend/src/pages/TeamsCompositionPage.tsx` (new) — página de solo lectura.
- `frontend/src/pages/TeamsCompositionPage.spec.tsx` (new).
- `frontend/src/App.tsx` (modified) — ruta `/teams/composition`.

**Logic**

`teams.service.ts` — agregar, siguiendo el patrón exacto de `listMyTeams`/`handleResponse` ya
presente en el archivo:
```ts
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
```

`ProtectedRoute.tsx` — ensanchar el tipo y la comparación. **Cuidado de tipos (hallazgo del
arch-auditor en PLAN): `user?.role` es `UserRole | undefined` bajo `strict: true` — nunca llamar
`.includes(user?.role)` directamente.**
```ts
interface ProtectedRouteProps {
  children: ReactNode;
  /** Si se indica, además de requerir sesión, exige ese rol (o uno de esos roles) exacto. */
  requiredRole?: UserRole | UserRole[];
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const hasRequiredRole =
    requiredRole === undefined ||
    (Array.isArray(requiredRole)
      ? !!user?.role && requiredRole.includes(user.role)
      : user?.role === requiredRole);

  if (!hasRequiredRole) {
    return <p role="alert">No tenés permiso para acceder a esta página.</p>;
  }

  return <>{children}</>;
}
```
Compatible hacia atrás: los 3 usos existentes (`requiredRole="ADMIN"`, `"PM"`, `"LEADER"`) siguen
tomando la rama `else` sin cambios de comportamiento.

`TeamsCompositionPage.tsx` — mismo esqueleto que `LeaderTeamsPage.tsx`/`PMClientsPage.tsx`: `useAuth`
para `user`/`accessToken`, `useCallback`+`useEffect` para cargar al montar, estado de `loading`,
nunca traga errores de `listAllTeamsComposition` (los guarda en un `error: string | null` y los
renderiza con `role="alert"`), estado vacío en texto plano si `teams.length === 0`. Segunda capa de
defensa (mismo patrón que `LeaderTeamsPage.tsx:73,86`):
```ts
const ALLOWED_ROLES: UserRole[] = ['PM', 'LEADER', 'RESOURCE'];

// dentro del componente, antes del useEffect de carga:
const isAllowed = !!user?.role && ALLOWED_ROLES.includes(user.role);

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
```
Estrictamente sin ningún `<form>`/`<button>` de creación o asignación — solo listado (`<ul>`/`<li>`
o estructura equivalente) con nombre, descripción, dueño y miembros de cada equipo, cubriendo AC-01
y AC-02 (mitigación 4 del threat model).

`App.tsx` — agregar la ruta:
```tsx
<Route
  path="/teams/composition"
  element={
    <ProtectedRoute requiredRole={['PM', 'LEADER', 'RESOURCE']}>
      <TeamsCompositionPage />
    </ProtectedRoute>
  }
/>
```

**API contract**

No aplica (bloque de frontend, consume el contrato de Block 1).

**Data model**

No aplica.

**Input validation**

No aplica — página de solo lectura sin formularios.

**Error handling**

`listAllTeamsComposition` propaga cualquier error de red/HTTP (vía `handleResponse`, que ya lanza
`Error` con el mensaje del backend); `TeamsCompositionPage` lo captura en su `try/catch` de carga y
lo muestra con `role="alert"`, nunca lo descarta silenciosamente (mismo patrón que
`LeaderTeamsPage.tsx`/`PMClientsPage.tsx`).

**Required tests**

- [ ] PM ve la composición completa de todos los equipos (nombre, descripción, dueño, miembros) —
  valida AC-01.
- [ ] LEADER ve la composición completa — valida AC-01.
- [ ] RESOURCE ve la composición completa en modo lectura, sin ningún control de creación/asignación
  en el DOM — valida AC-02.
- [ ] Usuario con rol fuera de PM/LEADER/RESOURCE (p. ej. ADMIN) ve el mensaje de acceso denegado en
  vez de la lista.
- [ ] Estado de carga se muestra mientras la promesa está pendiente.
- [ ] Sin equipos, se muestra el texto de estado vacío en vez de una lista vacía silenciosa o
  pantalla en blanco — valida AC-04.
- [ ] Un error de la API se muestra con `role="alert"` y no se traga.
- [ ] `ProtectedRoute` con `requiredRole` array: un usuario con uno de los roles permitidos
  renderiza el contenido protegido; un usuario fuera del array ve el mensaje de acceso denegado.

**Completion criterion**

Los 8 tests de arriba pasan; `tsc -b --noEmit` en `frontend/` no reporta errores (cierra el FAIL de
tipos detectado por el arch-auditor en PLAN); la página en `/teams/composition` es accesible para
PM/LEADER/RESOURCE y muestra la composición real servida por Block 1.

## Final verification

- Backend: `npm --prefix backend test` verde, incluyendo los 6 tests nuevos de
  `teams.controller.spec.ts`.
- Frontend: `npm --prefix frontend test` verde, incluyendo los 8 tests nuevos entre
  `TeamsCompositionPage.spec.tsx` y `ProtectedRoute.spec.tsx`; `tsc -b --noEmit` sin errores.
- Manual: con sesión PM, LEADER y RESOURCE (una por vez), `/teams/composition` muestra la misma
  composición de equipos, sin ningún control de mutación visible para ninguno de los tres roles.
- `GET /teams/composition` sin token responde `401`.

---

┌─────────────────────────────────────────────────────────────┐
│  /daw-validate-spec spec-FEAT-003c — PASSED                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  PRD coverage:                                               │
│    ✅ F-SPEC-01: FR-01 → Block 1, Block 2                    │
│    ✅ F-SPEC-01: FR-02 → Block 1, Block 2                    │
│    ✅ F-SPEC-02: AC-01/AC-02/AC-03/AC-04 → cada una con al    │
│       menos un test en Block 1 y/o Block 2                    │
│    ✅ F-SPEC-03: NFR-01 (JwtAuthGuard) y NFR-02 (sin           │
│       paginación, volumen pyme) con estrategia documentada     │
│                                                              │
│  Per-block completeness:                                     │
│    ✅ F-SPEC-04: archivos listados en ambos bloques           │
│    ✅ F-SPEC-05: criterio de completitud verificable en        │
│       ambos bloques                                            │
│    ✅ F-SPEC-06: 7 tests en Block 1, 8 tests en Block 2        │
│    ✅ F-SPEC-07: contrato completo de `GET /teams/composition` │
│       (método, path, request, response con tipos+ejemplo,      │
│       error codes, auth)                                       │
│    ✅ F-SPEC-08: Block 1 declara explícitamente "sin schema     │
│       nuevo, sin migración"                                     │
│    ✅ F-SPEC-09: ambos bloques declaran explícitamente "no      │
│       aplica" con la razón (sin input / sin formularios)         │
│    ✅ F-SPEC-10: sección de manejo de errores en ambos bloques  │
│    ✅ F-SPEC-11: dependencia Block 2 → Block 1 declarada        │
│    ✅ F-SPEC-16: los 3 errores documentados en Block 1 (401,    │
│       403, propagación de errores en Block 2) tienen cada uno   │
│       su test correspondiente — corregido tras detectar que     │
│       el 403 no tenía test asociado                             │
│                                                              │
│  Consistency with the PRD:                                   │
│    ✅ F-SPEC-12: el diseño satisface NFR-02 sin contradecirlo   │
│    ✅ F-SPEC-13: terminología consistente (equipo, dueño,       │
│       miembros, composición)                                    │
│                                                              │
│  Warnings:                                                    │
│    ⚠️ W-SPEC-02: Block 2 modifica/crea 6 archivos (> 5) —      │
│       no bloqueante; los 6 archivos son cohesivos (servicio,    │
│       gate compartido + su test, página + su test, ruteo) y     │
│       dividirlos no reduce el acoplamiento real                  │
│    — W-SPEC-03 no aplica (sin cambios de schema/migración)      │
│                                                              │
│  ────────────────────────────────────────────────────────────│
│  Total: 13 passed, 0 failed, 1 warning                        │
│  Result: PASSED                                               │
│  Next: presentar al usuario para aprobación                   │
└─────────────────────────────────────────────────────────────┘
