# PRD FEAT-002: Alta de clientes (RF-03)

| Field | Value |
|-------|-------|
| Ticket | FEAT-002 |
| Tracker | none |
| Date | 2026-08-05 |
| PRD loops | 0 |

## Context and Problem

Hoy no existe forma de registrar clientes en TabSum+. Sin clientes, los Líderes no pueden crear
tareas asociadas a un cliente (RF-06/RF-07) ni el sistema puede centralizar la información que hoy
vive dispersa en Drive y tableros propios. El PM es quien necesita dar de alta cada cliente antes de
que cualquier equipo pueda empezar a trabajar tareas asociadas a él.

Esta feature depende de FEAT-001 (autenticación y roles) ya implementada, y es la base de la que
dependen Equipos y Tareas, según el orden de dependencias del PRD general.

## Goals

Permitir que un PM registre clientes (nombre, descripción) de forma controlada, sin duplicados, para
que queden disponibles como referencia al crear tareas en tickets futuros.

## Functional Requirements

- FR-01: Un PM debe poder crear un cliente proporcionando nombre (máximo 30 caracteres) y
  descripción (máximo 255 caracteres), ambos campos obligatorios.
- FR-02: El sistema debe impedir la creación de un cliente cuyo nombre coincida, de forma
  case-insensitive, con el de un cliente ya existente (p. ej. "Acme" y "acme" se consideran el mismo
  nombre).
- FR-03: Solo un usuario con rol PM puede crear clientes; cualquier otro rol (Admin, Líder, Recurso)
  o un usuario no autenticado debe ser denegado.
- FR-04: Un PM debe poder visualizar la lista de clientes existentes (nombre y descripción), para
  poder verificar altas previas y evitar intentos de duplicado.

## Non-Functional Requirements

- NFR-01: La restricción de unicidad del nombre debe garantizarse a nivel de base de datos
  (constraint único, case-insensitive), no solo en la capa de validación de la aplicación, para
  evitar condiciones de carrera ante altas simultáneas con el mismo nombre.
- NFR-02: La creación y el listado de clientes deben estar protegidos por RBAC (rol PM), acorde a
  RNF-08 del PRD general.
- NFR-03: La operación de alta de cliente debe completarse en menos de 1 segundo, consistente con
  los tiempos de respuesta esperados para operaciones interactivas del PRD general.

## Acceptance Criteria

- AC-01 (FR-01): WHEN un PM envía un nombre (≤30 caracteres) y una descripción (≤255 caracteres)
  válidos y no duplicados, THE system SHALL crear el cliente y dejarlo disponible en el listado.
- AC-02 (FR-03): IF un usuario sin rol PM (o no autenticado) intenta crear un cliente, THEN THE
  system SHALL denegar la acción y mostrar un mensaje de acceso denegado (RF-30).
- AC-03 (FR-02): IF el nombre enviado coincide, de forma case-insensitive, con el de un cliente ya
  existente, THEN THE system SHALL rechazar el alta e informar al usuario que el nombre ya está en
  uso.
- AC-04 (FR-01): IF el nombre supera 30 caracteres o la descripción supera 255 caracteres, THEN THE
  system SHALL rechazar la solicitud con un error de validación.
- AC-05 (FR-01): IF el nombre o la descripción están vacíos, THEN THE system SHALL rechazar la
  solicitud con un error de validación.
- AC-06 (FR-04): WHEN un PM solicita el listado de clientes, THE system SHALL devolver todos los
  clientes existentes con su nombre y descripción.
- AC-07 (FR-04): WHILE el listado de clientes está vacío, THE system SHALL mostrar un estado vacío
  en lugar de una pantalla en blanco (RF-27).

## Out of Scope

- Edición del nombre/descripción de un cliente ya creado (fuera de alcance del MVP, ver PRD general).
- Baja (eliminación) de clientes ya creados (fuera de alcance del MVP, ver PRD general).
- Asociación de clientes a tareas o equipos (corresponde a tickets futuros: Tareas).
- Filtros, búsqueda o paginación avanzada sobre el listado de clientes (no lo exige RF-03; se
  contempla un listado simple).
- Restricción de visibilidad del listado para Recurso según RF-22 (esa regla aplica a la vista de
  tareas del Recurso, un ticket posterior — este ticket solo habilita la vista de PM).

## Risks and Mitigations

- Riesgo: condición de carrera si dos altas con el mismo nombre llegan simultáneamente → Mitigación:
  constraint único case-insensitive a nivel de base de datos (NFR-01), no solo validación en el
  service.
- Riesgo: crecimiento del listado de clientes sin paginación podría degradar el tiempo de carga →
  Mitigación: fuera de alcance por ahora (volumen bajo esperado en el MVP); se revisa si el PRD
  general lo requiere en RNF-01/02 cuando haya datos reales.

## Dependencies

- Depende de FEAT-001 (autenticación JWT, roles y RBAC) ya implementado.
- Es dependencia de Equipos y Tareas (RF-04 a RF-07), que necesitan clientes existentes para poder
  asociarlos.
