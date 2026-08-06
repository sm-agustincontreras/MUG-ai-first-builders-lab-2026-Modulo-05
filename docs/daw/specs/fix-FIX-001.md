# Fix-plan FIX-001: Logout no redirige a /login en la ruta /home

| Field | Value |
|-------|-------|
| Ticket | FIX-001 |
| Tier | FIX |
| RCA | docs/daw/specs/rca-FIX-001.md |
| Date | 2026-08-06 |
| Spec loops | 0 |

## Problem

Al cerrar sesión desde `/home` (`HomePlaceholder`), el usuario no es redirigido a `/login`. La
sesión se invalida correctamente (server-side y en el contexto de React), pero la UI se queda
mostrando el placeholder con datos vacíos en vez de sacar al usuario de ahí.

## Root cause

`frontend/src/App.tsx` define la ruta `/home` sin envolverla en `<ProtectedRoute>`, a diferencia
de `/admin/users` (y de `/pm/clients` en la rama de FEAT-002, todavía no mergeada). Sin ese guard,
nada reacciona al cambio de `isAuthenticated` a `false` navegando a `/login`. Detalle completo en
`docs/daw/specs/rca-FIX-001.md`.

## Solution — steps

1. `frontend/src/App.tsx` — envolver la ruta `/home` en `<ProtectedRoute>`, sin `requiredRole`
   (esa ruta recibe PM/Líder/Recurso, cualquier rol no-Admin — solo exige sesión iniciada, igual
   que ya hace `ProtectedRoute` cuando no se le pasa `requiredRole`):
   ```tsx
   <Route
     path="/home"
     element={
       <ProtectedRoute>
         <HomePlaceholder />
       </ProtectedRoute>
     }
   />
   ```

## Dependencies between steps

Un solo paso, sin dependencias.

## Error handling

Sin casos de error nuevos — `ProtectedRoute` ya maneja el caso "sin sesión" (redirige a `/login`)
y el caso "con sesión pero rol insuficiente" (mensaje de acceso denegado), ambos ya testeados en
`ProtectedRoute.spec.tsx`. Este fix no le pide rol, así que solo el primer caso aplica acá.

## Tests

- [ ] **Regression test**: en `App.spec.tsx` (nuevo archivo — no existe uno hoy que renderice
  `<App>` completo), montar la app con un usuario autenticado en `/home`, invocar `logout()`, y
  verificar que la UI navega a `/login` (falla ANTES del fix — hoy se queda en `/home`; pasa
  DESPUÉS).
- [ ] Montar `/home` sin sesión iniciada (`isAuthenticated: false`) → verificar redirect inmediato
  a `/login`, sin llegar a renderizar `HomePlaceholder`.
- [ ] Montar `/home` con sesión iniciada → `HomePlaceholder` se renderiza normalmente (no
  regresiona el caso feliz).

## Regression risk

**Low.** Un solo archivo, un solo componente afectado (`HomePlaceholder`, ya mínimo y sin lógica
propia), reutiliza un componente (`ProtectedRoute`) ya probado y usado en otra ruta. No toca
`use-auth.ts` ni `ProtectedRoute.tsx`. No hay otras rutas ni componentes que dependan de que
`/home` esté desprotegida.

## Rollback plan

Trivial: revertir el commit de este fix. `App.tsx` vuelve a su estado anterior (ruta `/home` sin
`ProtectedRoute`); no hay migración de datos ni estado persistente involucrado.

Indicador para aplicarlo: si el wrap de `ProtectedRoute` rompiera el flujo normal de login → /home
para algún rol no contemplado (no debería, dado que `ProtectedRoute` sin `requiredRole` solo
exige `isAuthenticated`), revertir y re-investigar antes de reintentar.
