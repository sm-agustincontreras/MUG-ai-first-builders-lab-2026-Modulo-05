# Threat Model FEAT-003a: User.name obligatorio

| Field | Value |
|-------|-------|
| Ticket | FEAT-003a |
| Date | 2026-08-07 |
| Spec de referencia | docs/daw/specs/spec-FEAT-003a.md (a escribir tras este análisis) |

## Componentes y superficies de ataque

| Componente | Endpoint/flujo | Superficie |
|---|---|---|
| `UsersController` | `POST /users` | Input de usuario nuevo: `name` (además de email/password/rol ya existentes) — inyección, denegación de servicio por payload, dato vacío/con solo espacios |
| `AuthController` | `POST /auth/login` | Respuesta ahora incluye `name` del usuario autenticado (extensión de un flujo ya existente, sin input nuevo) |
| `PrismaService` | Migración `add_user_name` | `ALTER TABLE`/`UPDATE` de backfill sobre `User` — disponibilidad de la tabla durante el despliegue, valor por defecto asignado a filas existentes |
| `prisma/seed.ts` | Ejecución de seed | El Admin inicial se crea con `name` fijo ("Admin"), no derivado de input externo |
| Frontend `AdminCreateUserPage.tsx`/`users.service.ts` | Formulario de alta | Nuevo campo de texto libre que eventualmente se renderiza en otras vistas (equipos, FEAT-003c) |

## Límites de confianza (trust boundaries)

Este ticket no introduce límites de confianza nuevos: reutiliza los ya declarados en
`docs/daw/security/threat-FEAT-001.md` (navegador↔API, JS↔cookie httpOnly, backend↔PostgreSQL vía
Prisma, proceso↔variables de entorno, rol del JWT↔rol en DB). El único límite relevante que este
ticket ejercita es **navegador (no confiable) ↔ API NestJS** para el nuevo campo `name`, ya cubierto
por la regla existente: todo input se valida server-side con `class-validator`, nunca se confía en la
validación de `zod` del frontend.

## Datos sensibles (clasificación)

| Dato | Clasificación | Cifrado |
|---|---|---|
| `User.name` | PII (dato personal identificable, bajo) — mismo nivel que `email` en FEAT-001 | No cifrado en reposo (es un dato de despliegue interno, no público); tránsito sobre TLS |

## Análisis STRIDE

### `POST /users` (campo `name` nuevo)

| Categoría | Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|---|
| Tampering | `name` compuesto solo de espacios pasa `@IsNotEmpty` (que solo rechaza `''` literal) y queda vacío tras normalizar | Media | Bajo | 🟡 `users.service.ts` aplica `.trim()` antes de persistir (mismo patrón que `ClientsService`) y, si el resultado queda vacío, rechaza con `BadRequestException` — cierra el gap que `@IsNotEmpty` no cubre por sí solo (AC-02) |
| Denial of Service | Payload de `name` desproporcionadamente largo | Baja | Bajo | 🟢 `@MaxLength(100)` en `create-user.dto.ts` acota el input, igual que el resto de los campos de texto del proyecto |
| Information Disclosure | `name` es PII de bajo riesgo, igual que `email` | Baja | Bajo | 🟢 Mismo tratamiento que `email` en FEAT-001: sin cifrado en reposo (dato de negocio, no secreto), TLS en tránsito |
| Elevation of Privilege | N/A — `name` no participa en ninguna decisión de autorización | — | — | No aplica |

### `POST /auth/login` (respuesta extendida con `name`)

| Categoría | Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|---|
| Information Disclosure | Ninguno nuevo: `name` viaja en la respuesta de login del propio usuario autenticado (su propio dato), igual que ya ocurre con `email`/`role` | Baja | Bajo | 🟢 `user-response.dto.ts` sigue siendo el único punto que arma la respuesta pública de `User` — se extiende, no se bypassea |

### Migración `add_user_name` (schema + backfill)

| Categoría | Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|---|
| Denial of Service | `ALTER TABLE`/`UPDATE` bloquea brevemente la tabla `User` durante el despliegue | Baja (volumen de datos actual del proyecto es mínimo) | Bajo | 🟢 Sin mitigación adicional a esta escala; si el volumen de usuarios crece, revisar junto con el riesgo general de degradación de tiempos de respuesta ya declarado en el PRD general |
| Information Disclosure | El backfill deriva `name` de la parte local del email (`split_part(email,'@',1)`) para usuarios ya existentes | Baja | Bajo | 🟢 No expone nada que el Admin no viera ya (es quien ejecuta altas y ve emails); no existe en el alcance de este ticket ningún endpoint que liste `User.name` a roles no-Admin — a revisar cuando FEAT-003c exponga la composición de equipos a PM/Líder/Recurso |

### Frontend (`AdminCreateUserPage.tsx`, futuras vistas que rendericen `name`)

| Categoría | Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|---|
| Tampering (XSS almacenado) | Un `name` con marcado HTML/script se renderiza sin escapar en una vista futura (equipos, FEAT-003c) | Baja | Medio | 🟡 El proyecto no usa `dangerouslySetInnerHTML` en ningún componente existente; React escapa por defecto todo contenido de texto en JSX. Se documenta como restricción para FEAT-003c: `name` se renderiza siempre como texto plano |

## Riesgos aceptados

Ninguno. El único riesgo con impacto Medio (XSS almacenado vía `name`) queda mitigado por el
comportamiento por defecto de React (JSX escapa texto), no por una decisión de aceptar el riesgo.

## Mitigaciones a incorporar en el spec

1. `@IsString @IsNotEmpty @MaxLength(100)` en `create-user.dto.ts` para `name`.
2. `.trim()` de `name` en `users.service.ts` antes de persistir; si el resultado queda vacío,
   `BadRequestException` (cierra el gap de `@IsNotEmpty` sobre strings de solo espacios — nuevo
   test: "nombre de solo espacios" → 400).
3. Backfill de la migración vía `UPDATE "User" SET "name" = split_part(email, '@', 1) WHERE "name"
   IS NULL`, antes de `ALTER COLUMN "name" SET NOT NULL`.
4. `user-response.dto.ts`/`UserEntityLike` extendidos con `name`, manteniendo el whitelist explícito
   de campos (nunca se filtra `passwordHash`/`refreshTokenHash`).
5. Ningún componente del frontend usa `dangerouslySetInnerHTML` para `name` — se mantiene así en
   `AdminCreateUserPage.tsx` y se deja documentado para FEAT-003c.

---

┌─────────────────────────────────────────────────────────┐
│  /daw-threat-modeling — PASSED                            │
├─────────────────────────────────────────────────────────┤
│  Attack surfaces identified: 5                             │
│  Trust boundaries declared: 0 nuevos (reutiliza los 5 de   │
│    threat-FEAT-001.md)                                      │
│                                                              │
│  Risks:                                                     │
│    🟡 MEDIUM: 1 (XSS almacenado vía `name` en vistas         │
│       futuras — mitigado por el escape por defecto de React)│
│    🟡 MEDIUM: 1 (name de solo espacios queda vacío tras      │
│       trim — mitigado con guard en el service)               │
│    🟢 LOW: 5 (ver tablas STRIDE arriba)                      │
│                                                               │
│  Riesgos aceptados: 0                                        │
│                                                               │
│  Mitigations to fold into the spec: 5 (ver sección arriba)   │
│                                                               │
│  ─────────────────────────────────────────────────────────  │
│  Risks: C:0 H:0 M:2 L:5                                      │
│  Report: docs/daw/security/threat-FEAT-003a.md               │
└─────────────────────────────────────────────────────────────┘
