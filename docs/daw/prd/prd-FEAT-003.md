# Parent PRD: Equipos — alta, asignación de recursos y composición

| Metric | Value |
|--------|-------|
| Ticket | FEAT-003 |
| Date | 2026-08-07T22:13:14Z |
| Status | Split |

## Sub-tickets

| Sub-ticket | Title | PRD | Dependencies | Status |
|---|---|---|---|---|
| FEAT-003a | User.name obligatorio | prd-FEAT-003a.md | none | done — PR #6 (draft), branch `feat/FEAT-003a-user-name` |
| FEAT-003b | Alta de equipos y asignación de recursos | prd-FEAT-003b.md | depends on a | done — PR #7 (draft) contra `feat/FEAT-003a-user-name`; se mergea a mano en orden (PR #6 primero, luego #7) |
| FEAT-003c | Composición de equipos | prd-FEAT-003c.md | depends on b | done — PR #9 (draft), branch `feat/FEAT-003c-composicion-equipos`; se mergea cuando el PR se mergee. Último sub-ticket del split de FEAT-003 — a/b/c completos. |

## Suggested implementation order

a → b → c

## Original context

TabSum+ no tiene el concepto de Equipo. Sin equipos no hay forma de agrupar Recursos bajo un
Líder, y sin esa agrupación no se puede avanzar con tareas (RF-06 a RF-10) ni con el tablero
(RF-11, RF-12) — el PRD general declara esta dependencia explícitamente. Además, al momento de
diseñar la composición de un equipo se detectó que `User` no tiene un campo `name` (solo `email`),
lo que dejaría las listas de miembros/dueños sin un nombre legible. El PRD original cubría de una
sola vez: (1) agregar `name` a `User`, (2) creación de equipos y asignación de recursos por un
Líder, y (3) visualización de la composición de todos los equipos por PM/Líder/Recurso — 14
criterios de aceptación sobre 3 módulos distintos (usuarios, equipos backend, equipos frontend).
Se dividió en tres sub-tickets independientemente entregables, en el orden en que se necesitan.
