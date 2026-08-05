# Threat Model FEAT-001: Autenticación y alta de usuarios

| Field | Value |
|-------|-------|
| Ticket | FEAT-001 |
| Date | 2026-08-05 |
| Spec de referencia | docs/daw/specs/spec-FEAT-001.md (a escribir tras este análisis) |

## Componentes y superficies de ataque

| Componente | Endpoint/flujo | Superficie |
|---|---|---|
| `AuthController` | `POST /auth/login` | Input de usuario (email/password) — inyección, fuerza bruta, enumeración de usuarios |
| `AuthController` | `POST /auth/refresh` | Cookie httpOnly de refresh token — CSRF, robo/replay de token |
| `AuthController` | `POST /auth/logout` | Requiere access token válido — bypass de autenticación |
| `UsersController` | `POST /users` | Input de usuario (email/password/rol) — inyección, escalada de privilegios (asignación de rol), fuerza bruta de creación |
| `PrismaService` | Toda query a `User` | Inyección SQL/NoSQL (mitigado por el ORM — ver Tampering) |
| `HttpExceptionFilter` | Toda respuesta de error | Fuga de información en mensajes de error/stack traces |
| `prisma/seed.ts` | Ejecución de seed | Credenciales del Admin inicial vía variables de entorno |
| Frontend `auth.service.ts`/`users.service.ts` | Toda llamada a la API | Token en memoria vs almacenamiento persistente (XSS) |

## Límites de confianza (trust boundaries)

1. **Navegador (no confiable) ↔ API NestJS**: todo input se valida server-side con `class-validator` (`ValidationPipe({transform:true, whitelist:true})`), nunca se confía en la validación de `zod` del frontend.
2. **JS del frontend ↔ cookie httpOnly de refresh token**: el JS de la propia app (o inyectado vía XSS) no puede leer el refresh token — vive solo en la cookie `httpOnly`.
3. **Backend ↔ PostgreSQL**: todo acceso pasa por Prisma (queries parametrizadas), nunca SQL crudo.
4. **Proceso backend ↔ variables de entorno**: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `DATABASE_URL` — nunca hardcodeados, nunca en el repo (`.env` en `.gitignore`, `.env.example` sin valores reales).
5. **Rol declarado en el JWT ↔ rol real en DB**: el JWT lleva el rol al momento del login; un cambio de rol posterior no se refleja hasta que expira el access token (máx. 15 min) — ver riesgo de Elevación de Privilegios.

## Datos sensibles (clasificación)

| Dato | Clasificación | Cifrado |
|---|---|---|
| `passwordHash` | Credencial | Hasheado con bcrypt (nunca texto plano) en reposo; nunca viaja en tránsito salvo el password plano en el login inicial, sobre TLS |
| `refreshTokenHash` | Credencial de sesión | Hasheado en DB (igual que passwordHash); el token en texto plano solo existe en la cookie httpOnly del cliente |
| Access/refresh JWT | Credencial de sesión | Firmados (HMAC) con secretos de entorno; transmitidos sobre TLS en producción |
| `email` | PII (dato personal identificable, bajo) | No cifrado en reposo (es también identificador de negocio); tránsito sobre TLS |
| `ADMIN_EMAIL`/`ADMIN_PASSWORD` (seed) | Credencial | Solo en variables de entorno del entorno de despliegue, nunca en el repo |

## Análisis STRIDE

