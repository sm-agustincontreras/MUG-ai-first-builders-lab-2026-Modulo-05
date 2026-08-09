# Threat Model FEAT-004: Home diferenciado por rol con navegación

| Field | Value |
|-------|-------|
| Ticket | FEAT-004 |
| Date | 2026-08-09 |
| Spec de referencia | docs/daw/specs/spec-FEAT-004.md |

## Componentes y superficies de ataque

| Componente | Endpoint/flujo | Superficie |
|---|---|---|
| `AppHeader` (nuevo) | Renderiza enlaces de navegación + botón de logout, filtrados por `user.role` | Ninguna llamada a la API — dato de presentación puro, consume `useAuth()` |
| `ProtectedRoute` (modificado) | Compone `<AppHeader />` cuando `isAuthenticated`, incluso en la rama de rol denegado | Único punto donde el gate de UX (header visible) y el gate de seguridad real (`hasRequiredRole`) conviven en el mismo componente |
| `HomePage` (nuevo) | Renderiza `user.name` y `user.role` en un mensaje de bienvenida | Primer lugar del frontend que muestra `name` en pantalla (el campo ya viaja en la respuesta de login desde FEAT-001, pero hasta ahora el cliente lo recibía sin tiparlo ni mostrarlo) |
| `auth.service.ts` | Se agrega `name: string` a la interfaz `AuthUser` | Cambio de tipo únicamente — no agrega ninguna llamada nueva a `/auth/*` |

Este ticket **no agrega ningún endpoint, no toca el backend ni el esquema de datos**. Toda la
superficie es renderizado client-side de datos que el navegador ya recibe hoy en la respuesta de
`POST /auth/login` (`UserResponseDto`, sin cambios).

## Límites de confianza (trust boundaries)

Reutiliza los ya declarados en `docs/daw/security/threat-FEAT-001.md` (navegador↔API vía JWT,
backend↔PostgreSQL vía Prisma — ninguno de los dos se toca en este ticket). No se introduce un
límite de confianza nuevo. Se **reafirma explícitamente** el límite ya usado en
`threat-FEAT-003c.md`:

- El filtrado de enlaces en `AppHeader` (por rol) y el gate de `ProtectedRoute` son controles de
  **UX**, no el límite de seguridad real. La autorización efectiva sigue siendo `RolesGuard` +
  `@Roles(...)` en el backend (sin cambios en este ticket) para cada endpoint que esas pantallas
  consumen. Un enlace de navegación visible o ausente nunca es, por sí mismo, lo que decide si una
  petición al backend se autoriza.

## Datos sensibles (clasificación)

| Dato | Clasificación | Cifrado |
|---|---|---|
| `user.name` (mostrado en `HomePage` y potencialmente en el `title`/aria de `AppHeader`) | PII de bajo riesgo (nombre de empleado, sin email/credenciales) — mismo campo y mismo nivel ya clasificado en `threat-FEAT-003c.md` para nombres de miembros de equipo | No cifrado en reposo (ya expuesto vía `UserResponseDto` desde FEAT-001); tránsito sobre TLS, heredado |
| `user.role` (mostrado como label legible en `HomePage`, usado para filtrar enlaces en `AppHeader`) | Dato de negocio interno, no PII | No cifrado en reposo; ya viaja en el JWT y en la respuesta de login desde FEAT-001 |

No se introduce ningún dato sensible nuevo: `name` y `role` ya cruzaban el límite navegador↔API
desde FEAT-001. Este ticket solo cambia si el cliente los **muestra en pantalla**, no si los
**recibe**.

## Análisis STRIDE

### `AppHeader` / `ProtectedRoute` (composición de navegación)

