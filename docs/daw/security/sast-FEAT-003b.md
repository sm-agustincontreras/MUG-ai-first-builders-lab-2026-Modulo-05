# SAST Report — FEAT-003b (Alta de equipos y asignación de recursos)

| Field | Value |
|-------|-------|
| Date | 2026-08-09 |
| Ticket | FEAT-003b |
| Scope | Bloques 1-2 (backend/prisma, backend/src/teams, frontend/src/services/teams.service.ts, frontend/src/pages/LeaderTeamsPage.tsx) — cierre de CODE |
| Result | **PASSED** (con riesgo aceptado heredado de ADR-001, sin cambios) |

## Secrets (F-SAST-01)
✅ Sin secretos hardcodeados en ningún archivo nuevo/modificado del ticket (grep dirigido sobre
`backend/src/teams/` y los 4 archivos de frontend). `.env` sigue en `.gitignore`.

## Injection (F-SAST-02, F-SAST-03, F-SAST-05)
✅ `teams.service.ts` (backend) usa exclusivamente `prisma.team.findUnique/create/findMany` y
`prisma.user.findUnique/findMany/updateMany/findUniqueOrThrow`, sin `$queryRaw`/`$executeRaw`. La
migración `<timestamp>_add_team/migration.sql` es DDL propio de Prisma, generada sin edición
manual. Sin `exec`/`spawn`/`child_process`. Sin input de usuario en paths de archivo.

## Autorización — IDOR y condición de carrera (específico de este ticket)
✅ `assignResource` verifica `team.ownerId !== requesterId` en el service (no solo el rol vía
`RolesGuard`) antes de permitir la asignación — mitigación explícita del threat model
(`docs/daw/security/threat-FEAT-003b.md`) para el IDOR identificado en AC-08.
✅ La condición de carrera identificada en el threat model (dos requests concurrentes asignando el
mismo recurso) está cerrada con `prisma.user.updateMany({ where: { id: resourceId, teamId: null },
data: { teamId } })` — actualización atómica condicional en vez de `findUnique` + `update`
separados; `result.count === 0` dispara `409`. Verificado también por
`teams.controller.spec.ts` (test de concurrencia: exactamente una de dos requests paralelas
responde `200`).
✅ `GET /teams/mine` filtra siempre por `ownerId = req.user.sub` — nunca devuelve equipos de otro
Líder (mitigación de IDOR de listado, mismo threat model).

## XSS y funciones inseguras (F-SAST-06, F-SAST-04/17)
✅ `LeaderTeamsPage.tsx` renderiza `name`/`description`/`email` como texto plano vía JSX
(auto-escapado de React) — sin `dangerouslySetInnerHTML`, sin `innerHTML` en ningún archivo del
ticket. Sin `eval()`/`new Function()`.

## Crypto (F-SAST-08)
N/A — sin cambios de hashing/cifrado. `Team.name`/`description` no son credenciales.

## Logging de datos sensibles (F-SAST-10)
✅ Ningún `console.log`/`Logger` nuevo en `backend/src/teams/` ni en los archivos de frontend. Los
errores (`ConflictException`, `ForbiddenException`, `NotFoundException`) viajan únicamente por el
`HttpExceptionFilter` global existente, sin loguear el payload.

## CSRF (F-SAST-12)
✅ Sin cambios respecto a tickets previos — los 4 endpoints de `teams.controller.ts` exigen
`Authorization: Bearer` (no dependen de la cookie de refresh para autorizar la acción).

## Validación de input (F-SAST-14)
✅ `CreateTeamDto` (`name` ≤30, `description` ≤255, ambos `@IsNotEmpty`) y `AssignResourceDto`
(`resourceId` `@IsNotEmpty`) con `class-validator`, validados por el `ValidationPipe` global. En
frontend, `createTeamSchema` (zod) en `LeaderTeamsPage.tsx` es espejo de UX — nunca reemplaza la
validación del servidor. La selección de `teamId`/`resourceId` está restringida a los valores
devueltos por `listMyTeams`/`listAvailableResources` (`<select>`), sin campo de texto libre para
IDs.

## Manejo de errores (F-SAST-15)
✅ `ConflictException` (409), `ForbiddenException` (403) y `NotFoundException` (404) son
excepciones tipadas capturadas por el `HttpExceptionFilter` global — ningún catch silencioso,
ningún stack trace expuesto. `teams.service.ts` (frontend) nunca traga un error de API: se
relanza vía `handleResponse`/`extractErrorMessage` y se muestra en pantalla
(`createError`/`assignError`), incluido el caso `409` de recurso ya asignado, que además refresca
la lista de recursos libres.

## Dependencias (F-SAST-13/16)

`npm audit`: backend 10 hallazgos (7 moderate, 3 high), frontend 2 hallazgos (2 moderate) —
idénticos en cantidad y naturaleza a los reportados en `sast-FEAT-003a.md`. Confirmado con `git
diff --stat` sobre los 4 `package.json`/`package-lock.json`: **0 líneas de diferencia** — este
ticket no agregó ninguna dependencia nueva.

Como el árbol de dependencias no cambió:
- Los hallazgos High del backend (`multer` sin endpoint de upload, deps transitivas de
  `@nestjs/cli` como devDependency) siguen bajo **ADR-001, sin re-evaluación necesaria**.
- Los 2 hallazgos Moderate de `react-router`/`react-router-dom` ya fueron triados en
  `docs/daw/security/sast-FEAT-002.md`: verificado de nuevo para este ticket que
  `LeaderTeamsPage.tsx` y `App.tsx` no agregan ningún `useNavigate`/`<Link>` (0 coincidencias en
  el diff; el único `<Navigate>` de `App.tsx` es el redirect estático preexistente `/` → `/login`,
  sin input de usuario) — el análisis de alcanzabilidad de FEAT-002 sigue vigente: el proyecto
  sigue siendo un SPA client-rendered sin SSR.

## Suppressions
0 — mismo criterio que tickets previos: la aceptación de riesgo de dependencias se documenta vía
ADR (ADR-001, sin cambios), no vía el formato de supresión Medium de 7 campos.

---

**Total: 0 hallazgos de código nuevos, 0 hallazgos de dependencias nuevos (árbol sin cambios,
ADR-001 y el triage de react-router de FEAT-002 siguen vigentes)**
**Next:** commit de este reporte, luego transición a VERIFY.
