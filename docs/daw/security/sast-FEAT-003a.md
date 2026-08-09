# SAST Report — FEAT-003a (User.name obligatorio)

| Field | Value |
|-------|-------|
| Date | 2026-08-08 |
| Ticket | FEAT-003a |
| Scope | Bloques 1-3 (backend/prisma, backend/src/users, backend/src/auth, frontend/src/services/users.service.ts, frontend/src/pages/AdminCreateUserPage.tsx) — cierre de CODE |
| Result | **PASSED** (con riesgo aceptado heredado de ADR-001, sin cambios) |

## Secrets (F-SAST-01)
✅ Sin secretos hardcodeados en ninguno de los 15 archivos nuevos/modificados de este ticket (grep
dirigido). Las cadenas `VALID_PASSWORD`/`NEW_USER_PASSWORD` en los `*.controller.spec.ts` son
constantes de fixture ya existentes desde FEAT-001, sin cambios. `.env` sigue en `.gitignore`.

## Injection (F-SAST-02, F-SAST-03, F-SAST-05)
✅ `users.service.ts` usa exclusivamente `prisma.user.findUnique`/`prisma.user.create`, sin
`$queryRaw`/`$executeRaw`. La migración `20260807224313_add_user_name/migration.sql` es DDL propio
de Prisma (`ALTER TABLE`/`UPDATE ... WHERE`), sin input de usuario ni concatenación — el backfill
opera sobre `email`, una columna ya existente, con `split_part()` (función nativa de Postgres, sin
input externo). Sin `exec`/`spawn`/`child_process`. Sin input de usuario en paths de archivo.

## XSS y funciones inseguras (F-SAST-06, F-SAST-04/17)
✅ `AdminCreateUserPage.tsx` renderiza el nuevo campo `name` como texto plano vía JSX
(auto-escapado de React) — sin `dangerouslySetInnerHTML`, sin `innerHTML`. Ningún componente del
ticket usa esas APIs (mitigación ya prevista en `docs/daw/security/threat-FEAT-003a.md`, riesgo
MEDIUM de XSS almacenado). Sin `eval()`/`new Function()`.

## Crypto (F-SAST-08)
N/A — sin cambios de hashing/cifrado. `name` no es una credencial (clasificado PII de bajo riesgo
en el threat model, mismo tratamiento que `email`).

## Logging de datos sensibles (F-SAST-10)
✅ Ningún `console.log`/`Logger` nuevo en ningún archivo del ticket. Los errores de validación
(`BadRequestException` por nombre vacío tras trim) viajan únicamente por el
`HttpExceptionFilter` global existente, sin loguear el payload.

## CSRF (F-SAST-12)
✅ Sin cambios respecto a FEAT-001/FEAT-002 — `POST /users` sigue exigiendo
`Authorization: Bearer` (no depende de la cookie de refresh para autorizar la acción).

## Validación de input (F-SAST-14)
✅ `CreateUserDto.name` con `class-validator` (`@IsString`, `@IsNotEmpty`, `@MaxLength(100)`),
validado por el `ValidationPipe` global existente, más el guard adicional en `users.service.ts`
que rechaza un `name` de solo espacios tras `.trim()` (mitigación específica del threat model,
ver mitigación #2 de `threat-FEAT-003a.md`). En frontend, `AdminCreateUserPage.tsx` valida con
`zod` como espejo de UX — nunca reemplaza la validación del servidor.

## Manejo de errores (F-SAST-15)
✅ `BadRequestException` (400, nombre vacío/solo espacios) y el `400` de `class-validator` son
excepciones tipadas, capturadas por el `HttpExceptionFilter` global — ningún catch silencioso,
ningún stack trace expuesto. `users.service.ts` (frontend) sigue sin tragar ningún error de red/API.

## Dependencias (F-SAST-13/16)

`npm audit`: backend 10 hallazgos (7 moderate, 3 high), frontend 2 hallazgos (2 moderate).
Confirmado con `git diff` en ambos `package.json`/`package-lock.json` contra el estado previo a
este ticket: **0 líneas de diferencia** — este ticket no agregó ninguna dependencia nueva
(confirmado también por los 3 `daw-arch-auditor` de los bloques).

Como el árbol de dependencias no cambió:
- Los hallazgos High del backend (`glob`/`picomatch`/`tmp`/`@nestjs/cli` como devDependency;
  `lodash` sin la función vulnerable invocada; `multer` sin endpoint de upload) siguen bajo
  **ADR-001, sin re-evaluación necesaria**.
- Los 2 hallazgos Moderate de `react-router`/`react-router-dom` (open redirect vía backslash;
  inyección de constructor en hidratación SSR) ya fueron triados en
  `docs/daw/security/sast-FEAT-002.md`: verificado de nuevo para este ticket que
  `AdminCreateUserPage.tsx` no agrega ningún `useNavigate`/`<Link>`/`<Navigate>` (0 coincidencias
  en el diff) — el análisis de alcanzabilidad de FEAT-002 sigue vigente sin cambios: ningún
  destino de navegación depende de input de usuario, y el proyecto sigue siendo un SPA
  client-rendered sin SSR.

## Suppressions
0 — mismo criterio que FEAT-001/FEAT-002: la aceptación de riesgo de dependencias se documenta vía
ADR (ADR-001, sin cambios), no vía el formato de supresión Medium de 7 campos.

---

**Total: 0 hallazgos de código nuevos, 0 hallazgos de dependencias nuevos (árbol sin cambios,
ADR-001 y el triage de react-router de FEAT-002 siguen vigentes)**
**Next:** commit de este reporte, luego transición a VERIFY.
