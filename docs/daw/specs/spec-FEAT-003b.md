# Spec FEAT-003b: Alta de equipos y asignación de recursos

| Field | Value |
|-------|-------|
| Ticket | FEAT-003b |
| PRD | docs/daw/prd/prd-FEAT-003b.md |
| Tier | FEATURE |
| Date | 2026-08-08T00:31:34Z |
| Spec loops | 0 |

## Summary

Se agrega el modelo `Team` (nombre único normalizado, descripción, dueño) y la relación
`User.teamId` (nullable, sin backfill). Un módulo `teams` nuevo (DTOs, service, controller)
expone 4 endpoints restringidos a `LEADER`: crear equipo, asignar un recurso libre a un equipo
propio (con verificación explícita de ownership y una actualización atómica condicional para
cerrar la condición de carrera identificada en el threat model), listar recursos libres, y
listar los equipos propios. El frontend agrega `LeaderTeamsPage` con el mismo patrón de
formulario + listado ya usado en `PMClientsPage`.

## Coverage: PRD → blocks

| Requirement | Covered by |
|---|---|
| FR-01 | Block 1, Block 2 |
| FR-02 | Block 1 |
| FR-03 | Block 1 |
| FR-04 | Block 1, Block 2 |
| FR-05 | Block 1, Block 2 |
| NFR-01 | Strategy: `@@unique([nameNormalized])` a nivel de schema de Prisma (Block 1), mismo patrón que `Client` |
| NFR-02 | Strategy: `RolesGuard` + `@Roles(LEADER)` en los 4 endpoints de `TeamsController` (Block 1) |
| NFR-03 | Strategy: mismo guard de rol LEADER en `GET /teams/available-resources` (Block 1) |
| NFR-04 | Strategy: sin I/O adicional respecto a `Client`/`User` ya validados en FEAT-001/002 — mismo orden de magnitud de latencia |

## Dependencies between blocks

Block 1 → Block 2. Block 2 (frontend) depende del contrato de los 4 endpoints de Block 1.

## Block 1 — Backend: modelo `Team` + módulo `teams`

**Files**
- `backend/prisma/schema.prisma` (modified) — agrega `model Team` y extiende `model User` con
  `teamId`/`team`/`ownedTeams`.
- `backend/prisma/migrations/<timestamp>_add_team/migration.sql` (new) — generada con
  `prisma migrate dev` (sin edición manual: `teamId` es nullable, no requiere backfill, a
  diferencia de la migración de `User.name` en FEAT-003a).
- `backend/src/teams/dto/create-team.dto.ts` (new) — `name`/`description`.
- `backend/src/teams/dto/assign-resource.dto.ts` (new) — `resourceId`.
- `backend/src/teams/dto/team-response.dto.ts` (new) — whitelist (`id`, `name`, `description`,
  `ownerId`, `createdAt`).
- `backend/src/teams/dto/team-member-response.dto.ts` (new) — whitelist (`id`, `email`, `name`;
  sin `role` — el único consumidor ya lo fija por query, ver hallazgo del arch-auditor en PLAN).
- `backend/src/teams/teams.service.ts` (new).
- `backend/src/teams/teams.controller.ts` (new).
- `backend/src/teams/teams.module.ts` (new).
- `backend/src/app.module.ts` (modified) — registra `TeamsModule`.
- `backend/src/teams/teams.controller.spec.ts` (new).

**Logic**

`schema.prisma`:
```prisma
model Team {
  id             String   @id @default(cuid())
  name           String
  nameNormalized String
  description    String
  ownerId        String
  owner          User     @relation("TeamOwner", fields: [ownerId], references: [id])
  members        User[]   @relation("TeamMembers")
  createdAt      DateTime @default(now())

  @@unique([nameNormalized])
}
```
`model User` agrega:
```prisma
  teamId     String?
  team       Team?    @relation("TeamMembers", fields: [teamId], references: [id])
  ownedTeams Team[]   @relation("TeamOwner")
```

`create-team.dto.ts`:
```typescript
@IsString() @IsNotEmpty() @MaxLength(30)
name!: string;

@IsString() @IsNotEmpty() @MaxLength(255)
description!: string;
```

`assign-resource.dto.ts`:
```typescript
@IsString() @IsNotEmpty()
resourceId!: string;
```

