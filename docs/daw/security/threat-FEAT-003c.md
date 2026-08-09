# Threat Model FEAT-003c: Composición de equipos

| Field | Value |
|-------|-------|
| Ticket | FEAT-003c |
| Date | 2026-08-09 |
| Spec de referencia | docs/daw/specs/spec-FEAT-003c.md (a escribir tras este análisis) |

## Componentes y superficies de ataque

| Componente | Endpoint/flujo | Superficie |
|---|---|---|
| `TeamsController` | `GET /teams/composition` | Lectura global de la composición de TODOS los equipos — nueva audiencia: por primera vez el rol RESOURCE obtiene un endpoint de lectura sobre `Team` (antes solo LEADER, vía `/teams/mine` y `/teams/available-resources`) |
| `PrismaService` | `team.findMany({ include: { owner, members } })` | Inyección SQL (mitigado por el ORM, heredado de `threat-FEAT-001.md`) |
| Frontend `teams.service.ts` / `TeamsCompositionPage.tsx` | Toda llamada a `/teams/composition` | Renderizado de `name`/`description`/nombre de dueño/nombres de miembros de equipos ajenos al usuario |
| `ProtectedRoute` | Ensanche de `requiredRole` a `UserRole \| UserRole[]` | Gate de UI únicamente (no es el límite de seguridad real — ver Límites de confianza) |

## Límites de confianza (trust boundaries)

Reutiliza los ya declarados en `docs/daw/security/threat-FEAT-001.md` (navegador↔API,
backend↔PostgreSQL vía Prisma) y el de RBAC por rol (`RolesGuard`+`@Roles`) ya usado en
`threat-FEAT-002.md`/`threat-FEAT-003b.md`. Este ticket no introduce un límite de confianza nuevo,
pero **extiende uno existente**:

6. **RBAC por rol, ahora con 3 roles simultáneos en un mismo endpoint**: `@Roles(PM, LEADER,
   RESOURCE)` es el primer uso en el código de `@Roles(...)` con más de un rol (todo controller
   existente usa un único rol). El límite sigue siendo el mismo mecanismo (`RolesGuard` lee
   `request.user.role` del JWT y verifica pertenencia al array), sin lógica nueva — pero la
   consecuencia práctica es que RESOURCE cruza por primera vez el límite hacia datos de equipos
   que no le pertenecen (composición de equipos ajenos), lo cual es analizado como Information
   Disclosure más abajo.

## Datos sensibles (clasificación)

| Dato | Clasificación | Cifrado |
|---|---|---|
| `Team.name`/`Team.description` | Dato de negocio interno, no PII | No cifrado en reposo (igual que en FEAT-003b); tránsito sobre TLS |
| `owner.name`/`members[].name` (vía `User.name`) | PII de bajo riesgo (nombre de empleado, sin email/credenciales) | No cifrado en reposo (mismo campo ya expuesto en otros endpoints, p. ej. `TeamMemberResponseDto`); tránsito sobre TLS |

## Análisis STRIDE

### `GET /teams/composition`

| Categoría | Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|---|
| Spoofing | Suplantación de identidad para acceder al endpoint | Baja | Medio | 🟢 `JwtAuthGuard` verifica la firma del JWT, mismo mecanismo heredado de FEAT-001 |
| Tampering | N/A — endpoint de solo lectura, sin body ni querystring aceptado | — | — | 🟢 No hay superficie de escritura; `Out of Scope` del PRD excluye filtros/búsqueda para este ticket |
| Repudiation | N/A — no hay acción mutable que repudiar | — | — | 🟢 No aplica a un `GET` |
| **Information Disclosure** | **Cualquier usuario autenticado con rol PM, LEADER o RESOURCE ve la composición de TODOS los equipos del sistema, incluyendo el nombre de todo empleado asignado a un equipo — antes RESOURCE no tenía ningún endpoint de equipos** | Media | Medio | 🟡 **Es el requisito explícito de RF-20/RF-21 del PRD general (AC-01/AC-02 de `prd-FEAT-003c.md`), no una fuga accidental.** Mitigación de superficie: `TeamCompositionMemberDto` expone únicamente `{id, name}` — nunca `email`, `passwordHash`, `refreshTokenHash` ni `role` — mismo patrón de minimización ya usado en `team-member-response.dto.ts` (FEAT-003b) |
| Denial of Service | `findMany` sin paginación — degradación si el número de equipos crece sin límite | Baja | Bajo | 🟢 NFR-02 exige <1s; volumen esperado (software para pymes) no justifica paginación en este ticket — `Out of Scope` ya lo excluye explícitamente. Riesgo de escalabilidad a revisar si el volumen de equipos crece significativamente (no bloqueante) |
| Elevation of Privilege | RESOURCE obtiene, además de lectura, alguna capacidad de escritura sobre equipos | Baja | Alto | 🟢 `POST /teams` y `POST /teams/:teamId/members` mantienen `@Roles(LEADER)` sin cambios — RESOURCE no gana ninguna mutación. `TeamsCompositionPage.tsx` no renderiza ningún formulario ni acción, solo lista de solo lectura (cubre AC-02) |

