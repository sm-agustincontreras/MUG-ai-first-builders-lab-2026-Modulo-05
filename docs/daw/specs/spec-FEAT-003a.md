# Spec FEAT-003a: User.name obligatorio

| Field | Value |
|-------|-------|
| Ticket | FEAT-003a |
| PRD | docs/daw/prd/prd-FEAT-003a.md |
| Tier | FEATURE |
| Date | 2026-08-07T22:35:13Z |
| Spec loops | 0 |

## Summary

Se agrega `name` (obligatorio, 1-100 caracteres) a `User`. La migración agrega la columna como
nullable, la backfillea con la parte local del email (`split_part(email,'@',1)`) para las filas
existentes, y luego la marca `NOT NULL`. El alta de usuario por Admin (`POST /users`) exige `name`
en el DTO; el service lo trimea y rechaza el resultado si queda vacío. `UserResponseDto` (usado en
login y en la respuesta de creación) expone `name` igual que ya expone `email`/`role`. El seed
inicial crea el Admin con `name: 'Admin'`. El frontend agrega el campo al formulario de alta y a su
espejo de validación con `zod`.

## Coverage: PRD → blocks

| Requirement | Covered by |
|---|---|
| FR-01 | Block 2, Block 3 |
| FR-02 | Block 1 |
| FR-03 | Block 1 |
| NFR-01 | Strategy: la migración de Block 1 backfillea el 100% de las filas antes de aplicar `NOT NULL` — no puede terminar con filas nulas, es atómica |
| NFR-02 | Strategy: `name` es un campo más en un `create` ya existente, sin I/O adicional — el tiempo de respuesta no cambia respecto al ya validado en FEAT-001 |

## Dependencies between blocks

Block 1 → Block 2 → Block 3, en ese orden. Block 2 depende del campo `name` ya existente en el
schema (Block 1). Block 3 depende del contrato de `POST /users` ya actualizado (Block 2).

## Block 1 — Schema, migración y seed

**Files**
- `backend/prisma/schema.prisma` (modified) — agrega `name String` a `model User`.
- `backend/prisma/migrations/<timestamp>_add_user_name/migration.sql` (new) — generada con
  `prisma migrate dev --create-only` y editada a mano.
- `backend/prisma/seed.ts` (modified) — `SeedPrismaClient.user.create`'s `data` type agrega `name`;
  `seedAdmin` crea el Admin con `name: 'Admin'`.
- `backend/src/prisma/seed.spec.ts` (modified) — `MockUser`, el mock de `create` y las
  aserciones agregan `name`; nueva aserción de que el Admin creado tiene `name === 'Admin'`.

**Logic**

`schema.prisma`:
```prisma
model User {
  id                String    @id @default(cuid())
  email             String
  name              String
  passwordHash      String
  role              UserRole
  refreshTokenHash  String?
  createdAt         DateTime  @default(now())

  @@unique([email])
}
```

`migration.sql` (tres sentencias, en este orden):
```sql
-- AlterTable
ALTER TABLE "User" ADD COLUMN "name" TEXT;

-- Backfill (FR-03, AC-04, NFR-01): parte local del email para filas existentes.
UPDATE "User" SET "name" = split_part(email, '@', 1) WHERE "name" IS NULL;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "name" SET NOT NULL;
```

`seed.ts`: `seedAdmin` pasa `name: 'Admin'` en el `data` de `prisma.user.create` (FR-02, AC-03).

**Data model**

- `User.name`: `String`, `NOT NULL`, sin default a nivel de schema (el valor lo exige la
  aplicación o lo asigna el backfill de la migración). Sin constraint de unicidad (Out of Scope del
  PRD).

**Error handling**

- No hay input de usuario en este bloque (es una migración de schema + un seed, no un endpoint).
  Caso límite documentado: si la migración corriera sobre una base sin ninguna fila (entorno
  nuevo), el `UPDATE` de backfill no afecta ninguna fila y el `ALTER COLUMN SET NOT NULL` se aplica
  igual, sin error.

**Rollback**

Revertir este bloque es: `ALTER TABLE "User" DROP COLUMN "name";` (o `prisma migrate resolve
--rolled-back` sobre la migración) y quitar `name` de `schema.prisma`. No hay pérdida de datos de
otras columnas al revertir — `name` es la única columna nueva y ningún otro campo depende de ella.
Indicador para aplicarlo: la migración falla a mitad de aplicarse en un entorno con datos, o el
backfill produce valores inaceptables que bloquean el `ALTER COLUMN SET NOT NULL` (no debería
ocurrir: `split_part` siempre devuelve una cadena no vacía sobre un `email` válido y `NOT NULL`).

**Required tests**

