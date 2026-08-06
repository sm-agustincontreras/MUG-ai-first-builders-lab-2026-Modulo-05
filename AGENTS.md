# AGENTS.md — project context

> **DAW template.** Fill in the `[...]` with what is true of YOUR project and delete what does not
> apply. This file describes **the project**; **the process** is DAW's job (phases, gates, when to
> test, when to commit). Do not mix the two: process rules written here compete with the pipeline's.
>
> It is **tool-agnostic on purpose**: Claude Code reads it through the import in `CLAUDE.md`, Codex
> CLI, Copilot CLI, Cursor and OpenCode read it directly, and Gemini CLI gets it through
> `GEMINI.md`. The same file serves whichever tool you open the repo with — which is the point:
> porting the pipeline to another tool must not mean rewriting what your project is.

---

## Language

**Always respond in the language the user writes in.** Write every artifact you produce — PRDs,
specs, ADRs, reports, commit messages, status lines — in that same language, regardless of the
language these instructions are written in.

If this project has a fixed working language, state it here and use it instead:

> Working language: `Spanish — write all artifacts in Spanish`

---

## What this project is

TabSum+ es un software de organización para pymes: permite crear clientes, equipos, recursos y tareas, y visualizarlos en tableros/líneas de tiempo. Su objetivo es centralizar en un solo lugar la información que hoy PMs y líderes buscan dispersa en tableros propios y archivos de Drive.

**Reference PRD:** `docs/daw/prd/PRD.md`

---

## Stack

**This is the only place the stack lives.** DAW reads it from here and generates no derived file.
Fill it in even if the repo is empty: without a stack there is nothing to plan or implement against.

If the repo already has code and this section is empty, DAW will detect the stack from your config
files and **propose the text for you to paste here**. You always confirm it.

| Field | Value |
|-------|-------|
| Language | TypeScript |
| Runtime | Node.js 20 LTS |
| Framework (backend) | NestJS |
| Framework (frontend) | React + Vite |
| Database | PostgreSQL + Prisma (via Docker / docker-compose) |
| Package manager | npm |
| Install | `npm ci` (run in `backend/` and `frontend/`) |
| Test (backend) | `npm --prefix backend test` |
| Test (frontend) | `npm --prefix frontend test` |
| Typecheck (frontend) | `tsc -b --noEmit` (in `frontend/`) |

---

## Architecture conventions

**DAW validates your code against this section** during the CODE phase, via `daw-validate-arch`.
Leave it empty and that validation has nothing to compare against, so it stops being worth running.

- **Folder structure:** monorepo con `/backend` (NestJS, organizado por módulos: `controller` + `service` + `entity`/`dto` por dominio) y `/frontend` (React + Vite, organizado por `components`, `pages`, `hooks` y `services` de acceso a la API).
- **Layer separation:** en el backend, los controllers nunca acceden a Prisma directamente — siempre a través de un service. En el frontend, los componentes nunca llaman a la API directamente — siempre a través de la capa `services`.
- **Error handling:** en el backend, excepciones tipadas de NestJS (`HttpException` y sus subclases) capturadas por un exception filter global; nunca un catch silencioso. En el frontend, los errores de la API se propagan y se muestran al usuario, nunca se tragan.
- **Naming:** archivos en kebab-case (`user.service.ts`), clases y componentes en PascalCase, variables y funciones en camelCase.
- **Dependencies:** no se agregan librerías nuevas sin justificarlas en el spec.

---

## UI/Design conventions

**Principios:** denso pero legible (tableros con muchas tareas sin sentirse recargados), consistencia sobre creatividad (mismos patrones de botón/card/modal en todo el sistema), motion con propósito (ninguna animación es puramente decorativa).

**Paleta:**

