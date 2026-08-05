# Spec FEAT-001: Autenticación y alta de usuarios

| Field | Value |
|-------|-------|
| Ticket | FEAT-001 |
| PRD | docs/daw/prd/prd-FEAT-001.md |
| Tier | FEATURE |
| Date | 2026-08-05 |
| Spec loops | 0 |

## Summary

Backend NestJS con Prisma/PostgreSQL: login con JWT (access token de 15 min + refresh token de 7
días entregado como cookie httpOnly), guard de autenticación, alta de usuarios restringida a Admin
vía `RolesGuard`, logout con invalidación y rotación de refresh token con detección de reuso, y un
seed idempotente para el Admin inicial. Frontend React+Vite con una capa `services` que consume la
API (nunca la UI directamente), páginas de login y alta de usuario, y un hook `useAuth` que guarda
el access token en memoria. Cinco bloques: (1) scaffold + base de datos, (2) auth core, (3) alta de
usuarios, (4) logout + seed, (5) frontend.

## Coverage: PRD → blocks

| Requirement | Covered by |
|---|---|
| FR-01 | Block 2 |
| FR-02 | Block 2 |
| FR-03 | Block 3 |
| FR-04 | Block 3 |
| FR-05 | Block 4 |
| FR-06 | Block 4 |
| FR-07 | Block 3 |
| NFR-01 | Strategy: bcrypt (12 salt rounds) para `passwordHash`, implementado en Block 2 (login) y Block 3 (alta de usuario) |
| NFR-02 | Strategy: `JwtModule` configurado con `expiresIn: '15m'` (access) y `'7d'` (refresh) en Block 2, vía variables de entorno |
| NFR-03 | Strategy: `UserRole` enum (Prisma, Block 1) expuesto en el JWT payload y en `user-response.dto.ts`, consumido por `RolesGuard` (Block 3) — reutilizable por features futuras |
| NFR-04 | Strategy: `HttpExceptionFilter` global (Block 1) + excepciones tipadas (`UnauthorizedException`, `ForbiddenException`, `ConflictException`) con mensaje explícito en cada guard/service (Blocks 2-4) |
| NFR-05 | Strategy: todas las acciones (login, logout, alta de usuario) se exponen exclusivamente vía las páginas del frontend (Block 5), que consumen la API a través de la capa `services` — no se requiere ni se documenta acceso directo a la API para uso normal |

## Dependencies between blocks

- Block 1 no depende de ningún otro — es el scaffold sobre el que corren los demás.
- Block 2 depende de Block 1 (`PrismaService`, `HttpExceptionFilter`, `User`/`UserRole`).
- Block 3 depende de Block 1 y Block 2 (usa `JwtAuthGuard` de Block 2 para proteger `POST /users`, y
  `PrismaService` de Block 1).
- Block 4 depende de Block 2 (reutiliza `AuthService`/`AuthController` para agregar logout) y de
  Block 1 (el seed usa `PrismaService` y el schema).
- Block 5 depende de Block 2, 3 y 4 — consume los endpoints `/auth/login`, `/auth/refresh`,
  `/auth/logout` y `/users` ya implementados.
- Orden de ejecución: 1 → 2 → 3 → 4 → 5.

---

## Block 1 — Scaffold del proyecto y base de datos

**Files**
- `backend/package.json` (new) — proyecto NestJS, deps: `@nestjs/core`, `@nestjs/common`,
  `@nestjs/platform-express`, `@prisma/client`, `class-validator`, `class-transformer`
- `backend/tsconfig.json` (new)
- `backend/nest-cli.json` (new)
- `backend/src/main.ts` (new) — bootstrap, `ValidationPipe({transform:true, whitelist:true})`,
  `app.useGlobalFilters(new HttpExceptionFilter())`, `app.use(cookieParser())`,
  `app.enableCors({ origin: process.env.FRONTEND_URL, credentials: true })`
