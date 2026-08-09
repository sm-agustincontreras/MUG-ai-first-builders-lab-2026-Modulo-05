# SAST Report — FEAT-003c (Composición de equipos)

| Field | Value |
|-------|-------|
| Date | 2026-08-09 |
| Ticket | FEAT-003c |
| Scope | Bloques 1-2 (backend/src/teams, frontend/src/services/teams.service.ts, frontend/src/components/ProtectedRoute.tsx, frontend/src/pages/TeamsCompositionPage.tsx, frontend/src/App.tsx) — cierre de CODE |
| Result | **PASSED** (con riesgo aceptado heredado de ADR-001, sin cambios) |

## Secrets (F-SAST-01)
✅ Sin secretos hardcodeados en ningún archivo nuevo/modificado del ticket (grep dirigido). `.env`
sigue en `.gitignore`.

## Injection (F-SAST-02, F-SAST-03, F-SAST-05)
✅ `teams.service.ts` (backend) — `listAllComposition` usa exclusivamente
`prisma.team.findMany({ include, orderBy })`, sin `$queryRaw`/`$executeRaw`. Sin
`exec`/`spawn`/`child_process`. Sin input de usuario en paths de archivo. El endpoint no acepta
body ni querystring (confirmado contra el contrato del spec), por lo que no hay superficie de
inyección vía input.

## Autorización (específico de este ticket)
✅ `GET /teams/composition` usa `@Roles(UserRole.PM, UserRole.LEADER, UserRole.RESOURCE)` —
primer uso real de `@Roles` con 3 roles en el código, mecanismo sin cambios (`RolesGuard` ya
soportaba arrays). Verificado con test dedicado: ADMIN autenticado recibe `403`.
✅ Las mutaciones (`POST /teams`, `POST /teams/:teamId/members`) permanecen `@Roles(LEADER)` sin
cambios — RESOURCE/PM no ganan ninguna capacidad de escritura por este ticket (mitigación 3 del
threat model, verificada: `git diff` confirma cero líneas modificadas en esos dos handlers).
✅ `TeamsCompositionPage.tsx` no contiene ningún `<form>`/`<button>` de mutación (verificado por
lectura directa del árbol JSX y por test dedicado que confirma su ausencia) — mitigación 4 del
threat model.

## Information Disclosure (riesgo MEDIO ya analizado en el threat model)
✅ `TeamCompositionMemberDto`/`TeamCompositionResponseDto` exponen únicamente `{id, name}` para
owner/members — nunca `email`/`role`/`passwordHash`/`refreshTokenHash`. Verificado con test que
hace `Object.keys()` sobre el body real de la respuesta, no solo sobre el DTO fuente (cierra el
loop entre "el DTO no lo declara" y "el payload no lo contiene").

## XSS y funciones inseguras (F-SAST-06, F-SAST-04/17)
✅ `TeamsCompositionPage.tsx` renderiza `name`/`description`/nombres de dueño y miembros como
texto plano vía JSX (auto-escapado de React) — sin `dangerouslySetInnerHTML`, sin `innerHTML` en
ningún archivo del ticket. Sin `eval()`/`new Function()`.

## Crypto (F-SAST-08)
N/A — sin cambios de hashing/cifrado. `Team.name`/`description`/`User.name` no son credenciales.

## Logging de datos sensibles (F-SAST-10)
✅ Ningún `console.log`/`Logger` nuevo en `backend/src/teams/` ni en los archivos de frontend
tocados. Los errores (`UnauthorizedException`, `ForbiddenException`) viajan únicamente por el
`HttpExceptionFilter` global existente, sin loguear el payload.

## CSRF (F-SAST-12)
✅ Sin cambios respecto a tickets previos — el nuevo endpoint exige `Authorization: Bearer` (no
depende de la cookie de refresh para autorizar la acción).

## Validación de input (F-SAST-14)
✅ `GET /teams/composition` no acepta input (sin body, sin querystring, sin params) — no aplica
validación de campos. En frontend, `TeamsCompositionPage.tsx` no tiene ningún formulario.

## Manejo de errores (F-SAST-15)
✅ `UnauthorizedException`/`ForbiddenException` son excepciones tipadas capturadas por el
`HttpExceptionFilter` global — ningún catch silencioso, ningún stack trace expuesto.
`listAllTeamsComposition` (frontend) nunca traga un error de API: se relanza vía
`handleResponse`/`extractErrorMessage` y se muestra en pantalla con `role="alert"`.

## Dependencias (F-SAST-13/16)

`npm audit`: backend 10 hallazgos (7 moderate, 3 high), frontend 2 hallazgos (2 moderate) —
idénticos en cantidad y naturaleza a los reportados en `sast-FEAT-003b.md`. Confirmado con `git
diff origin/main -- **/package.json **/package-lock.json`: **0 líneas de diferencia** — este
ticket no agregó ninguna dependencia nueva.

Como el árbol de dependencias no cambió:
- Los hallazgos High del backend (`multer` sin endpoint de upload, deps transitivas de
  `@nestjs/cli` como devDependency) siguen bajo **ADR-001, sin re-evaluación necesaria**.
- Los 2 hallazgos Moderate de `react-router`/`react-router-dom` ya fueron triados en
  `docs/daw/security/sast-FEAT-002.md` y re-confirmados en cada ticket posterior: verificado de
  nuevo para este ticket que `TeamsCompositionPage.tsx`, `ProtectedRoute.tsx` y `App.tsx` no
  agregan ningún `useNavigate`/`<Link>` nuevo (0 coincidencias en los archivos tocados; el único
  `<Navigate>` de `App.tsx`/`ProtectedRoute.tsx` es el redirect estático preexistente a
  `/login`, sin input de usuario) — el análisis de alcanzabilidad de FEAT-002 sigue vigente: el
  proyecto sigue siendo un SPA client-rendered sin SSR.

## Suppressions
0 — mismo criterio que tickets previos: la aceptación de riesgo de dependencias se documenta vía
ADR (ADR-001, sin cambios), no vía el formato de supresión Medium de 7 campos.

---

**Total: 0 hallazgos de código nuevos, 0 hallazgos de dependencias nuevos (árbol sin cambios,
ADR-001 y el triage de react-router de FEAT-002 siguen vigentes)**
**Next:** commit de este reporte, luego transición a VERIFY.
