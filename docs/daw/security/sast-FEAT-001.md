# SAST Report — FEAT-001 (Autenticación y alta de usuarios)

| Field | Value |
|-------|-------|
| Date | 2026-08-05 |
| Ticket | FEAT-001 |
| Scope | Blocks 1-5 (backend/, frontend/) — cierre de CODE |
| Result | **PASSED** (con riesgo aceptado documentado, ver ADR-001) |

## Secrets (F-SAST-01)
✅ `.env` en `.gitignore`, no trackeado. Sin secretos hardcodeados en `backend/src` ni
`frontend/src` (grep amplio; único match: fixtures de test con contraseñas de prueba).

## Injection (F-SAST-02, F-SAST-03, F-SAST-05)
✅ Sin `$queryRaw`/`$executeRaw` (Prisma parametriza todo por defecto). Sin `exec`/`spawn`/
`child_process`. Sin input de usuario en paths de archivo.

## XSS y funciones inseguras (F-SAST-06, F-SAST-04/17)
✅ Sin `innerHTML`/`dangerouslySetInnerHTML` en el frontend. Sin `eval()`/`new Function()`.

## Crypto (F-SAST-08)
✅ `bcrypt` (12 salt rounds) en todo el proyecto — login, alta de usuario, refresh token hash,
seed del Admin. Sin MD5/SHA1/DES.

## Logging de datos sensibles (F-SAST-10)
✅ `Logger` de `AuthService` solo registra `userId` y el resultado del intento — nunca password
ni tokens.

## CSRF (F-SAST-12)
✅ Cookie `refresh_token`: `httpOnly` + `sameSite: 'strict'`. Endpoints protegidos requieren
`Authorization: Bearer` (no solo la cookie), que un origen cruzado no puede fijar.

## Validación de input (F-SAST-14)
✅ `ValidationPipe` global (`whitelist: true`) + DTOs con `class-validator` en cada endpoint.

## Manejo de errores (F-SAST-15)
✅ `HttpExceptionFilter` global: excepciones no tipadas responden `500` genérico al cliente,
stack solo en el log del servidor.

## Dependencias (F-SAST-13/16)

`npm audit`: backend 23 hallazgos (3 low, 13 moderate, 7 high), frontend 7 hallazgos (5 moderate,
1 high, 1 critical). Triage completo de alcanzabilidad por `daw-sec-auditor` (ver ADR-001 para el
detalle): **0 de 8 hallazgos High/Critical son explotables** contra el código tal como está
construido — 6 son `devDependency` de build/test que nunca corren en el proceso de producción ni
se sirven al browser, y los 2 restantes (dependencias de producción reales) tienen la función
vulnerable específica no invocada por este código. `npm audit fix` (sin `--force`) no tuvo cambios
disponibles para ninguno de los 8; resolverlos requeriría majors breaking de Nest/Vite/Vitest,
fuera de alcance de este ticket.

**Actualización (ronda de corrección de cobertura, mismo día):** se agregó `@vitest/coverage-v8`
(devDependency, necesaria para medir cobertura y cerrar `F-VER-03`), que `npm audit` reporta como
un 9º hallazgo Critical sobre la misma cadena `vite`/`vitest` ya cubierta arriba — mismo riesgo
raíz, no uno nuevo. Incluida en el mismo riesgo aceptado de ADR-001.

**Riesgo aceptado documentado en ADR-001**, con condiciones de revisión explícitas y ticket de
seguimiento no bloqueante para actualizar esas dependencias.

## Suppressions
0 (la aceptación de riesgo de los 8 High/Critical se documentó vía ADR, no vía el formato de
supresión Medium de 7 campos — ver ADR-001 para el razonamiento).

---

**Total: 0 hallazgos de código, 8 hallazgos de dependencias con riesgo aceptado documentado**
**Next:** commit de este reporte + ADR-001, luego transición a VERIFY.
