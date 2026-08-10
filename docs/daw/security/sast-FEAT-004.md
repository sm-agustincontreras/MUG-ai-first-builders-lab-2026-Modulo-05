# SAST Report FEAT-004: Home diferenciado por rol con navegación

| Field | Value |
|-------|-------|
| Ticket | FEAT-004 |
| Date | 2026-08-10 |
| Scope | Cierre de CODE — archivos tocados por Block 1 + Block 2 |

## Archivos escaneados

`frontend/src/components/AppHeader.tsx`, `AppHeader.css`, `AppHeader.spec.tsx`,
`frontend/src/pages/HomePage.tsx`, `HomePage.css`, `HomePage.spec.tsx`,
`frontend/src/components/ProtectedRoute.tsx`, `frontend/src/services/auth.service.ts`,
`frontend/src/App.tsx`, `frontend/src/pages/AdminCreateUserPage.tsx`, y los specs existentes
ajustados (`App.spec.tsx`, `ProtectedRoute.spec.tsx`, `use-auth.spec.ts`, `LoginPage.spec.tsx`).
Sin cambios en `backend/`.

## Secrets (F-SAST-01)
✅ Sin patrones de API key/password/token/connection string en el diff (`git diff` de los
commits `bb9cb7f..fa8f040` escaneado explícitamente). `.env` sigue en `.gitignore` (sin cambios).

## Inyección (F-SAST-02/03/05)
✅ N/A — sin queries nuevas, sin `exec`/`spawn`, sin paths construidos con input de usuario. El
ticket no toca `backend/` ni Prisma.

## XSS y funciones inseguras (F-SAST-06, F-SAST-04/17)
✅ Sin `dangerouslySetInnerHTML`, sin `innerHTML`, sin `eval()`/`new Function()` en ningún
archivo tocado (verificado con grep dirigido). `user.name`/`user.role` se renderizan como texto
plano vía JSX (auto-escapado de React), igual que el resto del proyecto.

## Crypto (F-SAST-08)
N/A — sin cambios de hashing/cifrado ni de manejo de credenciales.

## Logging de datos sensibles (F-SAST-10)
✅ Ningún `console.log`/logging nuevo en ningún archivo del ticket (verificado con grep).

## CSRF (F-SAST-12)
✅ Sin cambios — el ticket no agrega ninguna operación de escritura nueva (todo el cambio es
navegación y renderizado; el único efecto de mutación, `logout()`, ya existía desde FEAT-001 y
solo cambia de dónde se dispara en la UI).

## Validación de input (F-SAST-14)
N/A — este ticket no agrega ningún formulario ni campo de input nuevo.

## Manejo de errores (F-SAST-15)
✅ `AppHeader`/`HomePage` no introducen ningún `catch` nuevo. El manejo de fallo de `logout()`
sigue centralizado en `useAuth().logout()` (`hooks/use-auth.ts`, sin cambios), que ya limpia el
estado local en un `finally` sin exponer detalles internos.

## Dependencias (F-SAST-13/16)

`git diff origin/main -- '**/package.json' '**/package-lock.json'`: **0 líneas de diferencia** —
este ticket no agrega ninguna dependencia nueva.

`npm audit`:
- Backend: 23 hallazgos (7 high, 13 moderate, 3 low, 0 critical)
- Frontend: 7 hallazgos (2 critical, 1 high, 4 moderate, 0 low)

El conteo es mayor al de `sast-FEAT-003c.md` (backend 10, frontend 2) porque el árbol de
dependencias no cambió pero la base de advisories de npm sí — se publicaron CVEs nuevos sobre las
**mismas** dependencias ya analizadas en ADR-001, no sobre dependencias nuevas:

- **Backend, High** (`@nestjs/cli`, `@nestjs/platform-express`, y las transitivas `glob`,
  `picomatch`, `tmp`, `lodash`, `multer`): mismo árbol que ADR-001 — verificado de nuevo que
  `@nestjs/cli` y sus transitivas son exclusivamente `devDependency` (nunca corren en
  `start:prod`); que ningún archivo de `backend/src/**` usa `FileInterceptor`/`MulterModule`
  (0 coincidencias, grep repetido); y que el único uso de `lodash` indirecto (`@nestjs/config`)
  es `configService.get<string>('JWT_ACCESS_SECRET' | 'JWT_REFRESH_SECRET')` con claves literales
  hardcodeadas, nunca `_.template`/`_.unset`/`_.omit` (las funciones de los CVEs nuevos) ni un
  path derivado de un request. **Sigue bajo ADR-001, sin re-evaluación necesaria.**
- **Frontend, `vite` (High) y `vitest`/`@vitest/coverage-v8` (Critical)**: mismas dependencias
  `devDependency` de ADR-001 (bundler y test runner), con CVEs adicionales publicados desde
  entonces (RCE de Vitest vía API server, path traversal de Vite en optimized deps). El análisis
  de alcanzabilidad de ADR-001 sigue vigente sin cambios: ninguno de los dos corre en el bundle de
  producción (`frontend/dist/`) ni en un proceso expuesto fuera del entorno de desarrollo/CI de
  este repo.
- Los hallazgos Moderate de `react-router`/`react-router-dom` (ya triados en
  `sast-FEAT-002.md` y reconfirmados en cada ticket posterior) se re-verifican para este ticket:
  `AppHeader.tsx` agrega `<Link>`/`<NavLink>` nuevos, pero ninguno con `to` derivado de input de
  usuario — los destinos son las 5 rutas estáticas ya declaradas en `App.tsx`. El análisis de
  alcanzabilidad de FEAT-002 (SPA client-rendered, sin SSR) sigue vigente.

## Suppressions
0 — mismo criterio que tickets previos: la aceptación de riesgo de dependencias ya analizadas se
documenta vía ADR (ADR-001, sin cambios), no vía el formato de supresión Medium de 7 campos. No
hay ningún hallazgo Medium nuevo de código en este ticket que requiera supresión.

---

**Total: 0 hallazgos de código nuevos, 0 dependencias nuevas (árbol sin cambios; los CVEs
adicionales reportados por `npm audit` son advisories nuevos sobre las mismas dependencias que
ADR-001 y el triage de react-router de FEAT-002 ya cubren, con el mismo análisis de
alcanzabilidad vigente)**
**Next:** commit de este reporte, luego transición a VERIFY.