### Frontend (`TeamsCompositionPage.tsx`, `ProtectedRoute.tsx`)

| Categoría | Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|---|
| Tampering (XSS almacenado) | `name`/`description`/nombres se renderizan sin escapar | Baja | Medio | 🟢 React escapa por defecto en JSX; sin `dangerouslySetInnerHTML` en el proyecto (heredado) |
| Elevation of Privilege | El ensanche de `ProtectedRoute.requiredRole` a array queda mal implementado y deja pasar a un rol no autorizado en la UI | Baja | Bajo | 🟢 El gate de `ProtectedRoute`/segunda capa de defensa en el componente es UX (NFR-04), **no el límite de seguridad real** — la autorización efectiva la impone siempre `RolesGuard` en el backend, que no cambia de mecanismo en este ticket |

## Riesgos aceptados

Ninguno nuevo que requiera aceptación formal: el único riesgo con impacto real (Information
Disclosure — RESOURCE ve equipos ajenos) es un requisito funcional explícito del PRD (RF-20/RF-21),
no un hallazgo a mitigar o aceptar — ya viene acotado por la minimización de campos del DTO.

## Mitigaciones a incorporar en el spec

1. `RolesGuard` + `@Roles(UserRole.PM, UserRole.LEADER, UserRole.RESOURCE)` en `GET
   /teams/composition` — reutiliza el mecanismo existente, primer uso real con 3 roles.
2. `TeamCompositionMemberDto`/`TeamCompositionResponseDto` con whitelist explícito de campos
   (`{id, name}` para miembros/dueño; nunca `email`/`passwordHash`/`refreshTokenHash`/`role`).
3. `POST /teams` y `POST /teams/:teamId/members` permanecen `@Roles(LEADER)` sin cambios —
   ninguna mutación se habilita para PM/RESOURCE.
4. `TeamsCompositionPage.tsx` es estrictamente de solo lectura: ningún formulario ni control de
   mutación en el árbol de la página (cubre AC-02).
5. La segunda capa de defensa de rol en el frontend (`ProtectedRoute` y el chequeo dentro del
   componente) se documenta explícitamente como gate de UX, no como control de seguridad — el
   control real sigue siendo `RolesGuard` en el backend.

---

┌─────────────────────────────────────────────────────────┐
│  /daw-threat-modeling — PASSED                            │
├─────────────────────────────────────────────────────────┤
│  Attack surfaces identified: 4                              │
│  Trust boundaries declared: 1 extendido (RBAC multi-rol) +   │
│    heredados de threat-FEAT-001.md/threat-FEAT-003b.md         │
│                                                                  │
│  Risks:                                                          │
│    🟡 MEDIUM: 1 — Information Disclosure (RESOURCE ve equipos     │
│       ajenos) — Mitigation: requisito explícito del PRD +          │
│       DTO minimizado a {id,name}                                    │
│    🟢 LOW: 5 (ver tablas STRIDE arriba)                              │
│                                                                         │
│  Riesgos aceptados: 0                                                    │
│                                                                              │
│  Mitigations to fold into the spec: 5 (ver sección arriba)                   │
│                                                                                  │
│  ─────────────────────────────────────────────────────────────                 │
│  Risks: C:0 H:0 M:1 L:5                                                          │
│  Report: docs/daw/security/threat-FEAT-003c.md                                    │
└─────────────────────────────────────────────────────────────────────────────────┘