- [ ] `seed.spec.ts`: `seedAdmin` sobre una base vacía crea el Admin con `name === 'Admin'` — valida
  AC-03.
- [ ] `seed.spec.ts`: los tests ya existentes (AC-08/AC-09 de FEAT-001) siguen en verde con
  `MockUser`/el mock de `create` actualizados para incluir `name`.
- [ ] Verificación manual (no automatizable sin Postgres en este sandbox, mismo criterio ya usado
  para el constraint de `Client` en FEAT-002): tras aplicar la migración sobre una base de
  desarrollo con filas de `User` preexistentes (de FEAT-001/FEAT-002) sin `name`, `SELECT COUNT(*)
  FROM "User" WHERE "name" IS NULL` devuelve `0` — valida AC-04 y AC-05/NFR-01.

**Completion criterion**

`npx prisma migrate dev` aplica la migración sin error sobre la base de desarrollo (con datos de
FEAT-001/FEAT-002 ya cargados) y deja `User.name` como `NOT NULL` con el 100% de las filas
pobladas (verificado por la consulta de arriba); `npm --prefix backend test -- seed.spec` pasa.

## Block 2 — DTO, mapper, service y auth

**Files**
- `backend/src/users/dto/create-user.dto.ts` (modified) — agrega `name`.
- `backend/src/users/dto/user-response.dto.ts` (modified) — agrega `name` a `UserEntityLike` y a
  `UserResponseDto` (constructor + `fromEntity`).
- `backend/src/users/users.service.ts` (modified) — trimea `name` y lo persiste; rechaza si queda
  vacío tras el trim.
- `backend/src/auth/auth.service.ts` (modified) — agrega `name: string` a la interfaz local
  `AuthenticatedUser` (gap del impact scan: fluye a `UserResponseDto.fromEntity` en `login()`).
- `backend/src/users/users.controller.spec.ts` (modified) — `MockUser`/`buildTestUser`/el mock de
  `create` agregan `name`; los payloads de los tests de 201 (AC-04) y 409 (AC-06) agregan `name`;
  nuevos tests para `name` faltante, `name` > 100 caracteres y `name` de solo espacios.
- `backend/src/auth/auth.controller.spec.ts` (modified) — `MockUser`/`buildTestUser` agregan `name`
  (no llama a `POST /users`, solo siembra el mock de Prisma).
- `backend/src/clients/clients.controller.spec.ts` (modified) — ídem: `MockUser`/`buildTestUser`
  agregan `name`.

**Logic**

`create-user.dto.ts`:
```typescript
@IsString()
@IsNotEmpty()
@MaxLength(100)
name!: string;
```

`user-response.dto.ts`: `UserEntityLike` gana `name: string`; `UserResponseDto` gana el campo
`readonly name: string`, el constructor lo recibe como quinto parámetro, y `fromEntity` lo pasa
igual que los demás campos whitelisteados (nunca se agrega `passwordHash`/`refreshTokenHash`).

`users.service.ts`:
```typescript
const trimmedName = dto.name.trim();
if (trimmedName.length === 0) {
  throw new BadRequestException('El nombre no puede estar vacío');
}
// ...
const user = await this.prisma.user.create({
  data: { email: dto.email, name: trimmedName, passwordHash, role: dto.role },
});
```
(mismo patrón que `ClientsService.create` trimea `name`/`description` — mitigación del threat model
para `name` de solo espacios, que `@IsNotEmpty` por sí solo no cubre.)

`auth.service.ts`: la interfaz `AuthenticatedUser` (usada internamente para tipar lo que sale de
`prisma.user.findUnique`) gana `name: string`, sin otro cambio de lógica — `login()` ya pasa el
objeto completo a `UserResponseDto.fromEntity`.

**API contract** *(extiende el ya existente, no crea uno nuevo)*
- `POST /users` — Request agrega `name: string` (1-100 caracteres, no vacío tras trim). Response
  (`201`) agrega `name` al body ya existente (`id`, `email`, `role`, `createdAt`).
- `POST /auth/login` — Response (`200`) agrega `name` dentro de `user`, sin cambios en el request.
- Error codes: `400` (nombre vacío, de solo espacios, o > 100 caracteres — nuevo respecto a
  FEAT-001), sin cambios en `401`/`403`/`409` ya existentes.
- Auth: sin cambios — `POST /users` sigue exigiendo `JwtAuthGuard` + `RolesGuard` + `@Roles(ADMIN)`.

**Input validation**

- `name`: string, no vacío (ni tras `.trim()`), máximo 100 caracteres. Validado en dos capas:
  `class-validator` en el DTO (rechaza `''` literal y > 100 chars) y `users.service.ts` (rechaza el
  caso de solo espacios que el DTO no cubre).

