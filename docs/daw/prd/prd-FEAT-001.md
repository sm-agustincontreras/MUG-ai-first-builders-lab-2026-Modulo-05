# PRD FEAT-001: Autenticación y alta de usuarios

| Field | Value |
|-------|-------|
| Ticket | FEAT-001 |
| Tracker | none |
| Date | 2026-08-05 |
| PRD loops | 0 |

## Contexto y Problema

TabSum+ (ver `docs/daw/prd/PRD.md`, PRD-003) requiere que todo usuario (PM, Líder, Recurso, Admin)
se autentique antes de acceder a cualquier funcionalidad (RF-01), y que sea un Admin quien dé de
alta las cuentas de PM, Líder y Recurso (RF-02) — no existe autorregistro. Esta es la primera
funcionalidad a construir porque el resto de los requerimientos del PRD general (clientes, equipos,
tareas, tableros) dependen de que ya existan usuarios autenticados con un rol asignado.

Un problema no resuelto por el PRD general: si solo un Admin puede crear cuentas, ¿cómo se crea la
primera cuenta Admin del sistema? Este PRD lo resuelve con un seed inicial (ver FR-06).

## Objetivos

Permitir que cualquier usuario del sistema inicie sesión de forma segura y que un Admin pueda dar de
alta cuentas de PM, Líder y Recurso, sentando la base de autenticación y roles sobre la que se
construirán el resto de las funcionalidades del producto.

## Requerimientos Funcionales

- FR-01: El sistema debe permitir a un usuario autenticarse con email y contraseña, devolviendo un
  access token y un refresh token cuando las credenciales son válidas
- FR-02: El sistema debe denegar el acceso a cualquier endpoint protegido cuando la petición no
  incluye un access token válido
- FR-03: Un Admin debe poder crear una cuenta de usuario indicando email, contraseña inicial y rol
  (PM, Líder o Recurso)
- FR-04: El sistema debe rechazar la creación de una cuenta de usuario cuando la solicitante no
  tiene rol Admin
- FR-05: El sistema debe permitir a un usuario autenticado cerrar sesión, invalidando su refresh
  token
- FR-06: El sistema debe crear, mediante un script de seed ejecutado una única vez sobre una base de
  datos vacía, una cuenta Admin inicial con credenciales tomadas de variables de entorno
- FR-07: El sistema debe rechazar la creación de una cuenta de usuario cuando el email ya está
  registrado

## Requerimientos No Funcionales

- NFR-01: Las contraseñas deben almacenarse hasheadas (bcrypt o equivalente), nunca en texto plano
  (RNF-07 del PRD general)
- NFR-02: El access token debe expirar a los 15 minutos y el refresh token a los 7 días (RNF-03 del
  PRD general)
- NFR-03: El sistema debe exponer los roles de usuario (PM, Líder, Recurso, Admin) de forma que
  features posteriores puedan implementar RBAC sobre ellos (base de RNF-08 del PRD general; el RBAC
  completo sobre cada recurso queda fuera de alcance de este ticket)
- NFR-04: El sistema debe mostrar un mensaje de error comprensible cuando la autenticación falla o
  se deniega el acceso por rol insuficiente (RNF-12 / RF-30 del PRD general)

## Criterios de Aceptación

- AC-01 (FR-01): WHEN un usuario envía email y contraseña válidos al endpoint de login, THE sistema
  SHALL responder con un access token y un refresh token.
- AC-02 (FR-01): IF un usuario envía credenciales inválidas al endpoint de login, THEN THE sistema
  SHALL rechazar la solicitud sin indicar si el email o la contraseña fue el dato incorrecto.
- AC-03 (FR-02): IF una petición a un endpoint protegido no incluye un access token válido, THEN THE
  sistema SHALL denegar el acceso con un mensaje explicando el motivo (no autenticado).
- AC-04 (FR-03): WHEN un Admin crea una cuenta de usuario con email, contraseña y rol válidos, THE
  sistema SHALL crear la cuenta y permitir que ese usuario se autentique con el rol asignado.
- AC-05 (FR-04): IF un usuario sin rol Admin intenta crear una cuenta de usuario, THEN THE sistema
  SHALL denegar la operación con un mensaje explicando el motivo (rol insuficiente).
- AC-06 (FR-07): IF se intenta crear una cuenta de usuario con un email ya registrado, THEN THE
  sistema SHALL rechazar la operación sin crear un duplicado.
- AC-07 (FR-05): WHEN un usuario autenticado cierra sesión, THE sistema SHALL invalidar su refresh
  token, de forma que no pueda usarse para obtener nuevos access tokens.
- AC-08 (FR-06): WHEN se ejecuta el seed sobre una base de datos vacía, THE sistema SHALL crear una
  única cuenta Admin con las credenciales provistas por variables de entorno.
- AC-09 (FR-06): IF el seed se ejecuta sobre una base de datos que ya tiene un Admin, THEN THE
  sistema SHALL
  no crear una cuenta duplicada.

## Fuera de Alcance

- Recuperación/reseteo de contraseña ("olvidé mi contraseña") — no está en el PRD general, queda
  para una futura iteración
- Listado o edición de cuentas de usuario existentes por parte del Admin — RF-02 solo pide poder
  crear cuentas, no administrarlas
- RBAC aplicado a recursos de negocio (clientes, equipos, tareas) — se construye en las features que
  introduzcan esos recursos, apoyándose en los roles que este ticket expone (NFR-03)
- Vista de inicio (home) diferenciada por rol (RF-25) — corresponde a una feature posterior una vez
  que existan pantallas por rol
- Autorregistro (sign-up) de cualquier rol — explícitamente fuera de alcance en el PRD general

## Riesgos y Mitigaciones

- Riesgo: si las credenciales del Admin seed quedan hardcodeadas o en el repo, se filtran fácilmente
  → mitigación: se toman exclusivamente de variables de entorno, nunca de un valor por defecto en
  código.
- Riesgo: invalidar solo el refresh token en logout deja el access token vigente hasta su expiración
  (máx. 15 min) → mitigación aceptada dado el bajo TTL definido en NFR-02; no se implementa una
  blocklist de access tokens en este ticket.

## Dependencias

- `docs/daw/prd/PRD.md` (PRD-003, PRD general del producto): este ticket implementa el recorte de
  RF-01, RF-02, RF-24, RNF-03, RNF-07, RNF-08 y RNF-12 correspondiente a autenticación y alta de
  usuarios. No depende de ningún otro ticket — es el primero del proyecto. El resto de los
  requerimientos del PRD general (RF-03 en adelante) dependen de que este ticket esté implementado.
