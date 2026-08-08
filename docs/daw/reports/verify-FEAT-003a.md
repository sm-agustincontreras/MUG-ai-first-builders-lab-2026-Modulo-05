# Verify Report — FEAT-003a (User.name obligatorio)

## Ronda 1 — 2026-08-08

| Field | Value |
|-------|-------|
| Ticket | FEAT-003a |
| PRD | docs/daw/prd/prd-FEAT-003a.md |
| Spec | docs/daw/specs/spec-FEAT-003a.md |
| Result | **FAILED** (3 FAILs, 1 WARN no bloqueante) |

### Trazabilidad PRD → Código → Tests

| AC | Implementación | Test | Verdict |
|---|---|---|---|
| AC-01 | `users.service.ts:create` (trim + persist) | `users.controller.spec.ts` (201, body con `name`) | ✅ PASS |
| AC-02 | `create-user.dto.ts` (`@IsNotEmpty`/`@MaxLength(100)`) | `users.controller.spec.ts` (400 sin name, 400 >100 chars) | ✅ PASS |
| AC-03 | `seed.ts:seedAdmin` (`name: 'Admin'`) | `seed.spec.ts` (`created.name === 'Admin'`) | ✅ PASS |
| AC-04 | `migration.sql` (backfill `split_part(email,'@',1)`) | Verificación manual declarada en el spec — **no ejecutada**, migración sin aplicar | ❌ FAIL |
| AC-05 | `migration.sql` (`SET NOT NULL` tras backfill) | Misma verificación manual — **no ejecutada** | ❌ FAIL |

### Completitud del spec

| Regla | Resultado |
|---|---|
| F-VER-01 (AC sin test pasando) | ❌ FAIL — AC-04, AC-05 |
| F-VER-02 (tarea del spec no implementada) | ✅ PASS — 3/3 bloques |
| F-VER-03 (cobertura < 80%) | ✅ PASS — archivos del ticket en 100%, gaps preexistentes fuera de alcance |
| F-VER-04 (sin sad-path) | ✅ PASS — 3 tests 400 sobre `name` |
| F-VER-05 (lint/typecheck) | ✅ PASS — 0 errores backend/frontend |
| F-VER-06 (test del spec no implementado) | ❌ FAIL — ítem de verificación manual del backfill (Block 1) |

### Causa raíz

La migración `20260807224313_add_user_name` quedó escrita y auditada en Block 1, pero nunca se
aplicó contra la base del sandbox (`prisma migrate status` la reportaba pendiente). El spec asumía
"no automatizable sin Postgres en este sandbox" — supuesto que dejó de ser cierto apenas se
detectó, en Block 1, que sí hay un Postgres real corriendo acá.

### Loop correctivo

Se volvió a CODE (sin escribir código nuevo): se corrió `npx prisma migrate deploy` y se ejecutó la
verificación manual exacta que pedía el spec. Tests y SAST se re-confirmaron sin cambios de
superficie (nada de código cambió, solo el estado de la base).

---

## Ronda 2 — 2026-08-08

| Field | Value |
|-------|-------|
| Ticket | FEAT-003a |
| PRD | docs/daw/prd/prd-FEAT-003a.md |
| Spec | docs/daw/specs/spec-FEAT-003a.md |
| Result | **PASSED** (0 FAILs, 0 WARNs) |

### Cierre de los 3 FAILs de la ronda 1

| Item | Evidencia |
|---|---|
| AC-04 | `npx prisma migrate status` → "Database schema is up to date!"; `_prisma_migrations` muestra `finished_at` poblado y `rolled_back_at` NULL para `20260807224313_add_user_name` |
| AC-05 | `SELECT COUNT(*) FROM "User" WHERE "name" IS NULL` ejecutada de forma independiente por el verificador contra Postgres vivo → `0` |
| F-VER-06 (Block 1) | Filas reales inspeccionadas: `admin@tabsum.test` → `name='admin'`, `pm.demo@tabsum.test` → `name='pm.demo'` — consistente con el backfill `split_part(email,'@',1)` |

### Resto del módulo (sin cambios de código desde la ronda 1, se listan por completitud)

| Regla | Resultado |
|---|---|
| F-VER-01 (AC-01, AC-02, AC-03) | ✅ PASS |
| F-VER-02 (3 bloques) | ✅ PASS |
| F-VER-03 (cobertura) | ✅ PASS |
| F-VER-04 (sad paths) | ✅ PASS |
| F-VER-05 (lint/typecheck) | ✅ PASS |
| F-VER-06 (Block 2, Block 3) | ✅ PASS |
| W-VER-01/02/03 | ✅ sin hallazgos |

### Re-ejecución empírica de esta ronda

- `npm --prefix backend test` → 11 suites, 47/47 PASSED, sin regresiones tras aplicar la migración.
- `npm --prefix frontend test` → 9 suites, 43/43 PASSED.

---

**Total: 15 checks passed, 0 failed, 0 warnings (ronda 2)**
**Result: PASSED**
**Next:** aprobación del usuario → commit de este reporte → transición a RELEASE.
