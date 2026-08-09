# Changelog

Todos los cambios notables de este proyecto se documentan en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [Unreleased]

### Added
- [FEAT-001] Autenticación y alta de usuarios: login/refresh/logout con JWT (access 15min,
  refresh 7d rotativo con detección de reuso), alta de usuarios con RBAC (solo Admin), seed
  idempotente del Admin inicial, y UI de autenticación (React + Vite) consumiendo la API vía
  capa de servicios.
- [FEAT-002] Alta de clientes: creación y listado de clientes por PM (nombre ≤30, descripción
  ≤255, unicidad case-insensitive garantizada a nivel de base de datos), RBAC restringido a PM,
  y UI (`PMClientsPage`) que aplica por primera vez los tokens de diseño (paleta, tipografía,
  espaciado) definidos en `AGENTS.md`.
- [FEAT-003a] `name` obligatorio en `User` (1-100 caracteres): migración con backfill para
  usuarios existentes, alta de usuario por Admin exige nombre, expuesto en las respuestas de
  login y creación, seed del Admin inicial con `name: 'Admin'`, y campo de formulario en
  `AdminCreateUserPage`. Base para mostrar nombres legibles en la composición de equipos
  (siguientes sub-tickets FEAT-003b/c).
  
### Fixed
- [FIX-001] Al cerrar sesión desde `/home`, la UI no redirigía a `/login` (la ruta no estaba
  protegida por `ProtectedRoute`, a diferencia de `/admin/users`).