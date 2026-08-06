# SAST Report — FEAT-002 (Alta de clientes)

| Field | Value |
|-------|-------|
| Date | 2026-08-05 |
| Ticket | FEAT-002 |
| Scope | Blocks 1-3 (backend/src/clients, frontend/src/services/clients.service.ts, frontend/src/pages/PMClientsPage.tsx, frontend/src/styles/tokens.css) — cierre de CODE |
| Result | **PASSED** (con riesgo aceptado heredado de ADR-001, sin cambios) |

## Secrets (F-SAST-01)
✅ Sin secretos hardcodeados en ningún archivo nuevo/modificado de este ticket (grep dirigido a
los 16 archivos de los 3 bloques). `.env` sigue en `.gitignore`, sin cambios.

## Injection (F-SAST-02, F-SAST-03, F-SAST-05)
✅ `ClientsService` usa exclusivamente los métodos de Prisma (`findUnique`/`create`/`findMany`),
sin `$queryRaw`/`$executeRaw`, sin concatenación de strings en queries. Sin `exec`/`spawn`/
`child_process`. Sin input de usuario en paths de archivo.

## XSS y funciones inseguras (F-SAST-06, F-SAST-04/17)
✅ `PMClientsPage.tsx` renderiza `name`/`description` como texto plano vía interpolación JSX
(auto-escapado de React) — sin `dangerouslySetInnerHTML`, sin `innerHTML`. Sin `eval()`/
`new Function()` en ningún archivo del ticket.

## Crypto (F-SAST-08)
N/A — este ticket no introduce hashing ni cifrado nuevo (no maneja credenciales; `name`/
`description` son datos de negocio internos, ver clasificación en
`docs/daw/security/threat-FEAT-002.md`).

## Logging de datos sensibles (F-SAST-10)
✅ Ningún `console.log`/`Logger` nuevo en el módulo `clients` (backend) ni en
`PMClientsPage.tsx`/`clients.service.ts` (frontend). Los errores de validación/conflicto viajan
únicamente por las excepciones tipadas → `HttpExceptionFilter` global, sin loguear el payload de
name/description en texto plano en ningún punto adicional.

## CSRF (F-SAST-12)
✅ Sin cambios respecto a FEAT-001 — `POST`/`GET /clients` requieren `Authorization: Bearer`
(no dependen de la cookie `refresh_token` para autorizar la acción), mismo mecanismo ya evaluado.

## Validación de input (F-SAST-14)
✅ `CreateClientDto` con `class-validator` (`@IsString`, `@IsNotEmpty`, `@MaxLength(30|255)`),
validado por el `ValidationPipe` global existente. En frontend, `PMClientsPage.tsx` valida con
`zod` como espejo de UX — nunca reemplaza la validación del servidor.

## Manejo de errores (F-SAST-15)
✅ `ConflictException` (409, nombre duplicado) es una excepción tipada, capturada por el
`HttpExceptionFilter` global existente — ningún catch silencioso, ningún stack trace expuesto al
cliente. `clients.service.ts` (frontend) nunca traga un error de red/API (ver Block 2, 7/7 tests).

## Dependencias (F-SAST-13/16)

`npm audit`: backend 23 hallazgos (3 low, 13 moderate, 7 high), frontend 7 hallazgos (4 moderate,
1 high, 2 critical) — **prácticamente idéntico** al resultado de FEAT-001 (backend igual; frontend
con el mismo set de paquetes). Confirmado con `git diff` en ambos `package.json`/
`package-lock.json`: **sin cambios respecto a FEAT-001** — este ticket no agregó ninguna
dependencia nueva (verificado también por `daw-arch-auditor` en los 3 bloques).

Como el árbol de dependencias no cambió, el triage de alcanzabilidad de **ADR-001 sigue vigente
sin re-evaluación necesaria** para los 8 hallazgos High/Critical ya documentados ahí (cadena
`@nestjs/cli`/`glob`/`picomatch`/`tmp`/`webpack` como devDependency de build; `lodash` sin la
función vulnerable invocada; `multer` sin endpoint de upload; `vite`/`vitest`/
`@vitest/coverage-v8` como devDependency nunca empaquetada en el build de producción).

**Verificación adicional de este ticket** sobre los hallazgos Moderate de `react-router`/
`react-router-dom` (open redirect vía backslash en `<Link>`/`useNavigate`; inyección de
constructor en hidratación SSR): se revisó todo uso de `useNavigate`/`<Link>`/`<Navigate>` en
`frontend/src` (incluido el nuevo `PMClientsPage.tsx`) — **ningún destino de navegación depende de
input de usuario o de la URL**, todos son strings literales (`/login`). Este proyecto no usa SSR
(`renderToString`/`hydrateRoot`/`StaticRouter` ausentes — es un SPA client-rendered vía
`createRoot`), por lo que la CVE de hidratación SSR no aplica estructuralmente. Ninguno de los dos
CVEs es alcanzable en este código.

## Suppressions
0 — mismo criterio que FEAT-001: la aceptación de riesgo de dependencias se documenta vía ADR
(ADR-001, sin cambios), no vía el formato de supresión Medium de 7 campos.

---

**Total: 0 hallazgos de código nuevos, 0 hallazgos de dependencias nuevos (árbol sin cambios,
ADR-001 sigue vigente)**
**Next:** commit de este reporte, luego transición a VERIFY.
