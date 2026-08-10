# Spec FEAT-004: Home diferenciado por rol con navegación

| Field | Value |
|-------|-------|
| Ticket | FEAT-004 |
| PRD | docs/daw/prd/prd-FEAT-004.md |
| Tier | FEATURE |
| Date | 2026-08-09T23:44:25Z |
| Spec loops | 0 |

## Summary

Se agrega un header de navegación persistente (`AppHeader`) que se renderiza dentro de
`ProtectedRoute` para toda pantalla protegida, con enlaces filtrados por rol y el control de cerrar
sesión. `/home` deja de ser un placeholder y pasa a mostrar solo un mensaje de bienvenida con
nombre y rol del usuario. El logout se centraliza en el header y se elimina de los lugares donde
hoy vive embebido en el contenido (`HomePlaceholder` en `App.tsx`, botón inline de
`AdminCreateUserPage`). Cambio 100% frontend, sin tocar backend ni esquema — el campo `name` que
necesita el mensaje de bienvenida ya lo devuelve el backend, solo falta tiparlo en el cliente.

## Coverage: PRD → blocks

| Requirement | Covered by |
|---|---|
| FR-01 | Block 1, Block 2 |
| FR-02 | Block 1 |
| FR-03 | Block 1 |
| FR-04 | Block 1 |
| FR-05 | Block 2 |
| FR-06 | Block 2 |
| NFR-01 | Strategy: `NavLink` de react-router-dom marca el link activo con `aria-current="page"` nativo; `AppHeader.css` (Block 1) le da estilo visual distinto usando los tokens de `styles/tokens.css` |
| NFR-02 | Strategy: `AppHeader` y `HomePage` acceden a la sesión exclusivamente vía `useAuth()` (hook existente), nunca llaman a `fetch`/servicios de API directamente |

## Dependencies between blocks

Block 2 depende de Block 1: `ProtectedRoute` (Block 2) importa y renderiza `AppHeader` (Block 1).
Block 1 no depende de Block 2 — es un componente nuevo y aislado, verificable con su propio spec
sin tocar ningún archivo existente.

## Block 1 — AppHeader

**Files**
- `frontend/src/components/AppHeader.tsx` (new) — header de navegación persistente
- `frontend/src/components/AppHeader.css` (new) — estilos, solo variables de `styles/tokens.css`
- `frontend/src/components/AppHeader.spec.tsx` (new) — tests del componente aislado

**Logic**

`AppHeader` es un componente sin props que lee la sesión con `useAuth()`:
- Nombre de la app ("TabSum+") como `Link` (react-router-dom) a `/home` (FR-02).
- Un mapa constante `ROLE_NAV_LINKS: Record<UserRole, { to: string; label: string }[]>` define los
  enlaces por rol (FR-03):
  - `PM`: Clientes (`/pm/clients`), Composición de equipos (`/teams/composition`)
  - `LEADER`: Equipos (`/leader/teams`), Composición de equipos (`/teams/composition`)
  - `RESOURCE`: Composición de equipos (`/teams/composition`)
  - `ADMIN`: Alta de usuarios (`/admin/users`)
  Cada enlace se renderiza con `NavLink`, usando `className={({isActive}) => ...}` para aplicar un
  modificador CSS cuando `isActive` es true (NFR-01). Si `user` es `null` (no debería ocurrir dado
  que `AppHeader` solo se monta dentro de `ProtectedRoute` con sesión activa, pero se contempla
  como guarda defensiva), no se renderiza ningún enlace de sección.
- Botón "Cerrar sesión" que llama `void logout()` de `useAuth()` (FR-04, AC-08). No navega
  explícitamente: al limpiarse la sesión, el próximo render de `ProtectedRoute` (que envuelve a
  `AppHeader`) detecta `isAuthenticated === false` y redirige a `/login` — mismo mecanismo que ya
  usaba `HomePlaceholder`.

**Decisión de diseño registrada (arch audit, PLAN):** `AppHeader` no llama a la API directamente —
consume la sesión vía `useAuth()`, cumpliendo la convención de capas de `AGENTS.md`. El mapa
rol→enlaces es dato de presentación puro (no regla de negocio ni contrato de API), por lo que vive
en el componente y no en `services/`.

**Error handling**
- `user === null`: caso defensivo — no debería ocurrir en la práctica porque `AppHeader` solo se
  monta dentro de `ProtectedRoute` una vez confirmado `isAuthenticated`, pero el componente no debe
  asumirlo ciegamente. En ese caso, `AppHeader` renderiza únicamente el nombre de la app (sin
  enlaces de sección ni botón de logout) en vez de lanzar una excepción por acceder a propiedades
  de `user` inexistente.
