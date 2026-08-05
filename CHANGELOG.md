# Changelog

Todos los cambios notables de este proyecto se documentan en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [Unreleased]

### Added
- [FEAT-001] Autenticación y alta de usuarios: login/refresh/logout con JWT (access 15min,
  refresh 7d rotativo con detección de reuso), alta de usuarios con RBAC (solo Admin), seed
  idempotente del Admin inicial, y UI de autenticación (React + Vite) consumiendo la API vía
  capa de servicios.
