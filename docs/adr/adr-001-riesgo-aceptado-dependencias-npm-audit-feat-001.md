# ADR-001: Riesgo aceptado — hallazgos High/Critical de npm audit en el cierre de CODE de FEAT-001

| Field | Value |
|-------|-------|
| Date | 2026-08-05 |
| Ticket | FEAT-001 |
| Status | Accepted |

## Context

El gate SAST del cierre de CODE (`/daw-security-sast`) reportó 8 hallazgos High/Critical vía
`npm audit` en `backend/` y `frontend/`. El catálogo del proyecto (F-SAST-13) clasifica todo CVE
High/Critical en una dependencia como bloqueante y no suprimible por defecto. El resto del scan
(secretos, inyección, XSS, crypto, logging, CSRF, validación de input, manejo de errores) dio
limpio en las dos capas.

Se despachó `daw-sec-auditor` para triar alcanzabilidad real, no solo presencia del CVE. Hallazgos:

- **Backend, 6 de 7 High** (`glob`, `picomatch`, `tmp`, y el agregado `@nestjs/cli`/`webpack`):
  toda la cadena cuelga de `@nestjs/cli` → `@angular-devkit/*`, exclusivamente `devDependency`.
  `start:prod` es `node dist/main`; el CLI nunca se instala ni corre en el proceso de producción.
- **Backend, `lodash`** (High, vía `@nestjs/config`, dependencia de producción real): el código
  fuente de `@nestjs/config` (`config.service.js`) solo importa `lodash/get|has|set`, nunca
  `lodash/template` (la función del CVE). Todo `configService.get(...)` en este proyecto usa
  claves literales hardcodeadas (`'JWT_ACCESS_SECRET'`, etc.), nunca un path derivado de un
  request HTTP.
- **Backend, `multer`** (High, vía `@nestjs/platform-express`, dependencia de producción real):
  no existe en `backend/src/**` ningún `FileInterceptor`/`MulterModule`/endpoint de upload —
  confirmado por grep. El parser vulnerable de multer no se activa nunca en este código.
- **Frontend, `vite` (High) y `vitest` (Critical)**: ambos `devDependency`. El bundle de
  `vite build` (`frontend/dist/`) no referencia vite/esbuild en runtime del browser (confirmado
  por grep sobre el output). `vitest` solo se vuelve vulnerable con el flag `--ui`, que ningún
  script del proyecto usa.

`npm audit fix` (sin `--force`) no aplicó ningún cambio en ninguno de los dos proyectos — no hay
un fix sin breaking change disponible para estos 8 hallazgos. Resolverlos requiere saltos de
versión mayor: `@nestjs/cli`/`@nestjs/platform-express`/`@nestjs/core` de v10 a v11, y `vite`/
`vitest` a sus majors siguientes.

**Actualización (misma fecha, ronda de corrección de cobertura en VERIFY):** se agregó
`@vitest/coverage-v8` como devDependency (necesaria para medir cobertura y cerrar el gate
`F-VER-03`). `npm audit` la reporta como un 9º hallazgo Critical, agregado sobre la misma cadena
`vite`/`esbuild`/`vitest` ya analizada arriba — no es una vulnerabilidad nueva ni distinta, es el
mismo riesgo raíz visto desde un paquete más. Aplica el mismo razonamiento: `devDependency` que
solo corre al ejecutar `npm run test:cov` localmente/en CI, nunca se empaqueta en `vite build` ni
se sirve al browser. Se incluye en el mismo riesgo aceptado, sin necesidad de una decisión
separada.

## Options considered

### Option 1: Bloquear el gate y forzar la actualización ahora
- **Pros:** cumple la letra literal de F-SAST-13 sin excepción; cero dependencias con CVE
  conocido en el árbol.
- **Cons:** exige migrar Nest 10→11 y Vite/Vitest a sus majors dentro de un ticket de alta de
  usuarios — alcance no relacionado, esfuerzo alto, riesgo real de romper la app (breaking
  changes documentados por el propio `npm audit`), y sin ganancia de seguridad real medible hoy
  (0/8 hallazgos son alcanzables contra el código actual).

### Option 2: Documentar como riesgo aceptado (este ADR) + ticket de seguimiento
- **Pros:** evidencia de alcanzabilidad real (no solo severidad declarada) respalda que el riesgo
  actual es despreciable; desbloquea el feature sin tocar el framework a mitad de un ticket no
  relacionado; dejar un ticket de seguimiento evita que la actualización se pierda.
- **Cons:** el árbol de dependencias sigue conteniendo CVEs conocidos; si el contexto cambia
  (se agrega un endpoint de upload, se activa `vitest --ui`, se cambia `start:prod`), el riesgo
  aceptado deja de ser válido y hay que re-evaluar.

## Decision

Se elige la **Opción 2**. Confirmado con el usuario. El riesgo se acepta explícitamente porque
la alcanzabilidad real es 0/8, no porque se ignore la política de severidad — la política asume
que "CVE presente" implica "explotable", y el triage de `daw-sec-auditor` mostró que ninguno de
los 8 lo es en el código tal como está construido hoy.

## Consequences

- El gate SAST de FEAT-001 se marca `PASSED` sobre esta base documentada, no sobre "cero CVEs".
- Ningún archivo de código cambia por esta decisión.
- **Condiciones de revisión** (invalidan este riesgo aceptado si se cumplen): se agrega un
  endpoint de upload de archivos (reactiva `multer`), se agrega `--ui` a algún script de vitest,
  se cambia `start:prod` para invocar `@nestjs/cli` en producción, o se modifica cómo
  `ConfigService` resuelve claves (deja de ser literales hardcodeadas).
- **Seguimiento:** crear un ticket dedicado (fuera de FEAT-001) para actualizar
  `@nestjs/cli`/`@nestjs/platform-express`/`@nestjs/core` a v11 y `vite`/`vitest` a sus majors
  siguientes, con su propia verificación de regresión.
- Esta aceptación debe re-evaluarse la próxima vez que corra `/daw-security-sast` sobre este árbol
  de dependencias si aparecen nuevos hallazgos o pasan más de 6 meses (mismo criterio que F-SAST-19
  aplica a supresiones Medium, aplicado aquí por consistencia aunque el catálogo no lo exija
  literalmente para High/Critical).
