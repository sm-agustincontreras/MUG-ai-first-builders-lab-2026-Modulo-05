# PRD FEAT-003c: Composición de equipos

| Field | Value |
|-------|-------|
| Ticket | FEAT-003c |
| Tracker | none |
| Date | 2026-08-07T22:13:14Z |
| PRD loops | 1 |

## Context and Problem

Con equipos y recursos ya asignables (FEAT-003b), PM, Líderes y Recursos necesitan poder consultar
quién compone cada equipo del sistema, no solo el propio: hoy esa información vive dispersa
(Drive, consultas directas a la PM), que es exactamente el problema que TabSum+ busca resolver.
Este ticket cubre RF-20 (PM/Líder, con acceso a las acciones de FEAT-003b) y RF-21 (Recurso, en
modo exclusivamente lectura).

## Goals

Que PM, Líder y Recurso puedan consultar la composición de todos los equipos del sistema (nombre,
descripción, dueño y miembros) sin necesidad de preguntarle a nadie, con el Recurso limitado a
solo lectura.

## Functional Requirements

- FR-01: Un PM o un Líder puede consultar la composición de todos los equipos del sistema
  (nombre, descripción, dueño y lista de miembros, todos identificados por nombre).
- FR-02: Un Recurso puede consultar la misma composición de todos los equipos del sistema, en modo
  exclusivamente de lectura, sin acceso a las acciones de creación de equipo o asignación de
  recursos (esas acciones pertenecen a FEAT-003b y están restringidas a LEADER).

## Non-Functional Requirements

- NFR-01: La consulta de composición de equipos requiere sesión autenticada; un usuario no
  autenticado recibe acceso denegado.
- NFR-02: La consulta debe completarse en menos de 1 segundo, consistente con FEAT-002 (NFR-03).

## Acceptance Criteria

- AC-01 (FR-01): WHEN un PM o un Líder solicita la composición de todos los equipos, THE system
  SHALL devolver, para cada equipo, su nombre, descripción, dueño (nombre) y lista de miembros
  (nombre).
- AC-02 (FR-02): WHEN un Recurso solicita la composición de todos los equipos, THE system SHALL
  devolverla en modo solo lectura, sin exponer acciones de creación de equipo ni de asignación de
  miembros.
- AC-03 (FR-01): IF un usuario no autenticado solicita la composición de los equipos, THEN THE
  system SHALL denegarle el acceso.
- AC-04 (FR-01): WHILE no existe ningún equipo creado, THE system SHALL mostrar un estado vacío en
  lugar de una pantalla en blanco (RF-27).

## Out of Scope

- Cualquier acción de edición, creación de equipo o asignación/desasignación de recursos
  (pertenece a FEAT-003b).
- Filtros o búsqueda sobre el listado de equipos.
- Composición de equipos en el contexto de tareas o tablero (Grupos 2 y 3 del roadmap propuesto).

## Risks and Mitigations

- Riesgo: ninguno adicional a los ya mitigados en FEAT-003a/b (backfill de `name`, unicidad de
  nombre de equipo); este ticket es de solo lectura sobre datos ya validados.

## Dependencies

- Depende de FEAT-003a (`User.name`, para identificar dueño y miembros por nombre).
- Depende de FEAT-003b (equipos y miembros ya existentes para poder listarlos).
- Depende de FEAT-002 (límite de <1s reutilizado en NFR-02).