- `backend/src/app.module.ts` (new) — importa `PrismaModule` (los módulos de auth/users se agregan
  en Blocks 2 y 3)
- `backend/src/prisma/prisma.service.ts` (new) — extiende `PrismaClient`, implementa
  `OnModuleInit`/`OnModuleDestroy`
- `backend/src/prisma/prisma.module.ts` (new) — `@Global()`, exporta `PrismaService`
- `backend/src/common/filters/http-exception.filter.ts` (new) — `@Catch(HttpException)`, formatea
  `{ statusCode, message, error }`, nunca expone stack traces
- `backend/prisma/schema.prisma` (new) — modelo `User` y enum `UserRole`
- `backend/prisma/migrations/` (new) — migración inicial generada por `prisma migrate dev`
- `backend/.env.example` (new) — `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`,
  `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `FRONTEND_URL` (sin valores reales)
- `docker-compose.yml` (new, raíz del repo) — servicio `postgres` (imagen `postgres:16`, puerto
  5432, volumen persistente)
- `.gitignore` (modified) — agrega `node_modules/`, `dist/`, `.env`, `backend/generated/`

**Logic**
Scaffold estándar de NestJS con Prisma. `PrismaModule` es `@Global()` para que cualquier módulo de
dominio (auth, users, y los que vengan después) pueda inyectar `PrismaService` sin reimportarlo.
`HttpExceptionFilter` es el único punto donde se formatean errores HTTP — ningún controller/service
atrapa excepciones silenciosamente (convención de `AGENTS.md`).

**Data model**

`User`:
| Field | Type | Constraints |
|---|---|---|
| id | String (cuid) | PK, default `cuid()` |
| email | String | unique, not null |
| passwordHash | String | not null |
| role | UserRole | not null |
| refreshTokenHash | String? | nullable |
| createdAt | DateTime | default `now()` |

`UserRole` (enum): `ADMIN`, `PM`, `LEADER`, `RESOURCE`.

Índice: `@@unique([email])` (ya implícito por `unique`, se declara explícito en el schema).

**Input validation**
N/A — este bloque no expone endpoints.

**Error handling**
- `HttpExceptionFilter` captura toda `HttpException` (y subclases) lanzada por cualquier
  controller y responde `{ statusCode, message, error }`. Cualquier excepción no controlada (500)
  se responde con un mensaje genérico, sin stack trace, y se loguea server-side con `Logger`.

**Required tests**
- [ ] `PrismaService` se conecta e inicializa correctamente contra la base de datos de test
      (docker-compose) — smoke test de arranque de la app
- [ ] `HttpExceptionFilter` transforma una `HttpException` lanzada desde un controller de prueba en
      el formato `{ statusCode, message, error }` esperado
- [ ] La app arranca con `ValidationPipe` activo: un DTO de prueba con un campo inválido es
      rechazado con 400 antes de llegar al controller
- [ ] Una excepción no controlada (no `HttpException`) lanzada desde un controller de prueba es
      capturada por `HttpExceptionFilter` y responde 500 con un mensaje genérico, sin stack trace

**Completion criterion**
`npm run start:dev` levanta la app contra el Postgres de `docker-compose` sin errores, `prisma
migrate dev` aplica la migración inicial, y los 4 tests de este bloque pasan.

---

## Block 2 — Auth core

**Files**
- `backend/src/auth/auth.module.ts` (new) — importa `JwtModule.registerAsync` (secretos desde env),
  `PassportModule`, `ThrottlerModule.forRoot(...)`
- `backend/src/auth/auth.controller.ts` (new) — `POST /auth/login`, `POST /auth/refresh`
- `backend/src/auth/auth.service.ts` (new)
- `backend/src/auth/dto/login.dto.ts` (new) — `email` (`@IsEmail`), `password` (`@IsString`,
  `@MinLength(8)`)
- `backend/src/users/dto/user-response.dto.ts` (new, se reutiliza desde Block 3) — `id`, `email`,
  `role`, `createdAt` (excluye `passwordHash`/`refreshTokenHash`)
- `backend/src/auth/strategies/jwt.strategy.ts` (new) — valida el access token (header
  `Authorization: Bearer`)
- `backend/src/auth/strategies/jwt-refresh.strategy.ts` (new) — valida el refresh token (cookie
  `refresh_token`)
- `backend/src/auth/guards/jwt-auth.guard.ts` (new) — `AuthGuard('jwt')`
- `backend/src/auth/guards/jwt-refresh.guard.ts` (new) — `AuthGuard('jwt-refresh')`
- `backend/src/app.module.ts` (modified) — importa `AuthModule`
- `backend/package.json` (modified) — deps: `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt`,
  `bcrypt`, `cookie-parser`, `@nestjs/throttler`

**Justificación de nuevas dependencias** *(AGENTS.md exige justificar cada librería nueva)*:
- `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt`: implementación estándar e idiomática de NestJS
  para JWT (FR-01, FR-02); no hay nada equivalente ya en el stack.
- `bcrypt`: hashing de contraseñas y de refresh tokens (NFR-01); no hay alternativa en el stack.
- `cookie-parser`: el refresh token viaja en una cookie httpOnly (mitigación de robo vía XSS
  definida en `docs/daw/security/threat-FEAT-001.md`); Express/Nest necesitan este middleware para
  leerla.
- `@nestjs/throttler`: mitigación de fuerza bruta/credential stuffing sobre `/auth/login` y
  `/auth/refresh`, identificada como riesgo HIGH en el threat model. Paquete oficial de NestJS.

**Logic**
- `POST /auth/login`: `AuthService.login` busca el `User` por email vía `PrismaService`. Si no
  existe, compara la contraseña recibida contra un hash bcrypt dummy fijo (mitigación de
  enumeración de usuarios por timing) y responde 401. Si existe, `bcrypt.compare` contra
  `passwordHash`; si no coincide, 401 con el mismo mensaje genérico (AC-02). Si coincide: genera
  access token (JWT, payload `{ sub, email, role }`, 15 min) y refresh token (JWT, payload
  `{ sub }`, 7 días); guarda `bcrypt.hash(refreshToken)` en `refreshTokenHash`; setea el refresh
  token como cookie `httpOnly`, `sameSite: 'strict'`, `secure: process.env.NODE_ENV === 'production'`;
  responde `{ accessToken, user: UserResponseDto }`. Loguea (`Logger`) el intento (éxito/fallo, sin
  loguear la contraseña).
- `POST /auth/refresh`: protegido por `JwtRefreshGuard`, que valida la firma/expiración del refresh
  token de la cookie y decodifica `sub`. `AuthService.refresh` busca el `User`, compara (bcrypt) el
  token presentado contra `refreshTokenHash`. Si coincide: rota — genera un nuevo refresh token,
  actualiza `refreshTokenHash`, setea la nueva cookie, responde nuevo `accessToken`. Si NO coincide
  (token válido por firma pero ya rotado — indicio de reuso/robo): invalida la sesión
  (`refreshTokenHash = null`) y responde 401, forzando re-login.
- `JwtAuthGuard` se usa en cualquier endpoint protegido (aplicado en Blocks 3 y 4); si no hay
  `Authorization: Bearer <token>` válido, Passport responde 401 antes de llegar al controller
  (FR-02/AC-03).
- `ThrottlerModule` limita `/auth/login` y `/auth/refresh` a 5 intentos/minuto por IP.

**API contract**

`POST /auth/login`
- Request body: `{ email: string, password: string }`
- Response 200: `{ accessToken: string, user: { id, email, role, createdAt } }` + cookie
  `refresh_token` (httpOnly)
- Errores: `401 Unauthorized` (credenciales inválidas, mensaje genérico) · `400 Bad Request`
  (validación de DTO) · `429 Too Many Requests` (throttling)
- Auth: pública (no requiere token previo)

`POST /auth/refresh`
- Request: sin body, requiere cookie `refresh_token`
- Response 200: `{ accessToken: string }` + nueva cookie `refresh_token`
- Errores: `401 Unauthorized` (cookie ausente, token inválido/expirado, o reuso detectado) · `429
  Too Many Requests`
- Auth: cookie de refresh token (no `Authorization` header, porque el access token ya expiró)

**Data model**
Sin cambios de schema en este bloque (usa el `User` de Block 1).

**Input validation**
- `login.dto.ts`: `email` formato válido (`@IsEmail`), `password` string no vacío, mínimo 8
  caracteres (`@MinLength(8)`). Cualquier campo extra es rechazado (`whitelist:true` global).

**Error handling**
- Credenciales inválidas (email inexistente o password incorrecta) → `401 UnauthorizedException`,
  mensaje genérico "Credenciales inválidas" (AC-02).
- Sin access token válido en un endpoint protegido → `401 UnauthorizedException`, mensaje "No
  autenticado" (AC-03).
- Refresh token ausente, inválido, expirado, o reusado tras rotación → `401
  UnauthorizedException`, mensaje "Sesión expirada, iniciá sesión nuevamente".
- DTO inválido → `400 BadRequestException` (generado automáticamente por `ValidationPipe`).
- Más de 5 intentos/min → `429 TooManyRequestsException` (generado por `ThrottlerGuard`).

**Required tests**
- [ ] `POST /auth/login` con credenciales válidas responde 200 con `accessToken` y setea la cookie
      `refresh_token` — valida AC-01
- [ ] `POST /auth/login` con password incorrecta responde 401 con mensaje genérico — valida AC-02
- [ ] `POST /auth/login` con email inexistente responde 401 con el mismo mensaje genérico que
      password incorrecta (no distingue el motivo) — valida AC-02
- [ ] Un endpoint protegido con `JwtAuthGuard` sin header `Authorization` responde 401 — valida
      AC-03
- [ ] Un endpoint protegido con `JwtAuthGuard` con un token expirado responde 401 — valida AC-03
- [ ] `POST /auth/refresh` con una cookie de refresh token válida responde 200 con un nuevo
      `accessToken` y rota la cookie
- [ ] `POST /auth/refresh` reusando un refresh token ya rotado (previamente válido) responde 401 e
      invalida la sesión — valida la mitigación de reuso del threat model
- [ ] `POST /auth/login` respondiendo 429 al superar el límite de intentos por minuto
- [ ] `POST /auth/login` con un DTO inválido (email mal formado) responde 400
- [ ] `POST /auth/refresh` sin cookie `refresh_token` responde 401
- [ ] `POST /auth/refresh` con una cookie cuyo token tiene firma inválida o está expirado responde
      401

**Completion criterion**
Los 11 tests de este bloque pasan; `POST /auth/login` y `POST /auth/refresh` responden según el
contrato documentado contra la base de datos de test.

---

## Block 3 — Alta de usuarios

**Files**
- `backend/src/users/users.module.ts` (new)
- `backend/src/users/users.controller.ts` (new) — `POST /users`
- `backend/src/users/users.service.ts` (new)
- `backend/src/users/dto/create-user.dto.ts` (new) — `email` (`@IsEmail`), `password`
  (`@IsString`, `@MinLength(8)`), `role` (`@IsEnum(UserRole)`)
- `backend/src/common/guards/roles.guard.ts` (new) — reutilizable por cualquier dominio futuro
- `backend/src/common/decorators/roles.decorator.ts` (new) — `@Roles(...roles: UserRole[])`
- `backend/src/app.module.ts` (modified) — importa `UsersModule`
- `backend/prisma/schema.prisma` (modified) — agrega `@@unique([email])` explícito si no quedó
  cubierto en Block 1

**Logic**
`POST /users` está protegido por `JwtAuthGuard` + `RolesGuard` con `@Roles('ADMIN')`. `RolesGuard`
lee el `role` del payload del JWT (inyectado por `JwtStrategy` en `request.user`) y lo compara
contra los roles requeridos por el decorador; si no coincide, `ForbiddenException` (FR-04/AC-05).
`UsersService.create` verifica primero si el email ya existe (`findUnique`); si existe,
`ConflictException` (FR-07/AC-06) — la constraint `@unique` en el schema es la red de seguridad
final contra condiciones de carrera. Si no existe, hashea la contraseña con bcrypt y crea el
`User` con el rol indicado. Responde `UserResponseDto` (nunca el `passwordHash`).

**API contract**

`POST /users`
- Request body: `{ email: string, password: string, role: 'ADMIN'|'PM'|'LEADER'|'RESOURCE' }`
- Response 201: `{ id, email, role, createdAt }` (sin `passwordHash`)
- Errores: `401 Unauthorized` (sin token) · `403 Forbidden` (rol insuficiente) · `409 Conflict`
  (email duplicado) · `400 Bad Request` (validación de DTO)
- Auth: `Authorization: Bearer <accessToken>`, rol `ADMIN` requerido

**Data model**
Reutiliza `User`/`UserRole` de Block 1. `@@unique([email])` ya declarado.

**Input validation**
- `create-user.dto.ts`: `email` formato válido; `password` string, mínimo 8 caracteres; `role`
  debe ser uno de los valores del enum `UserRole` (`@IsEnum`) — cualquier otro valor es rechazado
  con 400 antes de llegar al service.

**Error handling**
- Sin token → `401 UnauthorizedException` (mismo mensaje que Block 2).
- Rol insuficiente (no Admin) → `403 ForbiddenException`, mensaje "No tenés permiso para realizar
  esta acción" (AC-05/NFR-04).
- Email duplicado → `409 ConflictException`, mensaje "Ya existe una cuenta con ese email" (AC-06).
- DTO inválido (incl. `role` fuera del enum) → `400 BadRequestException`.

**Required tests**
- [ ] `POST /users` autenticado como Admin con datos válidos responde 201 y el usuario creado puede
      loguearse con el rol asignado — valida AC-04
- [ ] `POST /users` autenticado como no-Admin (PM/Líder/Recurso) responde 403 — valida AC-05
- [ ] `POST /users` sin autenticar responde 401
- [ ] `POST /users` con un email ya existente responde 409 y no crea un registro duplicado — valida
      AC-06
- [ ] `POST /users` con `role` fuera del enum `UserRole` responde 400

**Completion criterion**
Los 5 tests de este bloque pasan; `POST /users` responde según el contrato documentado y respeta el
RBAC (solo Admin) contra la base de datos de test.

---

## Block 4 — Logout y seed del Admin inicial

**Files**
- `backend/src/auth/auth.controller.ts` (modified) — agrega `POST /auth/logout`
- `backend/src/auth/auth.service.ts` (modified) — agrega `logout(userId)`
- `backend/prisma/seed.ts` (new)
- `backend/package.json` (modified) — agrega bloque `"prisma": { "seed": "ts-node prisma/seed.ts" }`

**Logic**
`POST /auth/logout` está protegido por `JwtAuthGuard` (requiere access token válido — decisión del
threat model para que un origen cruzado no pueda forzar un logout ajeno sin poder fijar el header
`Authorization`). `AuthService.logout` pone `refreshTokenHash = null` para el usuario autenticado y
limpia la cookie `refresh_token` (`res.clearCookie`). Loguea el evento (`Logger`, sin datos
sensibles).

`prisma/seed.ts`: lee `ADMIN_EMAIL`/`ADMIN_PASSWORD` de `process.env` (falla al arrancar si faltan,
con un mensaje explícito — nunca un valor por defecto hardcodeado). Busca si ya existe algún `User`
con `role: 'ADMIN'`; si existe, no hace nada (idempotente, AC-09). Si no existe, crea uno con la
contraseña hasheada con bcrypt.

**API contract**

`POST /auth/logout`
- Request: sin body, requiere `Authorization: Bearer <accessToken>`
- Response 200: `{ message: 'Sesión cerrada' }`, limpia la cookie `refresh_token`
- Errores: `401 Unauthorized` (sin token o token inválido)
- Auth: `Authorization: Bearer <accessToken>`

**Data model**
Sin cambios de schema.

**Input validation**
N/A (sin body).

**Error handling**
- Sin token válido → `401 UnauthorizedException` (mismo mensaje que Block 2).
- `ADMIN_EMAIL`/`ADMIN_PASSWORD` ausentes al ejecutar el seed → el script termina con código de
  salida distinto de 0 y un mensaje explicando qué variable falta (no crea nada).

**Required tests**
- [ ] `POST /auth/logout` autenticado invalida el refresh token: un intento posterior de
      `POST /auth/refresh` con la cookie previa responde 401 — valida AC-07
- [ ] `POST /auth/logout` sin autenticar responde 401
- [ ] Ejecutar el seed sobre una base de datos vacía crea exactamente un Admin con las credenciales
      de las variables de entorno — valida AC-08
- [ ] Ejecutar el seed una segunda vez sobre la misma base de datos no crea un segundo Admin —
      valida AC-09
- [ ] Ejecutar el seed sin `ADMIN_PASSWORD` definida termina con error y no crea ningún usuario

**Completion criterion**
Los 5 tests de este bloque pasan; el seed es idempotente y el logout invalida efectivamente la
sesión.

---

## Block 5 — Frontend: scaffold y UI de autenticación

**Files**
- `frontend/package.json` (new) — Vite + React + TypeScript, deps: `react-router-dom`, `zod`
- `frontend/vite.config.ts`, `frontend/index.html`, `frontend/tsconfig.json` (new)
- `frontend/src/main.tsx`, `frontend/src/App.tsx` (new) — configura `react-router-dom` con rutas
  `/login` (pública) y `/admin/users` (protegida, solo Admin)
- `frontend/src/services/auth.service.ts` (new) — `login()`, `logout()`, `refresh()`; único punto
  que llama a `/auth/*`; usa `fetch` con `credentials: 'include'` (para la cookie de refresh);
  **re-lanza** cualquier error de la API (nunca lo swallowea, por convención de `AGENTS.md`)
- `frontend/src/services/users.service.ts` (new) — `createUser()`; único punto que llama a
  `/users`; re-lanza errores igual que `auth.service.ts`
- `frontend/src/hooks/use-auth.ts` (new) — contexto/hook `useAuth()`; guarda el `accessToken` en
  memoria (nunca en `localStorage`, para reducir superficie de robo vía XSS); consume
  exclusivamente `auth.service.ts`, nunca hace `fetch` directo
- `frontend/src/pages/LoginPage.tsx` (new) — formulario de login, validación con `zod` en el
  cliente (espejo de `login.dto.ts`, no reemplaza la validación server-side)
- `frontend/src/pages/AdminCreateUserPage.tsx` (new) — formulario de alta de usuario (solo visible
  si `useAuth().user.role === 'ADMIN'`), validación con `zod` (espejo de `create-user.dto.ts`)
- `frontend/src/components/ProtectedRoute.tsx` (new) — redirige a `/login` si no hay sesión;
  redirige con mensaje de error si el rol no alcanza (props `requiredRole`)

**Justificación de nueva dependencia**: `react-router-dom` — el proyecto no tiene ningún router
todavía; es necesario para navegar entre `/login` y `/admin/users` (NFR-05). Librería estándar de
facto para routing en React, activamente mantenida.

**Logic**
`LoginPage` valida el formulario con `zod` antes de llamar a `auth.service.login()`; si la API
responde error, lo muestra en pantalla (nunca lo traga). Al loguearse OK, `useAuth` guarda el
`accessToken` en memoria y redirige según el rol (Admin → `/admin/users`; otro rol → placeholder,
fuera de alcance de este ticket per PRD). `ProtectedRoute` envuelve `/admin/users`: sin sesión →
redirige a `/login`; con sesión pero rol distinto de Admin → muestra el mensaje de acceso denegado
de NFR-04. `AdminCreateUserPage` valida con `zod` y llama a `users.service.createUser()`; muestra
éxito o el error devuelto por la API (p. ej. 409 email duplicado). Un botón de logout (visible en
cualquier página autenticada) llama a `auth.service.logout()` y limpia el estado de `useAuth`.

**API contract**
No aplica — este bloque consume los contratos ya definidos en Blocks 2, 3 y 4.

**Data model**
No aplica.

**Input validation**
- `LoginPage`: `zod` — `email` formato válido, `password` no vacío.
- `AdminCreateUserPage`: `zod` — `email` formato válido, `password` mínimo 8 caracteres, `role` uno
  de `ADMIN|PM|LEADER|RESOURCE`. Esta validación es una mejora de UX (feedback inmediato); la
  validación real y autoritativa es la del backend (Blocks 2/3) — nunca se asume que el cliente es
  confiable.

**Error handling**
- `auth.service.ts`/`users.service.ts`: si `fetch` responde `!ok`, parsean el body de error de la
  API y lo relanzan (`throw`) — nunca devuelven `null`/`undefined` silenciosamente.
- `LoginPage`/`AdminCreateUserPage`: capturan el error relanzado por la capa `services` y lo
  muestran en un mensaje visible al usuario (NFR-04) — nunca un catch vacío.
- `ProtectedRoute`: si `useAuth()` no tiene sesión válida, redirige a `/login` en vez de mostrar una
  pantalla rota.

**Required tests**
- [ ] `LoginPage`: envío exitoso llama a `auth.service.login()` con los valores del formulario y
      redirige — valida el flujo de AC-01 desde la UI
- [ ] `LoginPage`: la API responde error (401) → el mensaje de error se muestra en pantalla, no se
      traga — valida NFR-04 desde la UI
- [ ] `AdminCreateUserPage`: envío exitoso llama a `users.service.createUser()` y muestra
      confirmación — valida el flujo de AC-04 desde la UI
- [ ] `AdminCreateUserPage`: la API responde 409 (email duplicado) → el mensaje se muestra en
      pantalla — valida AC-06 desde la UI
- [ ] `ProtectedRoute`: sin sesión, renderiza un redirect a `/login` en vez del contenido protegido
- [ ] `auth.service.ts`: si `fetch` responde `!ok`, la función relanza el error (no retorna
      `undefined`) — test unitario de la capa de servicios

**Completion criterion**
Los 6 tests de este bloque pasan; `npm run dev` en `frontend/` permite loguearse contra el backend
local, un Admin puede dar de alta un usuario desde `/admin/users`, y cualquier error de la API se ve
en pantalla.

---

## Final verification

- Los 31 tests de los 5 bloques pasan (`npm test` en `backend/` y en `frontend/`).
- Las 9 ACs del PRD (`docs/daw/prd/prd-FEAT-001.md`) quedan cubiertas por al menos un test (ver
  referencias "valida AC-xx" en cada bloque).
- `docker-compose up -d && npx prisma migrate deploy && npx prisma db seed` deja una base de datos
  con un único Admin, listo para loguearse desde `frontend/`.
- Ningún endpoint devuelve `passwordHash`/`refreshTokenHash` en ninguna respuesta.
- `/daw-security-sast` (CODE phase) no encuentra secretos hardcodeados ni las categorías Critical/
  High del catálogo de SAST.