| Categoría | Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|---|
| Spoofing | Suplantación de identidad para que el header muestre enlaces de otro rol | Baja | Bajo | 🟢 `user.role` viene del `AuthUser` en memoria, poblado únicamente por la respuesta de `POST /auth/login` verificada server-side (JWT firmado, `JwtAuthGuard` heredado de FEAT-001) — no hay forma de que el cliente "declare" un rol distinto al que el backend le asignó |
| Tampering | XSS almacenado vía `user.name` renderizado sin escapar en `HomePage`/`AppHeader` | Baja | Medio | 🟢 React escapa por defecto en JSX; ningún `dangerouslySetInnerHTML` en el proyecto (heredado, mismo patrón que `threat-FEAT-003c.md`) |
| Repudiation | N/A — no hay ninguna acción mutable que repudiar (navegación y logout ya auditados en FEAT-001) | — | — | 🟢 No aplica |
| **Information Disclosure** | El header se muestra también en la pantalla de acceso denegado por rol (decisión de diseño de PLAN): un usuario ve los nombres de las secciones habilitadas para **su propio rol** incluso estando en una pantalla ajena | Baja | Bajo | 🟢 `AppHeader` solo revela los enlaces del rol del usuario autenticado — nunca los de otro rol ni datos de negocio. Los nombres de sección ("Clientes", "Alta de usuarios", etc.) no son secretos: ya son inferibles desde el propio PRD/la UI de login. No hay elevación de superficie de datos, solo de "qué secciones existen para mí", que el usuario ya conoce por ser parte de su propio rol |
| Denial of Service | N/A — sin llamadas a la API nuevas, renderizado 100% client-side | — | — | 🟢 No aplica |
| **Elevation of Privilege** | Un enlace visible en el header (p. ej. en la pantalla de acceso denegado) permite a un usuario acceder a una sección para la que no tiene permiso | Baja | Alto si ocurriera | 🟢 Cada enlace del header solo navega (react-router `NavLink`/`Link`) — el destino sigue protegido por el mismo `ProtectedRoute`+`requiredRole` que ya existía, que a su vez depende de `RolesGuard` en el backend para cada llamada real a la API. `AppHeader` nunca omite ni reemplaza ese chequeo: **solo muestra enlaces del propio rol del usuario**, jamás enlaces de otros roles, así que no hay ningún enlace en el header que lleve a un usuario a una sección ajena a su rol |

### `HomePage` (mensaje de bienvenida)

| Categoría | Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|---|
| Information Disclosure | Se muestra `user.name` en pantalla por primera vez | Baja | Bajo | 🟢 Es el propio nombre del usuario autenticado, ya en su posesión (lo usó para loguearse) — no es dato de un tercero. Mismo dato que el backend ya devuelve desde FEAT-001, ahora solo se renderiza |
| Elevation of Privilege | N/A — página de solo lectura, sin formularios ni mutaciones | — | — | 🟢 No aplica |

## Riesgos aceptados

Ninguno nuevo. Este ticket no introduce dependencias nuevas (W-TM-01 no aplica: sin cambios en
`package.json`), no agrega superficie de backend (W-TM-02 no aplica: sin servicio nuevo expuesto a
DoS) y no eleva la clasificación de ningún dato ya aceptado en `threat-FEAT-001.md`/ADR-001.

## Mitigaciones a incorporar en el spec

1. `AppHeader` filtra enlaces exclusivamente por el `role` del propio usuario autenticado — nunca
   muestra ni infiere enlaces de otro rol (cubre AC-02 a AC-05, ya reflejado en el spec).
2. `ProtectedRoute` sigue siendo la autoridad de acceso real (vía `requiredRole` + backend
   `RolesGuard`); la visibilidad del header en la pantalla de acceso denegado es documentada
   explícitamente como decisión de UX, no de seguridad (ya reflejado en el spec, Block 2).
3. Ningún componente nuevo llama a `fetch`/servicios de API directamente — todos consumen
   `useAuth()` (cubre NFR-02, ya reflejado en el spec).
4. Sin `dangerouslySetInnerHTML` en `AppHeader.tsx`/`HomePage.tsx` — el nombre y el rol del
   usuario se renderizan como texto plano de JSX.

---

┌─────────────────────────────────────────────────────────┐
│  /daw-threat-modeling — PASSED                           │
├─────────────────────────────────────────────────────────┤
│  Attack surfaces identified: 4                            │
│  Trust boundaries declared: 0 nuevos (reafirma el ya      │
│    usado en threat-FEAT-001.md/threat-FEAT-003c.md)       │
│                                                            │
│  Risks:                                                    │
│    🟢 LOW: 6 (ver tablas STRIDE arriba) — Spoofing,         │
│      Tampering, Information Disclosure (x2), Elevation of  │
│      Privilege (x1), todas con mitigación heredada o de    │
│      diseño ya reflejada en el spec                         │
│                                                                │
│  Riesgos aceptados: 0                                          │
│                                                                    │
│  Mitigations to fold into the spec: 4 (ya reflejadas — ver          │
│    sección arriba)                                                    │
│                                                                          │
│  ─────────────────────────────────────────────────────────              │
│  Risks: C:0 H:0 M:0 L:6                                                   │
│  Report: docs/daw/security/threat-FEAT-004.md                              │
└──────────────────────────────────────────────────────────────────────────┘