`teams.service.ts`:
```typescript
async create(dto: CreateTeamDto, ownerId: string): Promise<TeamResponseDto> {
  const trimmedName = dto.name.trim();
  const trimmedDescription = dto.description.trim();
  const nameNormalized = trimmedName.toLowerCase();

  const existing = await this.prisma.team.findUnique({ where: { nameNormalized } });
  if (existing) {
    throw new ConflictException('Ya existe un equipo con ese nombre');
  }

  const team = await this.prisma.team.create({
    data: { name: trimmedName, nameNormalized, description: trimmedDescription, ownerId },
  });
  return TeamResponseDto.fromEntity(team);
}

async assignResource(teamId: string, resourceId: string, requesterId: string): Promise<TeamMemberResponseDto> {
  const team = await this.prisma.team.findUnique({ where: { id: teamId } });
  if (!team) {
    throw new NotFoundException('Equipo no encontrado');
  }
  if (team.ownerId !== requesterId) {
    // Mitigación IDOR del threat model (AC-06): la propiedad del equipo se
    // verifica en el service, independiente del RolesGuard de rol.
    throw new ForbiddenException('No tenés permiso para realizar esta acción');
  }

  const resource = await this.prisma.user.findUnique({ where: { id: resourceId } });
  if (!resource || resource.role !== UserRole.RESOURCE) {
    throw new NotFoundException('Recurso no encontrado');
  }

  // Mitigación de condición de carrera del threat model: actualización
  // condicional atómica en vez de findUnique+update separados. Si count===0,
  // otra request ya asignó este recurso entre el check y este punto.
  const result = await this.prisma.user.updateMany({
    where: { id: resourceId, teamId: null },
    data: { teamId },
  });
  if (result.count === 0) {
    throw new ConflictException('El recurso ya pertenece a un equipo');
  }

  const updated = await this.prisma.user.findUniqueOrThrow({ where: { id: resourceId } });
  return TeamMemberResponseDto.fromEntity(updated);
}

async listAvailableResources(): Promise<TeamMemberResponseDto[]> {
  const resources = await this.prisma.user.findMany({
    where: { role: UserRole.RESOURCE, teamId: null },
  });
  return resources.map((r) => TeamMemberResponseDto.fromEntity(r));
}

async listOwnedByLeader(ownerId: string): Promise<TeamResponseDto[]> {
  const teams = await this.prisma.team.findMany({ where: { ownerId } });
  return teams.map((t) => TeamResponseDto.fromEntity(t));
}
```

`teams.controller.ts`: lee `req.user.sub` vía una interfaz local `AuthenticatedRequest extends
Request { user: AccessTokenPayload }`, reutilizando `AccessTokenPayload` (exportado de
`backend/src/auth/strategies/jwt.strategy.ts`) en vez de angostarlo a mano a `{ sub: string }`
por tercera vez en el repo (hallazgo del arch-auditor en PLAN — cierra el mismo patrón divergente
que ya existe duplicado en `auth.controller.ts`).

**Data model**

- `Team.name`: `String`, `NOT NULL`, máximo 30 caracteres (validado en el DTO).
- `Team.nameNormalized`: `String`, `NOT NULL`, `UNIQUE` — constraint de base de datos, case
  insensitive por construcción (se guarda ya en minúsculas).
- `Team.description`: `String`, `NOT NULL`, máximo 255 caracteres (validado en el DTO).
- `Team.ownerId`: `String`, `NOT NULL`, FK a `User.id` (relación `TeamOwner`).
- `User.teamId`: `String?`, nullable, FK a `Team.id` (relación `TeamMembers`). Sin unicidad — un
  equipo tiene muchos miembros, cada `User` pertenece a lo sumo un equipo a la vez.

**API contract**

- `POST /teams` — Request: `{ name: string, description: string }`. Response (`201`):
  `TeamResponseDto`. Error codes: `400` (validación), `401` (no autenticado), `403` (no LEADER),
  `409` (nombre duplicado). Auth: `JwtAuthGuard` + `RolesGuard` + `@Roles(LEADER)`.
