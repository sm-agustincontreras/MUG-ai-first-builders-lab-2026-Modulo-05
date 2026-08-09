# PRD FEAT-003a: User.name obligatorio

| Field | Value |
|-------|-------|
| Ticket | FEAT-003a |
| Tracker | none |
| Date | 2026-08-07T22:13:14Z |
| PRD loops | 0 |

## Context and Problem

`User` hoy solo tiene `email` como identificador visible; no existe un campo `name`. Al diseñar la
composición de equipos (FEAT-003b/c) esto dejaría las listas de dueño/miembros mostrando solo
emails, sin un nombre legible. Este ticket agrega `name` como campo obligatorio de `User`, ajusta
el alta de usuario por Admin y el seed inicial, y resuelve el backfill de los registros ya
existentes en bases de datos con datos previos (de FEAT-001/FEAT-002).

## Goals

Que todo usuario tenga un nombre legible desde su alta, sin dejar inconsistente ningún registro ya
existente, como base para mostrar nombres (en vez de emails) en las features de Equipos.

## Functional Requirements

- FR-01: El alta de usuario por un Admin exige un nombre (`name`) no vacío, de máximo 100
  caracteres, además de email, contraseña y rol ya existentes.
- FR-02: El seed inicial del Admin crea ese usuario con `name = "Admin"`.
- FR-03: La migración que agrega `name` a `User` completa con un valor por defecto cualquier
  registro ya existente que no lo tenga, de forma que ningún registro quede con `name` nulo.

## Non-Functional Requirements

- NFR-01: Tras aplicar la migración, el 100% de los registros de `User` deben tener un valor no
  nulo en `name`.
- NFR-02: El alta de usuario con nombre debe completarse en menos de 1 segundo, consistente con
  los tiempos de respuesta esperados del PRD general.

## Acceptance Criteria

- AC-01 (FR-01): WHEN un Admin da de alta un usuario con un nombre no vacío de hasta 100
  caracteres, THE system SHALL crear el usuario con ese nombre.
- AC-02 (FR-01): IF el nombre está vacío o supera 100 caracteres, THEN THE system SHALL rechazar
  la solicitud con un error de validación.
- AC-03 (FR-02): WHEN se ejecuta el seed inicial y no existe ningún Admin, THE system SHALL crear
  el Admin con `name = "Admin"`.
- AC-04 (FR-03): IF la migración corre sobre una base de datos con usuarios existentes sin `name`,
  THEN THE system SHALL completar ese campo con un valor por defecto para cada uno de ellos.
- AC-05 (FR-03): WHEN la migración finaliza, THE system SHALL garantizar que el 100% de los
  registros de `User` tengan `name` no nulo.

## Out of Scope

- Edición del nombre de un usuario después del alta (fuera de alcance del MVP).
- Unicidad del nombre de usuario (no se exige; `email` sigue siendo el identificador único).
- Mostrar `name` en las listas de equipos/recursos (corresponde a FEAT-003b/FEAT-003c).

## Risks and Mitigations

- Riesgo: agregar `name` obligatorio puede dejar inconsistentes los registros ya creados en bases
  de datos existentes (dev/staging con datos de FEAT-001/FEAT-002) → mitigación: la migración
  incluye un backfill con valor por defecto (FR-03, AC-04, AC-05).

## Dependencies

- Depende de FEAT-001 (modelo `User`, alta de usuario por Admin, seed inicial).
