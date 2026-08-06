# Verify Report — FEAT-002 (Alta de clientes)

## Ronda 1 — 2026-08-05

| Field | Value |
|-------|-------|
| Ticket | FEAT-002 |
| PRD | docs/daw/prd/prd-FEAT-002.md |
| Spec | docs/daw/specs/spec-FEAT-002.md |
| Result | **PASSED** (0 FAILs, 2 WARNs no bloqueantes) |

### Trazabilidad PRD → Código → Tests

| AC | Implementación | Test | Verdict |
|---|---|---|---|
| AC-01 | `clients.service.ts:create` | `clients.controller.spec.ts` (201, body completo) + `PMClientsPage.spec.tsx` (alta+listado+form limpio) | ✅ PASS |
| AC-02 | `clients.controller.ts` (guards + `@Roles(PM)`) | `clients.controller.spec.ts` (403/401 en POST y GET) + `PMClientsPage.spec.tsx` (acceso denegado) | ✅ PASS |
| AC-03 | `clients.service.ts` (pre-check + `@@unique`) | `clients.controller.spec.ts` (409 mismo/distinto casing) + `PMClientsPage.spec.tsx` (409 conserva input) | ✅ PASS |
| AC-04 | `create-client.dto.ts` (`@MaxLength`) | `clients.controller.spec.ts` (400) + `PMClientsPage.spec.tsx` (validación UX) | ✅ PASS |
| AC-05 | `create-client.dto.ts` (`@IsNotEmpty`) | `clients.controller.spec.ts` (400, vacíos) | ✅ PASS |
| AC-06 | `clients.service.ts:findAll` (orderBy createdAt) | `clients.controller.spec.ts` (orden real) + `PMClientsPage.spec.tsx` (listado al montar) | ✅ PASS |
| AC-07 | `PMClientsPage.tsx` (empty state) | `PMClientsPage.spec.tsx` (empty state) + `clients.controller.spec.ts` (`[]`) | ✅ PASS |

Ningún test es "solo status code": todos verifican body, efectos secundarios (`create` no
invocado) o estado real de la UI.

### Spec tasks

- ✅ Block 1 (Backend) — 8/8 archivos, 11/10 tests comprometidos (401/403 separados en 2 tests).
  `@@unique([nameNormalized])` coincide con NFR-01. Rollback documentado.
- ✅ Block 2 (`clients.service.ts`) — 2/2 archivos, 7/5 tests. Ningún error se traga.
- ⚠️ Block 3 (`PMClientsPage`) — 6/6 archivos, 14/8 tests (incluye el test de mount-failure
  agregado en la corrección del spec). **Desvío:** `PMClientsPage.css` usa `#ffffff` hardcodeado 3
  veces (líneas 23, 59, 100) — incumple el criterio literal de cierre del bloque ("sin colores
  hardcodeados fuera de las variables"). No es un bug funcional; `AGENTS.md` tampoco define un
  token de superficie/blanco en su tabla de paleta.

### Cobertura (re-medida en esta ronda)

- ✅ `backend/src/clients/**` — 100% stmts/branch/funcs/lines
- ✅ `frontend/src/services/clients.service.ts` — 100% en las 4 métricas
- ✅ `frontend/src/pages/PMClientsPage.tsx` — 100% stmts/funcs/lines, 97.36% branch (única rama
  sin cubrir: fallback defensivo `?? 'Datos inválidos'`, prácticamente inalcanzable con `safeParse`)

Todos por encima del umbral 80%. Sin casos en banda 80-90% que ameriten W-VER-02.

### Sad paths (F-VER-04)

✅ Completos en las 3 capas: backend (vacío, longitud, duplicado x2, rol inválido, sin auth),
`clients.service.ts` (409, 403, body no-JSON, mensaje array), `PMClientsPage` (validación UX, 409,
error no-Error, fallo de `listClients` al montar).

### Suite completa (ejecutada en esta ronda)

✅ Backend: 44/44 — ✅ Frontend: 40/40 — ✅ Total: 84/84, coincide con el commit `930b897`.

### Calidad

- ⚠️ Lint: sin comando declarado en `AGENTS.md` para ninguno de los dos proyectos — gap
  preexistente de FEAT-001, no penalizado en este ticket.
- ✅ Typecheck backend (`nest build`) y frontend (`tsc -b --noEmit`): limpios.
- ✅ Sin imports no usados, sin código muerto (`console.log`/`TODO`/`FIXME`/`debugger`).
- ✅ Tests no frágiles: cada uno construye su propio mock de Prisma, sin estado global compartido,
  sin dependencia de orden de ejecución.
- ✅ Guards de RBAC reutilizados sin modificar desde FEAT-001 (`git diff` confirma cero cambios).

### WARNs (no bloqueantes)

1. `PMClientsPage.css:23,59,100` — `#ffffff` hardcodeado sin token `--color-surface` en
   `tokens.css`. **Decisión del usuario: cerrar antes de RELEASE** → corrective loop a CODE (ver
   Ronda 2).
2. Evidencia TDD (tests en rojo antes del código, por bloque) no verificable por el agente de
   verificación — nota de proceso para el próximo ticket, no reabre este VERIFY.

**Total: 20 passed, 0 failed, 2 warnings — Result: PASSED**

---

## Ronda 2 — 2026-08-05 (re-check acotado tras corrective loop voluntario)

| Field | Value |
|-------|-------|
| Motivo | Cerrar WARN #1 de la Ronda 1 antes de RELEASE (decisión del usuario) |
| Commit | `82f4f23` — agrega `--color-surface` a `tokens.css`/`AGENTS.md`, reemplaza los 3 `#ffffff` en `PMClientsPage.css` |
| Result | **PASSED** |

- ✅ WARN #1 cerrado: sin `#ffffff`/`#fff`/`white` hardcodeado en `PMClientsPage.css` (grep: 0
  matches); `--color-surface: #FFFFFF` presente en `tokens.css` y en la tabla de paleta de
  `AGENTS.md`.
- ✅ Diff acotado exactamente a lo descrito (3 archivos, 5 inserciones/3 borrados) — sin tests ni
  archivos `.ts`/`.tsx` de lógica tocados.
- ✅ Suite completa re-ejecutada: 84/84 (idéntico a Ronda 1, cambio test-neutral como se esperaba).
- ✅ Typecheck frontend (`tsc -b --noEmit`): limpio.
- ⚠️ WARN #2 (evidencia TDD) se mantiene abierto, sin re-litigar — no era parte del alcance de
  esta ronda.

**Total: 9 passed, 0 failed, 1 warning (heredado, no bloqueante) — Result: PASSED**