- `POST /teams/:teamId/members` — Request: `{ resourceId: string }`. Response (`200`):
  `TeamMemberResponseDto`. Error codes: `400`, `401`, `403` (no LEADER, o no dueño del equipo —
  AC-06), `404` (equipo o recurso inexistente, o recurso no es rol RESOURCE), `409` (recurso ya
  asignado). Auth: `JwtAuthGuard` + `RolesGuard` + `@Roles(LEADER)`.
- `GET /teams/available-resources` — Response (`200`): `TeamMemberResponseDto[]`. Error codes:
  `401`, `403`. Auth: igual.
- `GET /teams/mine` — Response (`200`): `TeamResponseDto[]`, filtrado por `ownerId = req.user.sub`
  (nunca un listado global — mitigación del threat model). Error codes: `401`, `403`. Auth: igual.

**Input validation**

- `name`: string, no vacío, máximo 30 caracteres. `description`: string, no vacía, máximo 255
  caracteres. `resourceId`: string, no vacío. Todo validado con `class-validator` en los DTOs,
  igual que `CreateClientDto`.

**Error handling**

- `400`: validación de DTO fallida (`ValidationPipe` global).
- `401`: sin token válido (`JwtAuthGuard`).
- `403`: rol distinto de LEADER (`RolesGuard`), o LEADER que no es dueño del equipo
  (`ForbiddenException` explícita en el service).
- `404`: equipo inexistente, o recurso inexistente/no es rol RESOURCE.
- `409`: nombre de equipo duplicado (pre-check + `@@unique` como red de seguridad), o recurso ya
  asignado (pre-check + `updateMany` condicional como red de seguridad ante la carrera).

**Required tests**

- [ ] `teams.controller.spec.ts`: LEADER crea un equipo con datos válidos → `201`, body con
  `TeamResponseDto` — valida AC-01.
- [ ] `teams.controller.spec.ts`: nombre >30 caracteres, descripción >255, o alguno vacío → `400`
  — valida AC-02.
- [ ] `teams.controller.spec.ts`: no-LEADER (o no autenticado) intenta crear un equipo → `403`/`401`
  — valida AC-03.
- [ ] `teams.controller.spec.ts`: nombre de equipo duplicado (normalizado) → `409` — valida AC-04.
- [ ] `teams.controller.spec.ts`: un LEADER que ya es dueño de un equipo crea un segundo → `201`
  ambos con el mismo `ownerId` — valida AC-05.
- [ ] `teams.controller.spec.ts`: LEADER asigna un recurso libre a un equipo propio → `200`, el
  recurso queda con `teamId` seteado — valida AC-06.
- [ ] `teams.controller.spec.ts`: LEADER intenta asignar un recurso que ya pertenece a otro
  equipo → `409` — valida AC-07.
- [ ] `teams.controller.spec.ts`: LEADER intenta asignar un recurso a un equipo del que no es
  dueño → `403` — valida AC-08.
- [ ] `teams.controller.spec.ts`: LEADER intenta asignar a un `teamId` inexistente, o un
  `resourceId` inexistente/de rol distinto de RESOURCE → `404` en ambos casos.
- [ ] `teams.controller.spec.ts`: dos requests concurrentes intentan asignar el mismo recurso a
  dos equipos distintos → exactamente una responde `200` y la otra `409` (mitigación de condición
  de carrera del threat model — regresión directa de AC-07 bajo concurrencia, no un AC nuevo).
- [ ] `teams.controller.spec.ts`: `GET /teams/available-resources` devuelve solo usuarios RESOURCE
  con `teamId` nulo — valida AC-09.
- [ ] `teams.controller.spec.ts`: no autenticado o no-LEADER en `GET /teams/available-resources` →
  `401`/`403` — valida AC-10.
- [ ] `teams.controller.spec.ts`: `GET /teams/mine` devuelve solo los equipos del LEADER
  autenticado, no los de otro LEADER (endpoint técnico agregado en PLAN vía impact scan, sin AC
  propio en el PRD — soporta el flujo de AC-05/AC-06 cuando un Líder tiene más de un equipo).

**Completion criterion**

`npx prisma migrate dev` aplica la migración sin error sobre la base de desarrollo (con datos de
FEAT-001/002/003a ya cargados), sin pedir un valor por defecto (a diferencia de `User.name`,
`teamId` es nullable); `npm --prefix backend test` pasa completo (incluye
`teams.controller.spec.ts`); `tsc --noEmit` sin errores.

