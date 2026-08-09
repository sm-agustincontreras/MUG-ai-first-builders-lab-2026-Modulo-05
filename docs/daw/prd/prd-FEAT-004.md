# PRD FEAT-004: Home diferenciado por rol con navegación

| Field | Value |
|-------|-------|
| Ticket | FEAT-004 |
| Tracker | none |
| Date | 2026-08-09T23:20:00Z |
| PRD loops | 1 |

## Context and Problem

Hoy, tras autenticarse, un PM, Líder o Recurso llega a `/home`, que solo muestra un placeholder
mínimo ("Sesión iniciada como {email} ({rol})" + botón de cerrar sesión) sin ningún enlace a las
secciones que ya existen para su rol (Clientes para PM, Equipos para Líder, Composición de equipos
para los tres). Un Admin ni siquiera pasa por `/home`: el login lo redirige directo a
`/admin/users`.

Para llegar a cualquier sección hoy hace falta escribir la URL a mano, porque no existe ninguna
navegación persistente entre pantallas. RF-25 del PRD general pide una vista de inicio diferenciada
por rol, y quedó explícitamente fuera de alcance de FEAT-001 ("corresponde a una feature posterior
una vez que existan pantallas por rol" — ya existen: FEAT-002, FEAT-003b, FEAT-003c).

## Goals

- Que cualquier usuario autenticado (PM, Líder, Recurso, Admin) pueda moverse entre las secciones
  a las que tiene acceso sin escribir URLs a mano, desde cualquier pantalla.
- Que `/home` deje de ser un placeholder y confirme al usuario quién es y con qué rol entró.

## Functional Requirements

- FR-01: El sistema debe mostrar un header de navegación persistente en toda pantalla protegida
  (accesible solo a usuarios autenticados), incluida `/admin/users`.
- FR-02: El header debe incluir el nombre de la aplicación como enlace a `/home`.
- FR-03: El header debe incluir, para cada usuario autenticado, únicamente los enlaces a las
  secciones habilitadas para su rol:
  - PM: Clientes (`/pm/clients`), Composición de equipos (`/teams/composition`)
  - Líder: Equipos (`/leader/teams`), Composición de equipos (`/teams/composition`)
  - Recurso: Composición de equipos (`/teams/composition`, solo lectura)
  - Admin: Alta de usuarios (`/admin/users`)
- FR-04: El header debe incluir un control de cerrar sesión, disponible en toda pantalla protegida.
- FR-05: La pantalla `/home` debe mostrar un mensaje de bienvenida con el nombre y el rol del
  usuario autenticado ("Bienvenido, {nombre}. Estás logueado como {rol}.").
- FR-06: El control de cerrar sesión deja de estar en el contenido de `/home` — vive únicamente en
  el header persistente (FR-04).

## Non-Functional Requirements

- NFR-01: El header debe seguir las convenciones de UI del proyecto (paleta, tipografía, radios y
  transiciones de `AGENTS.md` → "UI/Design conventions"); en particular, un enlace activo/actual
  debe distinguirse visualmente de los demás (consistencia sobre creatividad).
- NFR-02: El header, como todo componente del frontend, no debe llamar a la API directamente —
  accede a la sesión del usuario a través de la capa de hooks/servicios existente (`use-auth`),
  igual que el resto del frontend (AGENTS.md → "Architecture conventions").

## Acceptance Criteria

- AC-01 (FR-01): WHEN un usuario autenticado con cualquier rol navega a cualquier pantalla
  protegida, THE sistema SHALL mostrar el header con el nombre de la app, los enlaces de su rol y
  el control de cerrar sesión.
- AC-02 (FR-03): WHEN un PM autenticado ve el header, THE sistema SHALL mostrar los enlaces a
  Clientes y a Composición de equipos, y ningún otro enlace de sección.
- AC-03 (FR-03): WHEN un Líder autenticado ve el header, THE sistema SHALL mostrar los enlaces a
  Equipos y a Composición de equipos, y ningún otro enlace de sección.
- AC-04 (FR-03): WHEN un Recurso autenticado ve el header, THE sistema SHALL mostrar únicamente el
  enlace a Composición de equipos.
- AC-05 (FR-01, FR-03): WHEN un Admin autenticado ve el header (incluso en `/admin/users`, adonde
  lo lleva el login directamente), THE sistema SHALL mostrar el enlace a Alta de usuarios.
- AC-06 (FR-02): WHEN un usuario autenticado hace click en el nombre de la app en el header, THE
  sistema SHALL navegarlo a `/home`.
- AC-07 (FR-05, FR-06): WHEN un usuario autenticado entra a `/home`, THE sistema SHALL mostrar el
  mensaje de bienvenida con su nombre y su rol, sin ningún control de cerrar sesión en el contenido
  de la página.
- AC-08 (FR-04): WHEN un usuario autenticado hace click en el control de cerrar sesión del header
  desde cualquier pantalla, THE sistema SHALL cerrar su sesión (comportamiento ya cubierto por
  RF-24 / FEAT-001; este ticket solo reubica el disparador en la UI).
- AC-09 (FR-01): IF un usuario no autenticado intenta acceder a cualquier pantalla protegida, THEN
  THE sistema SHALL denegarle el acceso sin mostrar el header (comportamiento ya cubierto por RF-01
  / FEAT-001; el header nunca se renderiza fuera de una sesión válida).

## Out of Scope

- Indicar el estado de "página actual" con un mecanismo distinto al ya definido por las
  convenciones de UI del proyecto (NFR-01) — el detalle visual concreto se resuelve en PLAN/CODE,
  no aquí.
- Agregar secciones nuevas al header para Recurso (tareas, tableros, reportes) — quedan para las
  features que las introduzcan (RF-06 en adelante); este ticket solo conecta lo que ya existe.
- Cualquier cambio a la lógica de autenticación, autorización o logout en sí (RF-01, RF-02, RF-24) —
  este ticket reutiliza `use-auth` tal como está, solo reubica dónde se dispara el logout en la UI.
- Un menú de usuario/avatar con opciones adicionales (perfil, preferencias) — no existe ese
  concepto en el PRD general.
- Vista de inicio con contenido distinto al mensaje de bienvenida (widgets, resúmenes, accesos
  directos por tarjeta) — el PRD general no lo pide y el usuario confirmó que el home es solo el
  mensaje de bienvenida; la navegación vive en el header (FR-01 a FR-04).

## Risks and Mitigations

- Riesgo: si el header no filtra los enlaces por rol y muestra secciones no autorizadas, un usuario
  podría intentar acceder a una pantalla para la que no tiene permiso → mitigación: el filtrado del
  header es solo UX (AC-02 a AC-05); el control de acceso real ya existe en `ProtectedRoute`
  (RF-01/RF-30, FEAT-001) y sigue siendo la autoridad — el header nunca reemplaza esa validación.
- Riesgo: mover el logout de `/home` al header podría romper los tests existentes de `App.spec.tsx`
  o de páginas que hoy asumen el placeholder → mitigación: se actualizan junto con el cambio, en
  CODE, como parte del mismo bloque.

## Dependencies

- Depende de FEAT-001 (auth, roles, `ProtectedRoute`, `use-auth`), FEAT-002 (`/pm/clients`),
  FEAT-003b (`/leader/teams`) y FEAT-003c (`/teams/composition`) — todas ya mergeadas a `main`.
