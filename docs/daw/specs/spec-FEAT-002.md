# Spec FEAT-002: Alta de clientes

| Field | Value |
|-------|-------|
| Ticket | FEAT-002 |
| PRD | docs/daw/prd/prd-FEAT-002.md |
| Tier | FEATURE |
| Date | 2026-08-05 |
| Spec loops | 0 |

## Summary

Se agrega un módulo `clients` en el backend (NestJS + Prisma), espejo del módulo `users` de
FEAT-001: modelo `Client` con unicidad case-insensitive del nombre garantizada a nivel de base de
datos, endpoints `POST`/`GET /clients` protegidos por RBAC (rol PM), y un frontend con servicio +
página de alta/listado que aplica por primera vez la sección "UI/Design conventions" de `AGENTS.md`
(paleta, tipografía, espaciado) mediante variables CSS, sin agregar dependencias nuevas.

## Coverage: PRD → blocks

| Requirement | Covered by |
|---|---|
| FR-01 | Block 1, Block 3 |
| FR-02 | Block 1 |
| FR-03 | Block 1 |
| FR-04 | Block 1, Block 3 |
| NFR-01 | Strategy: constraint `@unique` sobre `nameNormalized` en el schema de Prisma (Block 1) |
| NFR-02 | Strategy: `JwtAuthGuard` + `RolesGuard` + `@Roles(UserRole.PM)` reutilizados sin modificar desde FEAT-001 (Block 1) |
| NFR-03 | Strategy: queries simples sin joins ni paginación a la escala esperada del MVP (Block 1) |

## Dependencies between blocks

Block 1 (backend) → Block 2 (frontend service, consume la API de Block 1) → Block 3 (frontend
página, consume Block 2). Orden de ejecución: 1 → 2 → 3.

---

## Block 1 — Backend: modelo `Client` + módulo `clients`

**Files**
- `backend/prisma/schema.prisma` (modified) — agrega el modelo `Client`
- `backend/prisma/migrations/<timestamp>_add_client/migration.sql` (new, generado por `prisma migrate dev`)
- `backend/src/clients/dto/create-client.dto.ts` (new)
- `backend/src/clients/dto/client-response.dto.ts` (new)
- `backend/src/clients/clients.service.ts` (new)
- `backend/src/clients/clients.controller.ts` (new)
- `backend/src/clients/clients.module.ts` (new)
- `backend/src/clients/clients.controller.spec.ts` (new)
- `backend/src/app.module.ts` (modified) — registra `ClientsModule`

**Logic**

`ClientsService.create(dto)`:
1. Normaliza `dto.name`: `trim()` + `toLowerCase()` → `nameNormalized`. `name` también se persiste
   trimmed (sin normalizar el casing) para evitar espacios inconsistentes en el nombre mostrado.
2. Pre-check: `prisma.client.findUnique({ where: { nameNormalized } })`. Si existe → lanza
   `ConflictException` con mensaje claro ("Ya existe un cliente con ese nombre"). Mismo patrón que
   `UsersService.create` con el email.
3. Si no existe, `prisma.client.create({ data: { name: trimmedName, nameNormalized, description: trimmedDescription } })`.
   El constraint `@unique` sobre `nameNormalized` es la garantía real ante una condición de carrera
   entre el pre-check y el `create` (NFR-01) — el pre-check es solo para dar un mensaje de error
   claro en el caso común.
4. Retorna `ClientResponseDto.fromEntity(client)`.

`ClientsService.findAll()`:
1. `prisma.client.findMany({ orderBy: { createdAt: 'asc' } })` — orden determinístico (no
   especificado por el PRD; se fija explícitamente para que listados y tests sean estables).
2. Retorna `client.map(ClientResponseDto.fromEntity)`.

`ClientsController`:
- `POST /clients` — `@UseGuards(JwtAuthGuard, RolesGuard)`, `@Roles(UserRole.PM)`,
  `@HttpCode(HttpStatus.CREATED)`. Body: `CreateClientDto`. Llama a `clientsService.create`.
- `GET /clients` — mismos guards y rol. Llama a `clientsService.findAll`.

