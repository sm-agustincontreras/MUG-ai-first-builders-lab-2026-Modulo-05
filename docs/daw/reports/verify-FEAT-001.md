# Verify Report — FEAT-001 (Autenticación y alta de usuarios)

## Ronda 1 — 2026-08-05 — BLOCKED

| Field | Value |
|-------|-------|
| Tier | FEATURE |
| Scope | 5/5 bloques (backend + frontend) |
| Verificador | `daw-module-verifier` (agente independiente) |
| Resultado | **BLOCKED** — 2 FAILs, 2 WARNs, 24 PASSes |

### Trazabilidad PRD → código → tests (F-VER-01)

Los 9 AC (AC-01 a AC-09) y los 5 NFR del PRD tienen implementación y test que verifica
comportamiento real (no solo status code):

| AC/NFR | Código | Test | Resultado |
|---|---|---|---|
| AC-01 (FR-01) | `auth.controller.ts:login` + `auth.service.ts:login` | `auth.controller.spec.ts` | ✅ |
| AC-02 (FR-01) | `auth.service.ts:login` (dummyHash) | `auth.controller.spec.ts` (2 tests) | ✅ |
| AC-03 (FR-02) | `jwt-auth.guard.ts:handleRequest` | `jwt-auth.guard.spec.ts` (2 tests) | ✅ |
| AC-04 (FR-03) | `users.controller.ts`/`users.service.ts:create` | `users.controller.spec.ts` | ✅ |
| AC-05 (FR-04) | `roles.guard.ts:canActivate` | `users.controller.spec.ts` | ✅ |
| AC-06 (FR-07) | `users.service.ts:create` (findUnique) | `users.controller.spec.ts` | ✅ |
| AC-07 (FR-05) | `auth.service.ts:logout` | `auth.controller.spec.ts` | ✅ |
| AC-08 (FR-06) | `prisma/seed.ts:seedAdmin` | `seed.spec.ts` | ✅ |
| AC-09 (FR-06) | `prisma/seed.ts:seedAdmin` (findFirst) | `seed.spec.ts` | ✅ |
| NFR-01 (bcrypt) | todo el proyecto, `BCRYPT_SALT_ROUNDS=12` | múltiples | ✅ |
| NFR-02 (expiración 15m/7d) | `auth.service.ts:issueTokens` | mecanismo probado, valor exacto no | ⚠️ WARN |
| NFR-03 (roles reutilizables) | `RolesGuard`/`roles.decorator.ts` genéricos | inspección | ✅ |
| NFR-04 (mensajes comprensibles) | guards/services + UI | frontend specs | ✅ |
| NFR-05 (solo GUI) | LoginPage/AdminCreateUserPage/logout | — | ✅ |

### Tareas de la spec (F-VER-02 / F-VER-06)

Los 5 bloques, 31 tests requeridos por la spec + 3 extra (bonus) del Block 4 — los 34 existen y
pasan (28 backend + 6 frontend), reproducido en esta verificación.

### Mitigaciones del threat model

Cookie httpOnly/sameSite/secure, hash dummy anti-enumeración, rotación + detección de reuso de
refresh token, throttling 5/min, seed sin defaults hardcodeados, accessToken solo en memoria,
mensajes de guard consistentes en todo camino de rechazo — todas confirmadas ✅.

### Sad paths (F-VER-04)

Los 4 endpoints (`/auth/login`, `/auth/refresh`, `/auth/logout`, `/users`) tienen cobertura de
camino inválido (401/403/409/400/429 según corresponda). Ninguno es happy-path-only. ✅

### Calidad

- Type-check backend (`tsc --noEmit`) y frontend (`tsc -b`): 0 errores. ✅
- Lint: no configurado en ninguno de los dos proyectos — gap preexistente, no bloquea (F-VER-05). ✅
- Sin código muerto relevante, sin tests frágiles (F-VER-01/W-VER-03). ✅ / ⚠️ ver abajo.

### Cobertura (F-VER-03) — ❌ FAIL, bloqueante

**Backend** (`npx jest --coverage`, 28/28 tests en verde):

| Métrica | Total | Excl. bootstrap |
|---|---|---|
| Statements | 90.76% | 98.3% |
| Functions | 97.29% | 100% |
| Lines | 90.35% | 98.1% |
| **Branches** | **68.42%** | **72.2%** |

Ramas sin cubrir: `jwt.strategy.ts`/`jwt-refresh.strategy.ts` (constructor sin secret configurado),
`roles.guard.ts` (camino "sin `@Roles()` → permitir"), `http-exception.filter.ts:extractMessage`
(respuesta sin campo `message`), `auth.controller.ts:44` (fallback `?? ''` de la cookie —
posiblemente inalcanzable, a confirmar si es defensivo o código muerto).

