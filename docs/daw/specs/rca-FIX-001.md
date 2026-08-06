# RCA FIX-001: Logout no redirige a /login en la ruta /home

| Field | Value |
|-------|-------|
| Ticket | FIX-001 |
| Date | 2026-08-06 |
| Related PRD | docs/daw/prd/prd-FEAT-001.md |
| Gap in the PRD | No |

## Síntoma

Al cerrar sesión desde la página `/home` (`HomePlaceholder`), el usuario no es redirigido a
`/login`. La sesión se limpia correctamente (invalidación server-side confirmada, RF-05/AC-07 de
FEAT-001), pero el usuario queda visualmente parado en `/home`, viendo el placeholder con datos
ahora vacíos (`user` en `null`).

## Causa raíz

`frontend/src/App.tsx` define la ruta `/home` sin envolverla en `<ProtectedRoute>`:

```tsx
<Route path="/home" element={<HomePlaceholder />} />
```

A diferencia de `/admin/users` y `/pm/clients`, que sí están envueltas en
`<ProtectedRoute requiredRole="...">` y por lo tanto redirigen a `/login` en cuanto
`isAuthenticated` pasa a `false` (ver `frontend/src/components/ProtectedRoute.tsx:22`).

`useAuth().logout()` (`frontend/src/hooks/use-auth.ts:39-49`) funciona correctamente: limpia
`accessToken` y `user` del contexto siempre, incluso si la llamada server-side falla. El problema
no es el logout en sí — es que `/home` no tiene ningún mecanismo que reaccione a ese cambio de
estado navegando a otro lado. `HomePlaceholder` simplemente vuelve a renderizar con `user` en
`null`.

## Por qué no se detectó antes

`HomePlaceholder` fue declarado explícitamente como un placeholder mínimo en el spec de FEAT-001
("vista de inicio diferenciada por rol... queda para una feature posterior"). El foco de los tests
de FEAT-001 estuvo en el flujo de login/alta de usuario, no en el logout desde `/home` — el único
test de logout ejercitado cubre `AC-07` (invalidación del refresh token vía
`auth.service.spec.ts`), no el comportamiento de UI resultante en esa ruta específica.

## Revisión de PRD

`docs/daw/prd/prd-FEAT-001.md` — FR-05/AC-07 exigen únicamente que el sistema invalide el refresh
token al cerrar sesión. No hay ningún FR/AC que exija un redirect de UI tras logout. **No hay gap
en el PRD**: el comportamiento esperado (no quedar en una pantalla que aparenta seguir logueada)
es una expectativa razonable de UX, pero corregirla es una corrección de implementación, no un
requerimiento faltante.

## Alcance de la corrección

Envolver la ruta `/home` en `<ProtectedRoute>`, igual que las otras dos rutas protegidas. Sin
cambios de arquitectura, sin nuevos componentes, sin tocar `use-auth.ts` ni `ProtectedRoute.tsx`
(su lógica ya es correcta y ya está testeada).