`ClientsModule`:
- `controllers: [ClientsController]`
- `providers: [ClientsService, RolesGuard]` (mismo patrón que `UsersModule`: `RolesGuard` se
  registra acá para que Nest resuelva su dependencia de `Reflector` a través del injector de este
  módulo)

**API contract**

`POST /clients`
- Request body: `{ name: string, description: string }`
- Response `201`: `{ id: string, name: string, description: string, createdAt: string }`
- Errores:
  - `400` — `name`/`description` vacíos, `name` > 30 caracteres, `description` > 255 caracteres
    (formato `{ statusCode, message: string[], error }` del `ValidationPipe`, vía
    `HttpExceptionFilter` global — sin manejo nuevo)
  - `401` — sin access token válido
  - `403` — autenticado pero rol distinto de PM
  - `409` — `name` ya existe (case-insensitive)
- Auth: `JwtAuthGuard` + `RolesGuard` + `@Roles(UserRole.PM)`

`GET /clients`
- Response `200`: `{ id: string, name: string, description: string, createdAt: string }[]`
  (ordenado por `createdAt` ascendente; `[]` si no hay clientes)
- Errores: `401`, `403` (mismos casos que arriba)
- Auth: `JwtAuthGuard` + `RolesGuard` + `@Roles(UserRole.PM)`

**Data model**

```prisma
model Client {
  id             String   @id @default(cuid())
  name           String
  nameNormalized String
  description    String
  createdAt      DateTime @default(now())

  @@unique([nameNormalized])
}
```

- `name`: máximo 30 caracteres (validado en el DTO, no en el schema — Postgres no trunca, rechaza
  en la capa de aplicación).
- `description`: máximo 255 caracteres (validado en el DTO).
- `nameNormalized`: derivado (`name.trim().toLowerCase()`), nunca expuesto en respuestas, único a
  nivel de base de datos.

**Input validation** (`create-client.dto.ts`)
- `name`: `@IsString()`, `@IsNotEmpty()`, `@MaxLength(30)`
- `description`: `@IsString()`, `@IsNotEmpty()`, `@MaxLength(255)`

**Error handling**
- `ConflictException` (409) en `nameNormalized` duplicado — capturado por el `HttpExceptionFilter`
  global existente, sin wiring adicional.
- Errores de validación del DTO → `400` automático vía `ValidationPipe` global (ya configurado en
  `main.ts` desde FEAT-001).
- Cualquier error no controlado → `500` genérico vía el mismo filtro (sin cambios).

**Required tests** (`clients.controller.spec.ts`, mismo enfoque de integración con `PrismaService`
mockeado + supertest que `users.controller.spec.ts`)
- [ ] `POST /clients` con datos válidos y rol PM → `201` con el cliente creado — valida AC-01
- [ ] `POST /clients` con rol distinto de PM (o sin token) → `403`/`401` — valida AC-02
- [ ] `POST /clients` con `name` duplicado (mismo casing) → `409` — valida AC-03
- [ ] `POST /clients` con `name` duplicado (distinto casing, ej. "Acme" vs "acme") → `409` — valida AC-03
- [ ] `POST /clients` con `name` de 31 caracteres → `400` — valida AC-04
- [ ] `POST /clients` con `description` de 256 caracteres → `400` — valida AC-04
- [ ] `POST /clients` con `name` u `description` vacíos → `400` — valida AC-05
- [ ] `GET /clients` con rol PM y clientes existentes → `200` con la lista ordenada por `createdAt` — valida AC-06
- [ ] `GET /clients` con rol PM y sin clientes → `200` con `[]` — valida AC-06/AC-07 (el empty state es responsabilidad del frontend, ver Block 3)
- [ ] `GET /clients` con rol distinto de PM → `403` — valida AC-02

**Completion criterion**
Los 10 tests de `clients.controller.spec.ts` pasan; `POST /clients` retorna `201` con el cliente
creado y rechaza duplicados/rol inválido/input inválido con el código correcto; `GET /clients`
retorna la lista ordenada.

**Rollback**
`Client` es una tabla nueva sin relaciones con datos existentes — revertir la migración
(`prisma migrate resolve --rolled-back` + `DROP TABLE "Client"`) no implica pérdida de datos de
otras entidades. Indicador para aplicarlo: fallas post-deploy en el módulo `clients` que no se
puedan resolver con un fix rápido.

---