| Uso | Color | Hex |
|---|---|---|
| Primario (acciones, links, foco) | Indigo | `#4F46E5` |
| Primario hover | Indigo oscuro | `#4338CA` |
| Texto principal | Slate 900 | `#0F172A` |
| Texto secundario | Slate 500 | `#64748B` |
| Fondo | Slate 50 | `#F8FAFC` |
| Superficie (cards, fondo de inputs) | Blanco | `#FFFFFF` |
| Bordes/separadores | Slate 200 | `#E2E8F0` |
| Estado *Pendiente* (RF-26) | Slate 400 | `#94A3B8` |
| Estado *En curso* (RF-26) | Blue 500 | `#3B82F6` |
| Estado *Entregada* (RF-26) | Green 500 | `#22C55E` |
| Error/denegado (RF-30) | Red 500 | `#EF4444` |
| Warning | Amber 500 | `#F59E0B` |

**Tipografía:** `Inter` (o `system-ui` de fallback). Escala 12/14/16/20/24/32px, pesos 400 (texto), 500 (labels), 600–700 (headings/CTAs).

**Layout:** escala de espaciado base 4px (4/8/12/16/24/32/48/64). Radio de borde 8px (inputs/botones), 12px (cards/modales), full (badges de estado). Sombras en 3 niveles (`sm` reposo, `md` hover, `lg` modal).

**Componentes clave:**
- Botones: primary (relleno indigo), secondary (outline), ghost, danger — transición de color/sombra en hover, nunca instantánea.
- Badges de estado: color semántico de la tabla de arriba (RF-26).
- Modal de confirmación (RF-28/29): overlay con blur, entrada fade + scale desde 0.95→1.
- Columnas de tablero (RF-11, RF-32): al arrastrar una tarjeta, elevación de sombra + escala 1.02; al soltar, transición suave a la posición final.
- Empty state (RF-27): ilustración simple + texto, nunca pantalla en blanco.
- Loading (RNF-11): skeleton screens en tableros/reportes, no solo spinners.

**Animación/fluidez:**
- Micro-interacciones (hover, foco): 150–200ms.
- Transiciones de layout (modal, panel, drag-drop): 250–300ms.
- Easing: `ease-out` en entradas, `ease-in` en salidas.
- Respetar `prefers-reduced-motion`.

**Nota sobre librerías:** adoptar algo como Framer Motion es una dependencia nueva y debe justificarse en el spec de la feature que la necesite (probablemente Tableros/RF-32), documentada con un ADR. Con CSS transitions puro también se puede cumplir esta guía sin dependencias nuevas.

---

## Code conventions

- **Convención de DTOs:** `class-validator` + `class-transformer` en los DTOs de NestJS para validar el contrato de cada endpoint en el backend, independiente de cualquier validación que exista en el frontend (que usa `zod`).

---

## What NOT to do in this project

This section is worth its weight in gold: it is where the scars go, the things that already went
wrong once.

- No implementar registro de horas trabajadas (timesheet) por tarea: solo estimación y deadline.
- No implementar facturación ni gestión de costos/tarifas de clientes, recursos o tareas.
- No implementar dependencias entre tareas (bloqueos, predecesoras/sucesoras) ni gestión de RRHH (horas extra, licencias, ausentismo).

---

> ℹ️ **What does NOT belong in this file, because DAW provides it:** the order work happens in, when
> the spec gets written, when tests run, when to commit, what it takes to move between phases. All
> of that lives in `.daw/` and applies on its own.

<!-- BEGIN DAW (managed by DAW — do not edit by hand) -->
# DAW — Dilux Agentic Workflow

This repo uses **DAW**: an agent-driven development pipeline with the phases
`CLASSIFY → DEFINE → PLAN → CODE → VERIFY → RELEASE`.

Before answering, read `.daw/orchestrator.md` and run its Boot Sequence. It is a strict state
machine: it decides what you are allowed to do based on the phase recorded in `.daw-state.json`.

The project's own context — stack, architecture, domain — is elsewhere in this file. It lives here,
in `AGENTS.md`, and not in any one tool's file, on purpose: it is tool-agnostic and comes along
unchanged when the pipeline is ported to another agent.
<!-- END DAW -->