**Error handling**

- `name` vacío o > 100 caracteres → `400` vía `ValidationPipe` (mismo `HttpExceptionFilter` global
  que ya maneja el resto de los errores de validación).
- `name` de solo espacios → `400` vía `BadRequestException` explícita en `users.service.ts`.

**Required tests**

- [ ] `users.controller.spec.ts`: alta con `name` válido responde `201` e incluye `name` en el body
  (extiende el test de AC-04).
- [ ] `users.controller.spec.ts`: alta sin `name` responde `400` — valida AC-02.
- [ ] `users.controller.spec.ts`: alta con `name` de 101 caracteres responde `400` — valida AC-02.
- [ ] `users.controller.spec.ts`: alta con `name` de solo espacios responde `400` (mitigación del
  threat model, no un AC directo del PRD pero cierra el gap que deja `@IsNotEmpty`).
- [ ] `users.controller.spec.ts`: el test de 409 (AC-06) sigue en verde con `name` en el payload.
- [ ] `auth.controller.spec.ts`/`clients.controller.spec.ts`: siguen en verde con `MockUser`
  actualizado (no ejercitan `name` directamente, solo no deben romper por el tipo).

**Completion criterion**

`npm --prefix backend test` pasa completo (incluye `users`, `auth`, `clients`); `tsc` (vía `nest
build`) no reporta errores de tipos en `auth.service.ts` ni en los específs actualizados.

## Block 3 — Frontend: formulario de alta de usuario

**Files**
- `frontend/src/services/users.service.ts` (modified) — `CreateUserPayload`/`CreatedUser` agregan
  `name`.
- `frontend/src/services/users.service.spec.ts` (modified) — gap del impact scan: los dos payloads
  de `createUser(...)` agregan `name`; los fixtures de `createdUser` agregan `name`.
- `frontend/src/pages/AdminCreateUserPage.tsx` (modified) — nuevo campo `name` en el formulario, su
  `useState`, y en `createUserSchema` (espejo de `class-validator`, nunca reemplaza la validación
  del server).
- `frontend/src/pages/AdminCreateUserPage.spec.tsx` (modified) — el test que completa el formulario
  y verifica el payload de `createUser` agrega la interacción y la aserción de `name`.

**Logic**

`users.service.ts`: `CreateUserPayload`/`CreatedUser` ganan `name: string`, sin cambios en
`createUser()` más allá del tipo (ya serializa todo el payload con `JSON.stringify`).

`AdminCreateUserPage.tsx`:
```typescript
const createUserSchema = z.object({
  name: z.string().trim().min(1, 'Ingresá un nombre').max(100, 'Máximo 100 caracteres'),
  email: z.string().email('Ingresá un email válido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  role: z.enum(['ADMIN', 'PM', 'LEADER', 'RESOURCE']),
});
```
Nuevo `<input id="new-user-name">` con su `<label>`, agregado antes del campo de email; nuevo
`useState<string>` para `name`, incluido en `parsed = createUserSchema.safeParse({ name, email,
password, role })` y en el payload enviado a `createUser`.

**Input validation**

- Espejo del backend: `name` no vacío (`.trim().min(1)`), máximo 100 caracteres. Mensaje de error
  mostrado inline, igual que los campos ya existentes.

**Error handling**

- Sin cambios respecto al patrón ya existente: cualquier error de la API (incluido el `400` nuevo
  de `name`) se muestra vía `setError(err.message)`, nunca se traga.

**Required tests**

- [ ] `AdminCreateUserPage.spec.tsx`: completar el formulario con `name` y enviar llama a
  `createUser` con `name` incluido en el payload (extiende el test ya existente).
- [ ] `users.service.spec.ts`: los dos tests de `createUser(...)` compilan y pasan con `name` en el
  payload y en el fixture de respuesta.

**Completion criterion**

`npm --prefix frontend test` pasa completo; `tsc -b --noEmit` en `frontend/` no reporta errores.

## Final verification

- `npm --prefix backend test` y `npm --prefix frontend test` en verde.
- `npx prisma migrate dev` aplica limpiamente sobre una base con datos de FEAT-001/FEAT-002 ya
  cargados, dejando `User.name` `NOT NULL` en el 100% de las filas (NFR-01).
- Alta de usuario por Admin sin `name`, con `name` > 100 caracteres, o con `name` de solo espacios
  → `400` en los tres casos.
- El seed inicial (`npx prisma db seed` sobre una base vacía) crea el Admin con `name === 'Admin'`.
- La respuesta de `POST /auth/login` y de `POST /users` incluyen `name`, sin exponer
  `passwordHash`/`refreshTokenHash`.