## Block 2 — Frontend: `clients.service.ts`

**Files**
- `frontend/src/services/clients.service.ts` (new)
- `frontend/src/services/clients.service.spec.ts` (new)

**Logic**

Único punto de la app que llama a `/clients` (regla de `AGENTS.md`: los componentes nunca llaman a
la API directamente). Mismo patrón que `users.service.ts`: `extractErrorMessage`/`handleResponse`
reimplementados localmente (igual que en `users.service.ts`, sin extraer un helper compartido, para
no tocar código de FEAT-001 fuera de este ticket).

```ts
export interface CreateClientPayload { name: string; description: string; }
export interface Client { id: string; name: string; description: string; createdAt: string; }

export async function createClient(accessToken: string, payload: CreateClientPayload): Promise<Client>
export async function listClients(accessToken: string): Promise<Client[]>
```

- `createClient`: `POST ${API_URL}/clients`, `credentials: 'include'`, header
  `Authorization: Bearer ${accessToken}`, body JSON.
- `listClients`: `GET ${API_URL}/clients`, mismos headers, sin body.
- Ambas usan `handleResponse<T>` — nunca tragan un error de la API (relanzan con el mensaje extraído
  del body `{ message }` del `HttpExceptionFilter`).

**API contract**
Consume el contrato definido en Block 1 (`POST`/`GET /clients`). Sin cambios adicionales.

**Input validation**
N/A — este bloque no valida, solo transporta. La validación de UX vive en Block 3 (zod, espejo del
DTO del backend); la validación autoritativa es la del backend (Block 1).

**Error handling**
- Un `response.ok === false` lanza un `Error` con el mensaje extraído del body (`400`/`401`/`403`/`409`
  del backend, o `Error ${status}` genérico si el body no es JSON parseable).
- El caller (Block 3) es responsable de capturarlo y mostrarlo — este servicio nunca lo swallowea.

**Required tests** (`clients.service.spec.ts`, mismo enfoque que `users.service.spec.ts`: mock de
`fetch`)
- [ ] `createClient` con respuesta `201` → retorna el cliente creado
- [ ] `createClient` con respuesta `409` → lanza `Error` con el mensaje del body
- [ ] `listClients` con respuesta `200` y lista no vacía → retorna el array de clientes
- [ ] `listClients` con respuesta `200` y lista vacía → retorna `[]`
- [ ] `listClients` con respuesta `403` → lanza `Error` con el mensaje del body

**Completion criterion**
Los 5 tests de `clients.service.spec.ts` pasan; ninguna función traga un error de red/API sin
relanzarlo.

---

## Block 3 — Frontend: página de PM (alta + listado) y tokens de diseño

**Files**
- `frontend/src/styles/tokens.css` (new) — variables CSS de la sección "UI/Design conventions" de
  `AGENTS.md`
- `frontend/src/main.tsx` (modified) — importa `tokens.css` una vez, a nivel global
- `frontend/src/pages/PMClientsPage.tsx` (new)
- `frontend/src/pages/PMClientsPage.css` (new) — estilos del formulario/listado usando las
  variables de `tokens.css`
- `frontend/src/pages/PMClientsPage.spec.tsx` (new)
- `frontend/src/App.tsx` (modified) — agrega la ruta `/pm/clients`

**Logic**

`tokens.css` — variables `:root` derivadas 1:1 de la tabla de paleta de `AGENTS.md`:
```css
:root {
  --color-primary: #4F46E5;
  --color-primary-hover: #4338CA;
  --color-text: #0F172A;
  --color-text-secondary: #64748B;
  --color-bg: #F8FAFC;
  --color-border: #E2E8F0;
  --color-error: #EF4444;
  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px;
  --space-6: 24px; --space-8: 32px;
  --radius-sm: 8px; --radius-md: 12px;
}
```
Solo se declaran los tokens que este bloque usa (color primario, texto, fondo, bordes, error,
espaciado, radios). Los colores de estado de tarea (Pendiente/En curso/Entregada, RF-26) no se
declaran acá — no aplican a esta página y se agregan en el ticket de Tableros que los necesite.

`PMClientsPage.tsx`:
- Segunda capa de defensa además de `ProtectedRoute` (igual que `AdminCreateUserPage`): si
  `user?.role !== 'PM'`, renderiza `<p role="alert">No tenés permiso para acceder a esta
  página.</p>` y no monta el resto.