### `POST /auth/login`
| Categoría | Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|---|
| Spoofing | Credential stuffing / fuerza bruta contra el login | Media | Alto | 🟠 Rate limiting con `@nestjs/throttler` (ej. 5 intentos/min por IP) sobre `/auth/login` |
| Spoofing | Enumeración de usuarios vía mensaje de error distinto para "email no existe" vs "password incorrecta" | Media | Medio | 🟡 Mensaje de error genérico (ya cubierto por AC-02); comparar contra un hash dummy con bcrypt cuando el email no existe, para que el tiempo de respuesta no delate la diferencia |
| Repudiation | No queda registro de intentos de login fallidos/exitosos | Media | Bajo | 🟡 Logging estructurado con el `Logger` de NestJS (no persistido en DB) en `auth.service.ts` para cada intento de login (éxito/fallo, sin loguear la contraseña) |
| Tampering | Inyección SQL vía email/password | Baja | Alto | 🟠 Prisma parametriza todas las queries; `class-validator` valida tipo/formato del email antes de llegar al service |
| Information Disclosure | Filtración de `passwordHash` en la respuesta | Baja | Alto | 🟠 `user-response.dto.ts` excluye explícitamente `passwordHash`/`refreshTokenHash` de toda respuesta |
| Denial of Service | Saturación del endpoint de login | Media | Medio | 🟡 Mismo rate limiting que Spoofing |

### `POST /auth/refresh`
| Categoría | Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|---|
| Spoofing/Tampering | CSRF: un sitio malicioso induce al navegador a hacer `POST /auth/refresh` usando la cookie httpOnly de la víctima | Media | Alto | 🟠 Cookie de refresh con `SameSite=Strict`, `Secure` (en producción) y `httpOnly`; CORS restringido a un origin explícito (no `*`) con `credentials:true` — entre ambos, un origen cruzado no puede ni leer la respuesta ni, con `SameSite=Strict`, adjuntar la cookie |
| Information Disclosure | Robo del refresh token vía XSS | Baja (mitigado por httpOnly) | Alto | 🟠 `httpOnly` impide lectura por JS; además CSP básica en las respuestas del frontend (fuera del alcance de este ticket, pero recomendado para v2) |
| Elevation of Privilege | Reuso de un refresh token robado tras haber sido rotado | Baja | Medio | 🟠 Rotación en cada `/auth/refresh`: se emite un refresh token nuevo y se invalida el anterior (se sobrescribe `refreshTokenHash`). Si el token presentado es válido por firma/expiración pero NO coincide con el `refreshTokenHash` almacenado (indicio de que es un token ya rotado, reusado), se trata como señal de robo: se invalida la sesión completa (`refreshTokenHash = null`) y se exige re-login |

### `POST /auth/logout`
| Categoría | Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|---|
| Spoofing | CSRF sobre logout | Baja | Bajo | 🟢 Requiere `Authorization: Bearer <access token>` (no solo la cookie) — un origen cruzado no puede fijar ese header sin CORS explícito, así que no puede forzar un logout ajeno |
| Repudiation | No queda registro de quién cerró sesión ni cuándo | Media | Bajo | 🟡 Logging estructurado con el `Logger` de NestJS (no persistido en DB, no es un RF de auditoría — solo trazabilidad operativa) en `auth.service.ts` para logout |

### `POST /users` (alta de usuario por Admin)
| Categoría | Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|---|
| Elevation of Privilege | Un usuario no-Admin crea una cuenta (incl. una cuenta Admin) | Baja | Crítico | 🔴 `RolesGuard` + `@Roles('ADMIN')` en `common/guards`, verificado en el JWT en cada request (no solo en middleware de auth) — cubre AC-05 |
| Tampering | Alta de un usuario con un rol inválido no contemplado (`role` fuera del enum) | Baja | Medio | 🟡 `class-validator` con `@IsEnum(UserRole)` en `create-user.dto.ts` rechaza cualquier valor fuera del enum |
| Information Disclosure | Filtración del `passwordHash` inicial en la respuesta de creación | Baja | Alto | 🟠 Mismo `user-response.dto.ts` que en login |
| Repudiation | Email duplicado explota una condición de carrera (dos altas simultáneas con el mismo email) | Baja | Bajo | 🟢 Constraint `@unique` en `email` a nivel de Prisma schema/DB — la DB rechaza el duplicado aunque la validación de aplicación tenga una carrera |

