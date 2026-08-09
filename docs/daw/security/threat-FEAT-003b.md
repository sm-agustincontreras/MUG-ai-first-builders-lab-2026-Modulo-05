# Threat Model FEAT-003b: Alta de equipos y asignación de recursos

| Field | Value |
|-------|-------|
| Ticket | FEAT-003b |
| Date | 2026-08-08 |
| Spec de referencia | docs/daw/specs/spec-FEAT-003b.md (a escribir tras este análisis) |

## Componentes y superficies de ataque

| Componente | Endpoint/flujo | Superficie |
|---|---|---|
| `TeamsController` | `POST /teams` | Input de usuario (name/description) — inyección, elevación de privilegios (rol no-LEADER) |
| `TeamsController` | `POST /teams/:teamId/members` | `teamId` en el path (IDOR potencial), `resourceId` en el body — asignación a un equipo ajeno, condición de carrera en la asignación |
| `TeamsController` | `GET /teams/available-resources` | Lectura global de recursos libres — alcance del listado |
| `TeamsController` | `GET /teams/mine` | Lectura de equipos propios — filtrado por `ownerId` |
| `PrismaService` | Toda query a `Team`/`User.teamId` | Inyección SQL (mitigado por el ORM) |
| Frontend `teams.service.ts`/`LeaderTeamsPage.tsx` | Toda llamada a `/teams/*` | Renderizado de `name`/`description` de equipos y recursos |

## Límites de confianza (trust boundaries)

Reutiliza los 5 ya declarados en `docs/daw/security/threat-FEAT-001.md` (navegador↔API,
backend↔PostgreSQL vía Prisma, etc.), más el ya usado por `Client`/`User` para RBAC por rol
(`RolesGuard`+`@Roles`). Este ticket introduce un límite de confianza **nuevo**, no cubierto por
tickets anteriores:

6. **Rol LEADER ↔ propiedad del recurso**: `@Roles(LEADER)` verifica el rol, pero no alcanza para
   autorizar `POST /teams/:teamId/members` — un Líder autenticado con rol correcto igual puede
   intentar operar sobre un equipo que no es suyo. La autorización real depende de una
   verificación de **ownership** (`team.ownerId === requesterId`) a nivel de `TeamsService`, no
   solo del guard de rol.

## Datos sensibles (clasificación)

| Dato | Clasificación | Cifrado |
|---|---|---|
| `Team.name`/`Team.description` | Dato de negocio interno, no PII | No cifrado en reposo (igual que `Client`); tránsito sobre TLS |
| `User.teamId` (nueva FK) | Metadato organizacional, no PII por sí solo | No cifrado en reposo; tránsito sobre TLS |

## Análisis STRIDE

### `POST /teams` (creación de equipo)

| Categoría | Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|---|
| Elevation of Privilege | Un usuario sin rol LEADER crea un equipo | Baja | Medio | 🟠 `RolesGuard` + `@Roles(LEADER)`, mismo mecanismo ya validado en `POST /clients` (FEAT-002) y `POST /users` (FEAT-001) |
| Tampering | Inyección vía `name`/`description` | Baja | Alto | 🟢 Prisma parametriza todas las queries; `class-validator` valida tipo/longitud antes del service |
| Repudiation | Condición de carrera en la unicidad del nombre ante dos altas simultáneas | Baja | Bajo | 🟢 Constraint `@unique([nameNormalized])` a nivel de Prisma schema/DB — la DB rechaza el duplicado aunque el pre-check de aplicación tenga una carrera (mismo patrón que `Client`, NFR-01 del PRD) |

### `POST /teams/:teamId/members` (asignación de recurso)

| Categoría | Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|---|
| Elevation of Privilege (IDOR) | Un Líder asigna un recurso a un equipo del que no es dueño, adivinando o enumerando un `teamId` ajeno | Media | Alto | 🔴 `TeamsService.assignResource` verifica explícitamente `team.ownerId === requesterId` antes de cualquier escritura, independiente del `RolesGuard` — cubre AC-06 del PRD |
| Tampering | Asignar un `resourceId` que no es de rol RESOURCE, o que no existe | Baja | Medio | 🟡 `TeamsService` valida rol y existencia del usuario antes de asignar; 404 si no corresponde |
| **Tampering (condición de carrera)** | **Dos requests concurrentes intentan asignar el mismo recurso a dos equipos distintos: ambos leen `teamId === null` antes de que cualquiera escriba, y el pre-check de "no está asignado" no cierra la ventana — a diferencia de `nameNormalized`, no hay constraint de unicidad de `teamId` en la DB que actúe como red de seguridad final** | Media | Medio | 🟠 **Mitigación nueva, a incorporar en el spec:** la escritura de `assignResource` debe ser una actualización condicional atómica (`prisma.user.updateMany({ where: { id: resourceId, teamId: null }, data: { teamId } })`) en vez de un `findUnique` + `update` separados; si `count === 0` tras la actualización, se interpreta como "ya fue asignado por otra request" y se responde 409, igual que el caso de asignación ya tomada |
| Information Disclosure | Filtración de datos del equipo/recurso en la respuesta | Baja | Bajo | 🟢 `team-response.dto.ts`/`team-member-response.dto.ts` whitelistean explícitamente los campos expuestos, mismo patrón que `ClientResponseDto`/`UserResponseDto` |

