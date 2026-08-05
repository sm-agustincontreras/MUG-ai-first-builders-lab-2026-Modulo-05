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
