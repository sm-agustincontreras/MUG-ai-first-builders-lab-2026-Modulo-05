# Threat Model FIX-001: Logout no redirige a /login en la ruta /home

| Field | Value |
|-------|-------|
| Ticket | FIX-001 |
| Date | 2026-08-06 |
| Spec de referencia | docs/daw/specs/fix-FIX-001.md |

## Componentes y superficie de ataque

| Componente | Cambio | Superficie |
|---|---|---|
| `frontend/src/App.tsx` (ruta `/home`) | Agrega `<ProtectedRoute>` (sin `requiredRole`) alrededor de `HomePlaceholder` | Ninguna superficie nueva — el cambio **cierra** una debilidad de control de acceso existente, no abre una |

## Límites de confianza

Sin cambios respecto a los ya declarados en `threat-FEAT-001.md` — este fix no toca
`use-auth.ts`, `ProtectedRoute.tsx`, ni ningún endpoint del backend. Reutiliza sin modificar el
mismo componente `ProtectedRoute` ya evaluado y probado.

## Datos sensibles

Sin cambios. `HomePlaceholder` solo muestra `email`/`role` del usuario en sesión — mismos datos ya
clasificados como PII de bajo riesgo en `threat-FEAT-001.md`.

## Análisis STRIDE

| Categoría | Riesgo (antes del fix) | Probabilidad | Impacto | Mitigación (este fix) |
|---|---|---|---|---|
| Elevation of Privilege | Un usuario sin sesión activa (recién deslogueado) podía seguir viendo el contenido de `/home` en vez de ser expulsado a `/login` | Media (ocurre en todo logout desde esa ruta) | Bajo (`HomePlaceholder` no expone nada más allá de email/rol ya vistos por el propio usuario, y ninguna acción sensible es posible desde ahí) | 🟢 `ProtectedRoute` redirige a `/login` en cuanto `isAuthenticated` es `false` |
| Information Disclosure | Datos del usuario (`email`/`role`) visibles brevemente tras logout, hasta que React limpia el estado | Baja | Bajo (mismo usuario viendo sus propios datos, no de un tercero) | 🟢 Mismo fix — la ruta deja de renderizarse sin sesión |

Ningún otro STRIDE aplica: no hay input de usuario nuevo (Spoofing/Tampering N/A), no hay logging
nuevo (Repudiation N/A), no hay cambio de disponibilidad (DoS N/A).

## Mitigaciones a plegar en el fix-plan

1. `<ProtectedRoute>` (sin `requiredRole`) envolviendo la ruta `/home` — ya reflejado en
   `docs/daw/specs/fix-FIX-001.md`.

## Resumen de riesgos

C: 0 | H: 0 | M: 0 | L: 0 (el fix es una mitigación neta, no introduce riesgo nuevo)

**Result: PASSED** — ningún riesgo CRITICAL/HIGH nuevo; el cambio reduce el único riesgo
identificado (control de acceso débil en `/home`).