- Estado: `name`, `description`, `error`, `successMessage`, `isSubmitting` (deshabilita el botón de
  submit durante el alta, igual que `AdminCreateUserPage`), `clients: Client[]`, `isLoadingClients`.
- Al montar (`useEffect`): `isLoadingClients = true` → `listClients(accessToken)` → guarda en
  `clients` → `isLoadingClients = false`. Si falla, muestra el error (nunca lo traga) y deja
  `clients` en `[]`.
- Validación de UX con zod, espejo de los límites del DTO del backend (`name` ≤30, `description`
  ≤255, ambos no vacíos) — nunca reemplaza la validación del servidor (Block 1).
- Al crear con éxito: agrega el cliente nuevo a `clients` (al final, consistente con el orden por
  `createdAt` ascendente de Block 1) y limpia el formulario.
- Listado: mientras `isLoadingClients` → `<p>Cargando clientes...</p>` (RNF-11, indicador simple
  acordado). Si `!isLoadingClients && clients.length === 0` → empty state (RF-27): mensaje tipo "No
  hay clientes cargados todavía." en vez de una tabla vacía. Si hay clientes → lista con nombre y
  descripción de cada uno.

**API contract**
Consume `createClient`/`listClients` de Block 2. Sin cambios adicionales.

**Input validation** (UX, espejo del backend — ver `create-client.dto.ts` en Block 1)
```ts
const createClientSchema = z.object({
  name: z.string().min(1, 'Ingresá un nombre').max(30, 'Máximo 30 caracteres'),
  description: z.string().min(1, 'Ingresá una descripción').max(255, 'Máximo 255 caracteres'),
});
```

**Error handling**
- Error de `listClients` (montaje) → mensaje visible (`role="alert"`), `clients` queda en `[]` (no
  crashea la página).
- Error de `createClient` (submit, incluyendo `409` de nombre duplicado) → mensaje visible
  (`role="alert"`), el formulario conserva lo tipeado para que el usuario pueda corregir.

**Required tests** (`PMClientsPage.spec.tsx`, mismo enfoque que `AdminCreateUserPage.spec.tsx`:
React Testing Library + mocks de `clients.service.ts`)
- [ ] Usuario con rol PM ve el formulario y, al cargar, el listado de clientes existentes — valida AC-06
- [ ] Usuario con rol distinto de PM ve el mensaje de acceso denegado y no ve el formulario — valida AC-02
- [ ] Listado vacío muestra el empty state en vez de una tabla en blanco — valida AC-07
- [ ] Envío válido crea el cliente, lo agrega al listado y limpia el formulario — valida AC-01
- [ ] Envío con `name` de 31 caracteres muestra el error de validación de UX sin llamar a la API — valida AC-04
- [ ] Envío que responde `409` (nombre duplicado) muestra el mensaje del backend sin perder lo tipeado — valida AC-03
- [ ] Mientras `listClients` está en vuelo se muestra el indicador de carga — valida NFR-11 (RNF-11 del PRD general)
- [ ] `listClients` falla al montar la página → se muestra el mensaje de error y `clients` queda en `[]` (no crashea) — valida el manejo de errores documentado arriba

**Completion criterion**
Los 7 tests de `PMClientsPage.spec.tsx` pasan; la página usa las variables de `tokens.css` (sin
colores/espaciados hardcodeados fuera de esas variables); la ruta `/pm/clients` es accesible solo
para rol PM autenticado.

---

## Final verification

- Los 3 bloques compilan y sus tests pasan (backend: `npm --prefix backend test`; frontend:
  `npm --prefix frontend test`, per `AGENTS.md`).
- Un PM autenticado puede crear un cliente desde `/pm/clients`, verlo aparecer en el listado, e
  intentar duplicarlo y ser rechazado con un mensaje claro.
- Un usuario no-PM autenticado, y uno no autenticado, no pueden acceder a `/pm/clients` ni a los
  endpoints `/clients` directamente.
- Cobertura de branches ≥80% en los archivos nuevos de backend y frontend (mismo umbral que
  FEAT-001, `.daw/rules/testing.instructions.md`).