**Rollback**

`Team` es una tabla nueva y `User.teamId` es una columna nullable sin backfill — revertir es
`prisma migrate resolve --rolled-back` + `DROP TABLE "Team"` + `ALTER TABLE "User" DROP COLUMN
"teamId"`, y quitar el modelo/campos de `schema.prisma`. No hay pérdida de datos de otras
entidades: ningún `User` existente pierde información propia al quitar una FK nullable que aún no
tiene lectores fuera de este módulo. Indicador para aplicarlo: fallas post-deploy en el módulo
`teams` que no se puedan resolver con un fix rápido.

## Block 2 — Frontend: gestión de equipos (Líder)

**Files**
- `frontend/src/services/teams.service.ts` (new) — `createTeam`, `assignResource`,
  `listAvailableResources`, `listMyTeams`.
- `frontend/src/services/teams.service.spec.ts` (new).
- `frontend/src/pages/LeaderTeamsPage.tsx` (new).
- `frontend/src/pages/LeaderTeamsPage.spec.tsx` (new).
- `frontend/src/App.tsx` (modified) — agrega la ruta `/leader/teams` con
  `<ProtectedRoute requiredRole="LEADER">`.

**Logic**

`teams.service.ts`: mismo patrón que `clients.service.ts` (`extractErrorMessage`/
`handleResponse`, `fetch` con `credentials: 'include'` y `Authorization: Bearer`), 4 funciones
mapeadas 1 a 1 a los endpoints de Block 1.

`LeaderTeamsPage.tsx`: formulario de creación de equipo (`name`/`description`, espejo `zod` del
DTO del backend); al cargar, `listMyTeams()` puebla un selector de "a qué equipo asignar" (un
Líder puede tener varios, FR-03) y `listAvailableResources()` puebla la lista de recursos libres
para elegir a quién asignar (FR-05); al asignar, se llama `assignResource(teamId, resourceId)` y
se refrescan ambos listados. Mismo patrón de `useState`/loading/error que `PMClientsPage.tsx`, sin
librería de manejo de estado nueva.

`App.tsx`: nueva `<Route path="/leader/teams" element={<ProtectedRoute
requiredRole="LEADER"><LeaderTeamsPage /></ProtectedRoute>} />`, mismo patrón que `/pm/clients`.

**Input validation**

- Espejo del backend: `name` no vacío ≤30 caracteres, `description` no vacía ≤255 caracteres.
  Selección de equipo/recurso restringida a los valores devueltos por `listMyTeams`/
  `listAvailableResources` (no hay campo de texto libre para IDs).

**Error handling**

- Mismo patrón ya existente: cualquier error de la API (400/403/404/409) se muestra vía
  `setError(err.message)`, nunca se traga. El caso `409` de "recurso ya asignado" (incluida la
  condición de carrera) refresca la lista de recursos libres para reflejar el estado real.

**Required tests**

- [ ] `LeaderTeamsPage.spec.tsx`: completar el formulario y crear un equipo llama a `createTeam`
  con el payload correcto y lo agrega al selector de equipos.
- [ ] `LeaderTeamsPage.spec.tsx`: asignar un recurso libre a un equipo llama a `assignResource`
  con `teamId`/`resourceId` correctos y el recurso desaparece de la lista de libres.
- [ ] `LeaderTeamsPage.spec.tsx`: si la API responde `409` al asignar, el mensaje se muestra en
  pantalla y la lista de recursos se refresca.
- [ ] `teams.service.spec.ts`: las 4 funciones (`createTeam`, `assignResource`,
  `listAvailableResources`, `listMyTeams`) arman el request correcto y relanzan errores de la API
  sin tragarlos.

**Completion criterion**

`npm --prefix frontend test` pasa completo; `tsc -b --noEmit` sin errores.

## Final verification

- `npm --prefix backend test` y `npm --prefix frontend test` en verde.
- `npx prisma migrate dev` aplica limpiamente sin requerir backfill.
- Un LEADER puede crear varios equipos, asignar recursos libres a los que posee, y ve rechazada
  cualquier asignación a un equipo ajeno o de un recurso ya tomado (incluida la carrera
  concurrente).
- `GET /teams/mine` y `GET /teams/available-resources` responden solo a rol LEADER autenticado.