**Frontend** (`npx vitest run --coverage`, 6/6 tests en verde):

| Métrica | Total | Excl. bootstrap |
|---|---|---|
| Statements | 61.99% | 71.58% |
| Branches | 62.5% | 65.79% |
| Functions | 65.21% | — |

Gaps principales: `users.service.ts` (2.77% — `AdminCreateUserPage.spec.tsx` mockea todo el
módulo en vez de ejercitar el fetch real, a diferencia de `auth.service.spec.ts`),
`ProtectedRoute.tsx` (solo el caso "sin sesión" tiene test; faltan "con sesión + rol correcto" y
"con sesión + rol incorrecto"), `use-auth.ts` (75% — `logout()` y el throw fuera de
`AuthProvider` sin test directo).

### WARNs (no bloqueantes, pero pendientes)

1. NFR-02: el test de expiración usa un token artificialmente vencido, no decodifica ni afirma
   los valores exactos `15m`/`7d`.
2. `auth.controller.ts:44`: fallback `?? ''` posiblemente inalcanzable dado que `JwtRefreshGuard`
   ya exige la cookie antes — decidir si es defensivo o dead code candidato.

### Veredicto

**BLOCKED.** 2 FAILs (cobertura de branches por debajo de 80% en ambos proyectos), 2 WARNs,
24 PASSes. Ninguna funcionalidad está rota — todo lo que falta son tests adicionales sobre ramas
existentes, no cambios de comportamiento. Corrective loop aplicado: `VERIFY → CODE`, gates
`tests`/`sast`/`verify` limpiados, deben re-ganarse tras agregar los tests faltantes.

---

## Ronda 2 — 2026-08-05 — PASSED

| Field | Value |
|-------|-------|
| Tier | FEATURE |
| Scope | 5/5 bloques (backend + frontend) — re-verificación tras corrective loop |
| Verificador | `daw-module-verifier` (agente independiente, sesión nueva) |
| Resultado | **PASSED** — 0 FAILs, 2 WARNs, 26 PASSes |

Commit que cerró el gap: `0a613f8` ("cerrar gap de cobertura de branches encontrado en VERIFY").

### Cobertura (F-VER-03) — ✅ PASS, re-medida de forma independiente

**Backend** (`npx jest --coverage`, 33/33 tests en verde, +5 sobre ronda 1):

| Métrica | Total |
|---|---|
| Statements | 92.30% |
| Branches | **81.57%** (era 68.42%) |
| Functions | 97.29% |
| Lines | 92.10% |

**Frontend** (`npx vitest run --coverage`, 19/19 tests en verde, +13 sobre ronda 1):

| Métrica | Total |
|---|---|
| Statements | 94.96% (era 61.99%) |
| Branches | **81.13%** (era 62.50%) |
| Functions | 95.23% |
| Lines | 94.96% |

`main.tsx`/`App.tsx` (bootstrap) excluidos del cálculo vía `vite.config.ts`, mismo criterio que
ya aplicaba el backend a `main.ts`/`app.module.ts`.

### Calidad de los tests nuevos

Todos verifican comportamiento real (mensajes de error exactos, valores de retorno, estado tras
fallos) — ninguno es superficial. `users.service.spec.ts` (frontend) corrige además un gap
metodológico de ronda 1: `AdminCreateUserPage.spec.tsx` mockeaba el módulo `users.service`
entero, dejando el `fetch` real sin ejercitar; el nuevo spec lo testea contra `fetch` mockeado,
igual que ya hacía `auth.service.spec.ts`.

### Regresiones

0. Backend 33/33, frontend 19/19 — todo lo de ronda 1 sigue en verde.

### WARNs — revalidados, siguen sin bloquear

1. **NFR-02**: se confirmó que ningún test nuevo agregó assertion del valor exacto de expiración
   (`15m`/`7d`) — se sigue probando el mecanismo (token vencido → rechazado), no el valor
   configurado. Pendiente de una mejora futura, no bloqueante.
2. **`auth.controller.ts:44`**: re-confirmado por lectura de código que es defensivo e
   inalcanzable — `JwtRefreshGuard`/`JwtRefreshStrategy` garantizan la cookie antes de que el
   controller la lea. No es dead code a eliminar, no requiere test forzado.

### F-VER-05 (type-check)

Backend `tsc --noEmit` y frontend `tsc -b`: 0 errores en ambos, incluyendo los archivos de test
nuevos y el `vite.config.ts` modificado.

### Veredicto

**PASSED.** 0 FAILs, 2 WARNs no bloqueantes (heredados de ronda 1, sin cambios), 26 PASSes.
`gates.verify` = `true`.
