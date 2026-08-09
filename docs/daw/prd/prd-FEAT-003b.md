# PRD FEAT-003b: Alta de equipos y asignación de recursos

| Field | Value |
|-------|-------|
| Ticket | FEAT-003b |
| Tracker | none |
| Date | 2026-08-07T22:13:14Z |
| PRD loops | 0 |

## Context and Problem

TabSum+ no tiene el concepto de Equipo. Un Líder necesita poder crear equipos y asignarles
recursos antes de que puedan existir tareas asociadas a un equipo (RF-06 a RF-10) o un tablero por
equipo (RF-11). Este ticket cubre RF-04 y RF-05 del PRD general: creación de equipos por un Líder
(quedando como dueño) y asignación de recursos libres a esos equipos.

## Goals

Permitir que un Líder cree uno o más equipos de trabajo y les asigne recursos que no pertenezcan
ya a otro equipo, sentando la base de datos que las features de tareas y tablero van a reutilizar.

## Functional Requirements

- FR-01: Un Líder autenticado puede crear un equipo de trabajo indicando nombre (máximo 30
  caracteres) y descripción (máximo 255 caracteres), ambos obligatorios, quedando registrado como
  su dueño y sin miembros.
- FR-02: El sistema impide la creación de un equipo cuyo nombre coincida, de forma
  case-insensitive, con el de un equipo ya existente (mismo patrón `nameNormalized` de `Client`,
  FEAT-002).
- FR-03: Un Líder puede ser dueño de más de un equipo de forma simultánea.
- FR-04: Un Líder puede asignar un recurso existente (usuario con rol RESOURCE) a un equipo del
  que es dueño, siempre que ese recurso no pertenezca ya a otro equipo.
- FR-05: Un Líder puede consultar la lista de recursos libres (rol RESOURCE, sin equipo asignado)
  para elegir a quién asignar a uno de sus equipos.

## Non-Functional Requirements

- NFR-01: La restricción de unicidad del nombre de equipo debe garantizarse a nivel de base de
  datos (constraint único, case-insensitive), no solo en la capa de validación de la aplicación,
  igual que `Client` (FEAT-002).
- NFR-02: Solo un usuario autenticado con rol LEADER puede crear equipos y asignar recursos
  (RNF-08 del PRD general).
- NFR-03: Solo un usuario autenticado con rol LEADER puede consultar la lista de recursos libres.
- NFR-04: La creación de un equipo y la asignación de un recurso deben completarse en menos de 1
  segundo, consistente con FEAT-002 (NFR-03).

## Acceptance Criteria

- AC-01 (FR-01): WHEN un Líder crea un equipo con un nombre único (≤30 caracteres) y una
  descripción (≤255 caracteres) válidos, THE system SHALL crear el equipo con ese Líder como
  dueño y sin miembros.
- AC-02 (FR-01): IF el nombre supera 30 caracteres, la descripción supera 255 caracteres, o
  alguno de los dos está vacío, THEN THE system SHALL rechazar la solicitud con un error de
  validación.
- AC-03 (FR-01): IF un usuario sin rol LEADER (o no autenticado) intenta crear un equipo, THEN
  THE system SHALL denegarle el acceso.
- AC-04 (FR-02): IF un Líder intenta crear un equipo cuyo nombre ya existe (normalizado,
  case-insensitive), THEN THE system SHALL rechazar la creación e informar que el nombre ya está
  en uso.
- AC-05 (FR-03): WHEN un Líder que ya es dueño de un equipo crea un segundo equipo, THE system
  SHALL permitirlo y registrar a ese Líder como dueño de ambos.
- AC-06 (FR-04): WHEN un Líder asigna un recurso libre (sin equipo) a un equipo del que es dueño,
  THE system SHALL agregar a ese recurso como miembro del equipo.
- AC-07 (FR-04): IF un Líder intenta asignar un recurso que ya pertenece a otro equipo, THEN THE
  system SHALL denegar la asignación.
- AC-08 (FR-04): IF un Líder intenta asignar un recurso a un equipo del que no es dueño, THEN THE
  system SHALL denegar la asignación.
- AC-09 (FR-05): WHEN un Líder solicita la lista de recursos para asignar, THE system SHALL
  devolver únicamente usuarios con rol RESOURCE que no pertenecen a ningún equipo.
- AC-10 (FR-05): IF un usuario no autenticado o sin rol LEADER solicita la lista de recursos
  libres, THEN THE system SHALL denegarle el acceso.

## Out of Scope

- Desasignar (quitar) un recurso de un equipo, o transferirlo de un equipo a otro.
- Edición del nombre o la descripción de un equipo ya creado.
- Baja (eliminación) de un equipo.
- Un endpoint que liste "todos los recursos con su estado de ocupación"; solo se expone la lista
  de libres (FR-05).
- Visualizar la composición de equipos ajenos al propio Líder (corresponde a FEAT-003c).
- Gestión de tareas y tablero (Grupos 2 y 3 del roadmap propuesto).

## Risks and Mitigations

- Riesgo: la unicidad del nombre de equipo puede chocar con mayúsculas/espacios si no se
  normaliza → mitigación: reutilizar el mismo patrón `nameNormalized` ya validado en `Client`
  (FEAT-002).

## Dependencies

- Depende de FEAT-001 (autenticación JWT, RBAC, modelo `User`).
- Depende de FEAT-002 (patrón de unicidad normalizada usado en `Client`, reutilizado para el
  nombre de equipo).
- Depende de FEAT-003a (campo `User.name`), para que el dueño y los miembros del equipo puedan
  identificarse con un nombre legible desde que existen.