### `prisma/seed.ts` (bootstrap del Admin inicial)
| Categoría | Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|---|
| Spoofing | Credenciales del Admin inicial predecibles o hardcodeadas | Media | Crítico | 🔴 `ADMIN_EMAIL`/`ADMIN_PASSWORD` exclusivamente desde variables de entorno, sin valor por defecto en código (ya definido en FR-06/NFR-01 del PRD); `.env.example` documenta las claves sin valores reales |
| Tampering | El seed se ejecuta más de una vez y sobrescribe o duplica el Admin | Baja | Medio | 🟡 El seed verifica si ya existe un Admin antes de crear uno (AC-09) — idempotente |

## Riesgos aceptados

Ninguno. Los dos riesgos evaluados inicialmente como candidatos a aceptar (reuso de refresh token
robado, ausencia de logging de login/logout) fueron mitigados a pedido del usuario — ver las
mitigaciones correspondientes en las tablas STRIDE de `/auth/refresh` y `/auth/login`/`/auth/logout`
arriba.

## Mitigaciones a incorporar en el spec

1. `@nestjs/throttler` sobre `POST /auth/login` (y opcionalmente `/auth/refresh`) — rate limiting contra fuerza bruta y DoS. **Nueva dependencia**, justificada por este análisis.
2. Comparación contra un hash bcrypt dummy cuando el email no existe, para evitar enumeración de usuarios por tiempo de respuesta.
3. Cookie de refresh token: `httpOnly`, `Secure` (condicionado a `NODE_ENV=production`, ya que en desarrollo local con docker-compose no hay TLS), `SameSite=Strict`.
4. CORS con origin explícito (la URL del frontend, no `*`) y `credentials:true`.
5. `@Unique` en `email` a nivel de schema de Prisma (constraint de base de datos, no solo validación de aplicación).
6. `@IsEnum(UserRole)` en `create-user.dto.ts`.
7. `RolesGuard`/`roles.decorator.ts` en `backend/src/common/` (no en `users/`), aplicado también sobre cualquier endpoint futuro que lo necesite.
8. `user-response.dto.ts` aplicado a toda respuesta que incluya un `User` (login, refresh, creación de usuario).
9. Rotación de refresh token con detección de reuso en cada `POST /auth/refresh`: se emite y almacena
   (hasheado) un nuevo refresh token en cada llamada; si el token presentado no coincide con el
   `refreshTokenHash` almacenado, se invalida la sesión completa.
10. Logging estructurado (`Logger` de NestJS, sin persistir en DB) de: intentos de login
    exitosos/fallidos y de logout, en `auth.service.ts` — nunca se loguea la contraseña ni los
    tokens.

---

┌─────────────────────────────────────────────────────────┐
│  /daw-threat-modeling — PASSED                            │
├─────────────────────────────────────────────────────────┤
│  Attack surfaces identified: 8                             │
│  Trust boundaries declared: 5                              │
│                                                            │
│  Risks:                                                    │
│    🔴 CRITICAL: usuario no-Admin crea cuentas — Mitigation: │
│       RolesGuard en common/, verificado por request         │
│    🔴 CRITICAL: credenciales de Admin seed predecibles —    │
│       Mitigation: exclusivamente por variables de entorno   │
│    🟠 HIGH: fuerza bruta/credential stuffing en login —      │
│       Mitigation: @nestjs/throttler                          │
│    🟠 HIGH: CSRF sobre /auth/refresh — Mitigation: cookie     │
│       SameSite=Strict + Secure + CORS con origin explícito   │
│    🟠 HIGH: fuga de passwordHash/refreshTokenHash —           │
│       Mitigation: user-response.dto.ts                        │
│    🟡 MEDIUM: 5 (ver tablas STRIDE arriba)                    │
│    🟢 LOW: 1 (ver tablas STRIDE arriba)                        │
│                                                                │
│  Riesgos aceptados: 0 (ambos candidatos fueron mitigados        │
│  a pedido del usuario)                                          │
│                                                                │
│  Mitigations to fold into the spec: 10 (ver sección arriba)     │
│                                                                │
│  ─────────────────────────────────────────────────────────    │
│  Risks: C:2 H:2 M:5 L:1                                        │
│  Report: docs/daw/security/threat-FEAT-001.md                  │
└─────────────────────────────────────────────────────────────┘