### `GET /teams/available-resources` y `GET /teams/mine`

| Categoría | Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|---|
| Information Disclosure | `GET /teams/available-resources` expone la lista completa de recursos libres a cualquier Líder, no solo a los de su propio contexto | Baja | Bajo | 🟢 Alcance intencional del RF-05 del PRD: cualquier Líder necesita ver todos los recursos libres del sistema para poder reclutarlos — no es una fuga, es el requisito |
| Information Disclosure | `GET /teams/mine` expone equipos de otro Líder | Baja | Medio | 🟢 Filtrado explícito por `ownerId = req.user.sub` en `TeamsService.listOwnedByLeader`, nunca un listado global |
| Elevation of Privilege | Usuario sin rol LEADER consulta cualquiera de los dos listados | Baja | Bajo | 🟢 `RolesGuard` + `@Roles(LEADER)` en ambos endpoints |

### Frontend (`LeaderTeamsPage.tsx`)

| Categoría | Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|---|
| Tampering (XSS almacenado) | `name`/`description` de un equipo, o el nombre de un recurso, se renderiza sin escapar | Baja | Medio | 🟢 Mismo patrón ya establecido: React escapa por defecto en JSX, sin `dangerouslySetInnerHTML` en ningún componente del proyecto |

## Riesgos aceptados

Ninguno. El único riesgo con impacto real nuevo (condición de carrera en la asignación de
recursos) queda mitigado con una actualización condicional atómica, no con una aceptación de
riesgo.

## Mitigaciones a incorporar en el spec

1. `RolesGuard` + `@Roles(UserRole.LEADER)` en los 4 endpoints de `TeamsController`.
2. Verificación explícita de ownership (`team.ownerId === requesterId`) en
   `TeamsService.assignResource`, independiente del guard de rol — cierra el IDOR de AC-06.
3. **Actualización condicional atómica** (`updateMany` + chequeo de `count`) en
   `assignResource`, en vez de `findUnique` + `update` separados — cierra la condición de carrera
   en la asignación concurrente de un mismo recurso.
4. `@@unique([nameNormalized])` en `Team` a nivel de schema de Prisma (constraint de base de
   datos), mismo patrón que `Client`.
5. `team-response.dto.ts`/`team-member-response.dto.ts` con whitelist explícito de campos
   (nunca se expone `passwordHash`/`refreshTokenHash`; se omite `role` en
   `team-member-response.dto.ts` por minimización de superficie, ya que el endpoint que lo
   consume ya fija `role: RESOURCE` en su query).
6. `GET /teams/mine` filtra siempre por `ownerId = req.user.sub`, nunca un listado global de
   equipos.

---

┌─────────────────────────────────────────────────────────┐
│  /daw-threat-modeling — PASSED                            │
├─────────────────────────────────────────────────────────┤
│  Attack surfaces identified: 6                              │
│  Trust boundaries declared: 1 nuevo (ownership de equipo) +  │
│    5 heredados de threat-FEAT-001.md                          │
│                                                                  │
│  Risks:                                                          │
│    🔴 HIGH: IDOR — asignar recurso a equipo ajeno — Mitigation:   │
│       verificación explícita de ownership en el service            │
│    🟠 HIGH: condición de carrera en asignación concurrente —        │
│       Mitigation: updateMany condicional atómico                     │
│    🟠 HIGH: usuario no-LEADER crea equipo — Mitigation: RolesGuard    │
│    🟡 MEDIUM: 2 (ver tablas STRIDE arriba)                             │
│    🟢 LOW: 6 (ver tablas STRIDE arriba)                                  │
│                                                                             │
│  Riesgos aceptados: 0                                                        │
│                                                                                  │
│  Mitigations to fold into the spec: 6 (ver sección arriba)                       │
│                                                                                      │
│  ─────────────────────────────────────────────────────────────                     │
│  Risks: C:0 H:3 M:2 L:6                                                              │
│  Report: docs/daw/security/threat-FEAT-003b.md                                        │
└─────────────────────────────────────────────────────────────────────────────────────┘