- Falla de `logout()` (p. ej. red caída): **no aplica a este bloque** — el manejo (limpiar el
  estado local en un `finally` sin importar si la invalidación server-side falla) ya existe en
  `useAuth().logout()` (`hooks/use-auth.ts`) y ya está cubierto por los tests de ese hook desde
  FEAT-001; no es una rama de error que este bloque introduzca o deba re-testear. `AppHeader` llama
  `void logout()` sin try/catch propio, igual que los botones de logout que reemplaza.

**Required tests**
- [ ] Con `user.role === 'PM'`, se renderizan exactamente los enlaces "Clientes" y "Composición de
      equipos", y ningún otro — valida AC-02
- [ ] Con `user.role === 'LEADER'`, se renderizan exactamente "Equipos" y "Composición de equipos"
      — valida AC-03
- [ ] Con `user.role === 'RESOURCE'`, se renderiza únicamente "Composición de equipos" — valida
      AC-04
- [ ] Con `user.role === 'ADMIN'`, se renderiza "Alta de usuarios" — valida AC-05
- [ ] Click en el nombre de la app navega a `/home` — valida AC-06
- [ ] Click en el botón de cerrar sesión invoca `logout()` — valida AC-08
- [ ] Estando en la ruta de uno de los enlaces (`MemoryRouter initialEntries`), ese enlace tiene
      `aria-current="page"` y los demás no — valida NFR-01
- [ ] Con `user === null`, no se renderiza ningún enlace de sección ni botón de logout, y el
      componente no lanza ninguna excepción — valida el caso defensivo documentado arriba

**Completion criterion**
`AppHeader.spec.tsx` pasa completo (`npm --prefix frontend test`) sin modificar ningún otro
archivo del repo; `tsc -b --noEmit` no reporta errores nuevos.

## Block 2 — Integración: ProtectedRoute + HomePage + limpieza

**Files**
- `frontend/src/components/ProtectedRoute.tsx` (modified) — compone `AppHeader`
- `frontend/src/services/auth.service.ts` (modified) — agrega `name` a `AuthUser`
- `frontend/src/App.tsx` (modified) — usa `HomePage` en vez de `HomePlaceholder`
- `frontend/src/pages/AdminCreateUserPage.tsx` (modified) — quita el botón de logout duplicado
- `frontend/src/App.spec.tsx` (modified) — mock con `name`, aserciones actualizadas
- `frontend/src/components/ProtectedRoute.spec.tsx` (modified) — casos con `AppHeader` presente
- `frontend/src/hooks/use-auth.spec.ts` (modified) — mock de login con `name`
- `frontend/src/pages/LoginPage.spec.tsx` (modified) — mock de login con `name`
- `frontend/src/pages/HomePage.tsx` (new) — contenido de `/home`
- `frontend/src/pages/HomePage.css` (new) — estilos, solo variables de `styles/tokens.css`
- `frontend/src/pages/HomePage.spec.tsx` (new) — tests de `HomePage`

**Logic**

- `ProtectedRoute`: cuando `isAuthenticated` es `true`, renderiza `<AppHeader />` seguido del
  contenido correspondiente — `children` si `hasRequiredRole`, o el mensaje de acceso denegado si
  no. Cuando `isAuthenticated` es `false`, el comportamiento no cambia: redirige a `/login` sin
  montar `AppHeader` (AC-09).
  **Decisión de diseño registrada (PLAN, confirmada con arch audit y lectura literal del PRD):** el
  header se muestra también en la pantalla de acceso denegado por rol. AC-01 dice "cualquier
  pantalla protegida" sin condicionarlo a que el rol matchee, y la sección Riesgos del PRD aclara
  que el filtrado del header es solo UX — el control de acceso real sigue siendo `ProtectedRoute`
  mismo, que nunca deja de aplicarse. Esto le da al usuario una forma de navegar fuera de una
  pantalla a la que no tiene acceso sin escribir una URL a mano.
- `auth.service.ts`: se agrega `name: string` a la interfaz `AuthUser` (el backend ya lo devuelve
  en el login vía `UserResponseDto` — no hay cambio de contrato real, solo se tipa un campo
  existente que el cliente ignoraba).
- `App.tsx`: se elimina la función `HomePlaceholder` completa; la ruta `/home` renderiza
  `<HomePage />` dentro del mismo `<ProtectedRoute>` que ya tenía.
