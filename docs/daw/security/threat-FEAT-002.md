# Threat Model FEAT-002: Alta de clientes

| Field | Value |
|-------|-------|
| Ticket | FEAT-002 |
| Date | 2026-08-05 |
| Spec de referencia | docs/daw/specs/spec-FEAT-002.md (a escribir tras este análisis) |

## Componentes y superficies de ataque

| Componente | Endpoint/flujo | Superficie |
|---|---|---|
| `ClientsController` | `POST /clients` | Input de usuario (nombre/descripción) — validación de longitud, unicidad, elevación de privilegios (rol PM requerido) |
| `ClientsController` | `GET /clients` | Requiere sesión + rol PM — bypass de autorización |
| `ClientsService` | `create()`/`findAll()` | Condición de carrera en el chequeo de unicidad; consulta a `PrismaService` |
| `PrismaService` | Toda query a `Client` | Inyección SQL/NoSQL (mitigado por el ORM — ver Tampering) |
| Frontend `clients.service.ts`/`PMClientsPage.tsx` | Toda llamada a la API | Reutiliza el access token en memoria ya existente (mismo patrón que `users.service.ts`) — sin superficie nueva de manejo de tokens |

## Límites de confianza (trust boundaries)

1. **Navegador (no confiable) ↔ API NestJS**: `name`/`description` se validan server-side con `class-validator` (`MaxLength(30)`/`MaxLength(255)`, no vacíos), nunca se confía en la validación de `zod` del frontend.
2. **Usuario autenticado (cualquier rol) ↔ funcionalidad PM-only**: `JwtAuthGuard` + `RolesGuard` + `@Roles(UserRole.PM)`, reutilizados sin modificar desde FEAT-001, sobre ambos endpoints (`POST` y `GET /clients`).
3. **Backend ↔ PostgreSQL**: todo acceso pasa por Prisma (queries parametrizadas), nunca SQL crudo; el constraint `@unique` sobre `nameNormalized` es la garantía de unicidad a nivel de motor, no solo de aplicación.

## Datos sensibles (clasificación)

| Dato | Clasificación | Cifrado |
|---|---|---|
| `name` / `description` (Client) | Dato de negocio interno (no PII, no credencial, no financiero — el PRD general excluye tarifas/facturación) | Sin cifrado adicional más allá de TLS en tránsito y el cifrado en reposo ya provisto por la infraestructura de Postgres gestionada; no aplica F-TM-07 |
| `nameNormalized` (Client) | Detalle interno de implementación (derivado de `name`) | Nunca expuesto en respuestas — `ClientResponseDto` lo excluye explícitamente (mismo patrón que `UserResponseDto` excluye `passwordHash`) |

## Análisis STRIDE

### `POST /clients` / `GET /clients`

| Categoría | Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|---|
| Spoofing | Suplantación de identidad en la sesión | Baja | Alto | 🟢 Reutiliza `JwtAuthGuard` sin modificar (validación de firma/expiración ya cubierta y probada en FEAT-001) |
| Tampering | Condición de carrera: dos altas simultáneas con el mismo nombre (distinto casing) crean dos clientes "duplicados" | Media | Bajo | 🟡 Constraint único case-insensitive sobre `nameNormalized` a nivel de base de datos (NFR-01 del PRD); el pre-check en el service es UX (mensaje claro), el constraint es la garantía real ante la carrera |
| Tampering | Inyección SQL vía `name`/`description` | Baja | Alto | 🟠 Prisma parametriza todas las queries; `class-validator` valida tipo/longitud antes de llegar al service |
| Repudiation | No queda registro de qué PM creó cada cliente (sin campo `createdBy`) | Baja | Bajo | 🟢 Aceptado para el MVP — no lo exige ninguna FR/AC del PRD FEAT-002; el dato no es financiero ni crítico. Revisar si una futura auditoría de negocio lo requiere |
| Information Disclosure | Filtración de `nameNormalized` en la respuesta | Baja | Bajo | 🟢 `ClientResponseDto` con whitelist explícito de campos (`id`, `name`, `description`, `createdAt`) |
| Denial of Service | Un PM (cuenta comprometida o bug del frontend) satura `POST /clients` sin límite de tasa, a diferencia de `/auth/login` que sí tiene `ThrottlerGuard` | Baja | Medio | 🟡 **Riesgo aceptado** — ver detalle abajo |
| Elevation of Privilege | Un usuario sin rol PM (Admin/Líder/Recurso) o no autenticado intenta `POST`/`GET /clients` directo, evitando la UI | Media | Alto | 🟠 `RolesGuard` + `@Roles(UserRole.PM)`, reutilizado sin modificar desde FEAT-001, ya probado (mismo patrón que `users.controller.spec.ts`) |

## Riesgo aceptado: Denial of Service sin rate limiting en `/clients`

| Campo | Valor |
|---|---|
| Riesgo | Sin `ThrottlerGuard`, una cuenta PM comprometida o un bug de reintento en el frontend puede saturar `POST /clients` sin límite de tasa |
| Quién lo acepta | Usuario del proyecto (Agustín), 2026-08-05, en la conversación de PLAN de FEAT-002 |
| Justificación | El atacante ya debe ser una cuenta PM autenticada (no es una superficie pública como `/auth/login`); el PRD asume volumen bajo de clientes en el MVP; un límite tipo "5/min" (el usado en login) frenaría cargas iniciales legítimas de cartera de clientes, y definir un límite distinto es trabajo no cubierto por el PRD de este ticket |
| Condiciones de revisión | Revisar si se observa abuso real en producción, o cuando se implemente un flujo de carga masiva de clientes (fuera de alcance de FEAT-002) que sí amerite un límite bien calibrado |

## Mitigaciones a plegar en el spec

1. `RolesGuard` + `@Roles(UserRole.PM)` en `POST /clients` y `GET /clients`.
2. Constraint único case-insensitive (`nameNormalized`) en el modelo `Client` del schema de Prisma.
3. `ClientResponseDto` con whitelist explícito de campos (excluye `nameNormalized`).
4. Validación server-side de longitud y no-vacío (`MaxLength(30)`/`MaxLength(255)`, `IsNotEmpty`) en `CreateClientDto`, independiente de la validación `zod` del frontend.

## Resumen de riesgos

C: 0 | H: 1 (mitigado) | M: 2 (1 mitigado, 1 aceptado) | L: 3 (aceptados/mitigados, sin acción adicional)