- `HomePage.tsx`: lee `user` de `useAuth()` y muestra "Bienvenido, {user.name}. Estás logueado como
  {rol legible}." (FR-05). Mapa local `ROLE_LABELS: Record<UserRole, string>` → `PM: 'PM'`,
  `LEADER: 'Líder'`, `RESOURCE: 'Recurso'`, `ADMIN: 'Admin'`. No incluye ningún control de logout
  (FR-06) — ya vive en `AppHeader` vía `ProtectedRoute`.
- `AdminCreateUserPage.tsx`: se elimina el `<button>` "Cerrar sesión" y la importación/uso de
  `logout` que quedó sin otro consumidor en el componente (el resto de sus usos de `useAuth()` —
  `user`, `accessToken` — se mantienen).
- Specs existentes: se ajustan mocks y aserciones para reflejar dónde vive ahora cada pieza de UI,
  sin cambiar lo que cada test verifica en esencia (regresión, no nueva cobertura de negocio).

**Error handling**
- `ProtectedRoute`: no introduce ninguna rama de error nueva — las dos ramas existentes
  (`!isAuthenticated` → redirect a `/login`; `!hasRequiredRole` → mensaje de acceso denegado) se
  preservan sin cambios, solo se les antepone `<AppHeader />` cuando `isAuthenticated` es `true`.
- `auth.service.ts`: agregar `name: string` a `AuthUser` es un cambio de tipo, no de runtime — no
  agrega ninguna llamada ni ruta de error nueva. Si el backend alguna vez omitiera `name` en la
  respuesta de login sería una violación de contrato preexistente al backend (`UserResponseDto`
  siempre lo incluye), no algo que este bloque introduzca o deba manejar.
- `HomePage`: mismo caso defensivo que `AppHeader` — con `user === null` (no debería ocurrir dentro
  de `ProtectedRoute`), el componente no renderiza el mensaje de bienvenida ni lanza una excepción
  por leer `user.name`/`user.role` de un valor nulo.

**Required tests**
- [ ] `HomePage` con un usuario autenticado muestra "Bienvenido, {name}. Estás logueado como
      {rol legible}." y no renderiza ningún botón de logout en su contenido — valida AC-07
- [ ] `App.spec.tsx`: login como PM navega a `/home`, el header muestra sus enlaces y el mensaje de
      bienvenida aparece con nombre+rol; logout desde el botón del header redirige a `/login` —
      regresión de AC-01, AC-07, AC-08
- [ ] `App.spec.tsx`: sin sesión, montar `/home` redirige a `/login` sin renderizar `AppHeader` ni
      el contenido de `HomePage` — regresión de AC-09
- [ ] `ProtectedRoute.spec.tsx`: con sesión y rol correcto, se renderiza `AppHeader` junto con el
      contenido protegido
- [ ] `ProtectedRoute.spec.tsx`: con sesión pero rol incorrecto, se renderiza `AppHeader` junto con
      el mensaje de acceso denegado (no solo el mensaje solo)
- [ ] `tsc -b --noEmit` sobre `frontend/` pasa sin errores tras agregar `name` a `AuthUser` (incluye
      los mocks corregidos de `use-auth.spec.ts` y `LoginPage.spec.tsx`)
- [ ] Con `user === null`, `HomePage` no renderiza el mensaje de bienvenida y no lanza ninguna
      excepción — valida el caso defensivo documentado arriba

**Completion criterion**
`npm --prefix frontend test` pasa completo (incluye Block 1 y Block 2), `tsc -b --noEmit` sin
errores, y navegar manualmente como cada rol (PM/LEADER/RESOURCE/ADMIN) muestra únicamente sus
enlaces habilitados y el mensaje de bienvenida correcto en `/home`.

## Final verification

- Los 4 roles ven, cada uno, exactamente los enlaces de su propia sección en el header, en
  cualquier pantalla protegida (AC-01 a AC-05).
- El nombre de la app navega a `/home` desde cualquier pantalla (AC-06).
- `/home` muestra el mensaje de bienvenida con nombre y rol, sin ningún control de logout en su
  contenido (AC-07).
- El botón de logout del header cierra la sesión desde cualquier pantalla (AC-08).
- Sin sesión, ninguna pantalla protegida renderiza el header (AC-09).
- No quedan controles de logout duplicados fuera del header (`AdminCreateUserPage` limpio).
- `npm --prefix backend test`, `npm --prefix frontend test` y `tsc -b --noEmit` (frontend) pasan
  sin regresiones.
