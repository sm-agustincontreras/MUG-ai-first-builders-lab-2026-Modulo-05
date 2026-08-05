# PRD-003: TabSum+ — Es un software que permite llevar adelante la organización de una pyme, a partir de la creación de grupos y tareas.

## Contexto y Problema
Los equipos de trabajo de una pyme necesitan tener organización a largo plazo, para saber cómo distribuir sus recursos y cómo llevar adelante sus futuros proyectos. Los líderes recaen constantemente en las preguntas internas para obtener información de recursos: "¿Juan está libre para tomar un tema del cliente?", "¿Se entregó este desarrollo?", "¿Cuánto tiempo más va a estar ocupada María con la resolución del issue?". Hoy cada uno de los equipos de la pyme maneja su propio tablero, pero no hay un lugar donde todo converja, sino que cada líder termina consultando a la PM para obtener dicha información o consultando archivos que se dejan en Drive para ver las tareas del cliente. Necesitamos un sistema que nos permita ver esto en un único lugar, y poder organizar los recursos de una manera mucho más sencilla y práctica para todos los involucrados.

Involucrados:
- Recurso: una persona encargada de llevar adelante una tarea y definir cuándo se terminará la misma. Pertenece a un único Equipo a la vez. Quiere poder estimar sus tareas y reflejar su avance.
- Líder: está a cargo de recursos, controla, asigna y crea distintas tareas a cada uno de sus recursos. Quiere poder ver en qué trabaja su equipo.
- Equipo: conformado por un líder (dueño) y recursos, trabajan en un mismo espacio para llevar adelante sus tareas.
- PM: quiere poder crear clientes. Le interesa poder ver todos los equipos y saber en qué tareas está cada recurso.
- Admin: encargado de dar de alta las cuentas de usuario (PM, Líder, Recurso) para que puedan acceder al sistema.

## Objetivos
Centralizar en un único sistema la información de clientes, equipos y tareas, de manera que un líder o una PM puedan responder por sí mismos preguntas de disponibilidad y estado de entrega de recursos y tareas (quién está libre, qué se entregó, cuánto falta) sin necesidad de consultarse entre sí ni de revisar archivos externos (Drive, tableros propios de cada equipo).

## Requerimientos Funcionales
- RF-01: El sistema debe exigir autenticación a todo usuario (PM, Líder, Recurso, Admin) para acceder a cualquier funcionalidad
- RF-02: Un Admin debe poder crear una cuenta de usuario asignándole un rol (PM, Líder o Recurso)
- RF-03: Un PM debe poder crear un cliente (nombre, descripción)
- RF-04: Un Líder debe poder crear un equipo de trabajo (nombre, descripción), quedando como su dueño
- RF-05: Un Líder debe poder asignar un recurso existente, que no pertenezca ya a otro equipo, a un equipo de trabajo del que es dueño
- RF-06: Un Líder debe poder crear una tarea para un recurso de su equipo (nombre, descripción, cliente, recurso, deadline)
- RF-07: Un Líder debe poder crear una tarea sin un recurso asignado (nombre, descripción, cliente, deadline)
- RF-08: Un Recurso debe poder tomar una tarea sin asignación dentro de su propio equipo
- RF-09: Un Recurso debe poder estimar, en días, una tarea que tiene asignada
- RF-10: Un Recurso debe poder actualizar el estado de una tarea que tiene asignada (Pendiente / En curso / Entregada)
- RF-11: El sistema debe permitir a un Líder y a los recursos de su equipo visualizar las tareas de su equipo en un tablero
- RF-12: El sistema debe permitir a un PM visualizar las tareas de todos los equipos en un tablero
- RF-13: El sistema debe permitir a un PM/Líder/Recurso filtrar el tablero por cliente
- RF-14: El sistema debe permitir a un PM/Líder/Recurso filtrar el tablero por recurso
- RF-15: El sistema debe permitir a un PM/Líder/Recurso generar en pantalla un reporte con el listado de tareas visibles para su rol
- RF-16: El sistema debe permitir a un PM/Líder/Recurso filtrar el reporte de tareas por cliente
- RF-17: El sistema debe permitir a un PM/Líder/Recurso filtrar el reporte de tareas por recurso
- RF-18: El sistema debe permitir a un PM/Líder/Recurso filtrar el reporte de tareas por equipo
- RF-19: El sistema debe permitir a un PM/Líder/Recurso filtrar el reporte de tareas por rango de fechas de deadline
- RF-20: El sistema debe permitir a un PM y a un Líder visualizar la composición de todos los equipos
- RF-21: El sistema debe permitir a un Recurso consultar la composición de todos los equipos en modo solo lectura, sin poder modificarla
- RF-22: El sistema debe permitir a un Recurso ver únicamente los clientes asociados a las tareas que tiene asignadas, sin acceso a la lista completa de clientes
- RF-23: El sistema debe permitir a un Líder consultar la lista de recursos existentes (usuarios con rol Recurso) para poder seleccionarlos al asignarlos a un equipo de trabajo
- RF-24: El sistema debe permitir a todo usuario autenticado (PM, Líder, Recurso, Admin) cerrar su sesión (desloguearse)
- RF-25: El sistema debe presentar una vista de inicio (home) diferenciada según el rol del usuario autenticado (PM, Líder, Recurso, Admin)
- RF-26: El sistema debe distinguir visualmente el estado de una tarea (Pendiente / En curso / Entregada) en el tablero mediante color o ícono
- RF-27: El sistema debe mostrar un estado vacío (empty state) cuando un tablero, reporte o listado no tenga elementos para mostrar
- RF-28: El sistema debe solicitar confirmación al usuario antes de ejecutar una acción irreversible (tomar una tarea, cambiar su estado)
- RF-29: El sistema debe presentar la confirmación de una acción irreversible mediante un modal/popup que bloquee la interacción con el resto de la pantalla hasta que el usuario confirme o cancele
- RF-30: El sistema debe mostrar un mensaje claro cuando deniegue el acceso a una funcionalidad por falta de autenticación o de permisos de rol
- RF-31: Un Líder debe poder actualizar el estado de cualquier tarea de un equipo del que es dueño (Pendiente / En curso / Entregada)
- RF-32: El sistema debe permitir cambiar el estado de una tarea arrastrándola (drag-and-drop) entre las columnas del tablero correspondientes a los estados Pendiente, En curso y Entregada

## Requerimientos No Funcionales
- RNF-01: Los filtros deben aplicarse en < 2 segundos para tableros con hasta 100 tareas
- RNF-02: Los reportes deben generarse en < 2 segundos para conjuntos de hasta 100 tareas
- RNF-03: Debe usar JWT para manejar las sesiones, con access token de 15 minutos y refresh token de 7 días
- RNF-04: El sistema debe soportar al menos 50 sesiones concurrentes
- RNF-05: La carga de los tableros con 100 tareas debe renderizarse en < 1 segundo
- RNF-06: La disponibilidad mínima debe ser de 99%, medida de lunes a viernes de 9 a 18h (hora local)
- RNF-07: Las contraseñas deben almacenarse hasheadas
- RNF-08: Se debe implementar RBAC para evitar ediciones y visualizaciones no permitidas, restringiendo el acceso de cada rol según su alcance (clientes, composición de equipos, tableros y reportes)
- RNF-09: El sistema debe contar con una interfaz gráfica web (GUI) que permita a los usuarios interactuar con todas las funcionalidades sin necesidad de acceder directamente a la base de datos o usar la API por fuera de la interfaz
- RNF-10: El sistema debe estar diseñado para uso exclusivo en desktop, con una resolución mínima soportada de 1280px de ancho; no se contempla una versión mobile ni tablet en esta versión
- RNF-11: El sistema debe mostrar un indicador de carga mientras se obtienen los datos de tableros y reportes
- RNF-12: El sistema debe mostrar un mensaje de error comprensible cuando una acción o solicitud no pueda completarse

## Criterios de Aceptación
- AC-01 (RF-01): Dado un usuario no autenticado, cuando intenta acceder a cualquier funcionalidad del sistema, entonces el sistema debe denegarle el acceso
- AC-02 (RF-02): Dado un Admin, cuando crea una cuenta de usuario y le asigna un rol, entonces el usuario debe poder autenticarse con ese rol
- AC-03 (RF-02): Dado un usuario que no tiene rol Admin, cuando intenta crear una cuenta de usuario, entonces el sistema debe denegarle el acceso
- AC-04 (RF-03): Dado un PM, cuando crea un cliente, entonces el cliente debe quedar disponible para ser elegido por los líderes al crear tareas
- AC-05 (RF-04): Dado un Líder, cuando crea un equipo de trabajo con nombre y descripción, entonces el equipo debe quedar creado sin recursos asignados y con ese Líder como dueño
- AC-06 (RF-05): Dado un Líder, cuando asigna un recurso existente a un equipo del que es dueño, entonces el recurso debe quedar listado como miembro de ese equipo
- AC-07 (RF-05): Dado un Líder, cuando intenta asignar un recurso a un equipo del que no es dueño, entonces el sistema debe denegárselo
- AC-08 (RF-05): Dado un Líder, cuando intenta asignar a un equipo un recurso que ya pertenece a otro equipo, entonces el sistema debe denegárselo
- AC-09 (RF-06): Dado un Líder, cuando crea una tarea para un recurso de un equipo del que es dueño, entonces la tarea debe quedar asignada a ese recurso con el deadline especificado
- AC-10 (RF-06): Dado un Líder, cuando intenta crear una tarea para un recurso de un equipo del que no es dueño, entonces el sistema debe denegárselo
- AC-11 (RF-07): Dado un Líder, cuando crea una tarea sin especificar un recurso, entonces la tarea debe quedar creada sin asignación
- AC-12 (RF-08): Dado un Recurso, cuando toma una tarea sin asignación de su propio equipo, entonces la tarea debe quedar asignada a él
- AC-13 (RF-08): Dado un Recurso, cuando intenta tomar una tarea sin asignación que pertenece a otro equipo, entonces el sistema debe impedírselo
- AC-14 (RF-09): Dado un Recurso con una tarea asignada, cuando la estima en días, entonces el sistema debe guardar la estimación
- AC-15 (RF-10): Dado un Recurso con una tarea asignada, cuando actualiza su estado a Entregada, entonces el tablero debe reflejar ese estado
- AC-16 (RF-11): Dado un Líder o un Recurso, cuando ingresa al sistema, entonces debe poder visualizar las tareas de su equipo en un tablero
- AC-17 (RF-11): Dado un Líder, cuando intenta visualizar el tablero de un equipo del que no es dueño, entonces el sistema debe denegarle el acceso
- AC-18 (RF-12): Dado un PM, cuando ingresa al sistema, entonces debe poder visualizar las tareas de todos los equipos en un tablero
- AC-19 (RF-13): Dado un PM/Líder/Recurso, cuando aplica un filtro por cliente en un tablero, entonces debe ver solo las tareas de ese cliente
- AC-20 (RF-14): Dado un PM/Líder/Recurso, cuando aplica un filtro por recurso en un tablero, entonces debe ver solo las tareas de ese recurso
- AC-21 (RF-15): Dado un PM/Líder/Recurso, cuando genera un reporte sin filtros, entonces el sistema debe mostrar en pantalla el listado de tareas visibles para su rol, con nombre, cliente, recurso, equipo, estado, estimación y deadline
- AC-22 (RF-16): Dado un PM/Líder/Recurso, cuando filtra el reporte por cliente, entonces el listado debe mostrar solo las tareas de ese cliente
- AC-23 (RF-17): Dado un PM/Líder/Recurso, cuando filtra el reporte por recurso, entonces el listado debe mostrar solo las tareas de ese recurso
- AC-24 (RF-18): Dado un PM/Líder/Recurso, cuando filtra el reporte por equipo, entonces el listado debe mostrar solo las tareas de ese equipo
- AC-25 (RF-19): Dado un PM/Líder/Recurso, cuando filtra el reporte por un rango de fechas, entonces el listado debe mostrar solo las tareas cuyo deadline cae dentro de ese rango
- AC-26 (RF-20): Dado un PM o un Líder, cuando consulta la composición de cualquier equipo, entonces debe poder visualizarla
- AC-27 (RF-21): Dado un Recurso, cuando consulta la composición de un equipo que no es el suyo, entonces debe poder visualizarla pero el sistema debe impedirle modificarla
- AC-28 (RF-22): Dado un Recurso, cuando intenta acceder a la lista completa de clientes, entonces el sistema debe denegarle el acceso y solo debe mostrarle los clientes de las tareas que tiene asignadas
- AC-29 (RF-23): Dado un Líder, cuando está asignando recursos a un equipo de trabajo, entonces debe poder consultar la lista de usuarios con rol Recurso para elegir a quiénes asignar
- AC-30 (RF-23): Dado un usuario no autenticado, cuando intenta consultar la lista de recursos, entonces el sistema debe denegarle el acceso
- AC-31 (RNF-09): Dado cualquier usuario autenticado, cuando completa una acción permitida por su rol, entonces debe poder hacerlo exclusivamente a través de la interfaz gráfica, sin necesitar acceso directo a la base de datos ni a la API
- AC-32 (RF-24): Dado un usuario autenticado, cuando cierra sesión, entonces el sistema debe invalidar su sesión (tokens) y denegarle el acceso a cualquier funcionalidad protegida hasta que vuelva a autenticarse
- AC-33 (RF-25): Dado un usuario autenticado, cuando ingresa al sistema, entonces debe ver una vista de inicio acorde a su rol
- AC-34 (RF-26): Dado un PM/Líder/Recurso, cuando visualiza un tablero, entonces cada tarea debe mostrar una indicación visual (color/ícono) de su estado
- AC-35 (RF-27): Dado un PM/Líder/Recurso, cuando un tablero o reporte no tiene tareas para mostrar, entonces el sistema debe mostrar un mensaje de estado vacío en lugar de una pantalla en blanco
- AC-36 (RF-28): Dado un Recurso o un Líder, cuando intenta tomar una tarea o cambiar el estado de una tarea, entonces el sistema debe pedirle confirmación antes de aplicar el cambio
- AC-37 (RF-29): Dado un Recurso o un Líder, cuando el sistema le solicita confirmación para tomar una tarea o cambiar el estado de una tarea, entonces dicha confirmación debe presentarse en un modal/popup que impida interactuar con el resto de la pantalla hasta que confirme o cancele
- AC-38 (RF-30): Dado un usuario, cuando el sistema le deniega el acceso a una funcionalidad, entonces debe mostrarle un mensaje explicando el motivo (no autenticado / rol insuficiente)
- AC-39 (RF-31): Dado un Líder, cuando cambia el estado de una tarea de un equipo del que es dueño, entonces el tablero debe reflejar el nuevo estado
- AC-40 (RF-31): Dado un Líder, cuando intenta cambiar el estado de una tarea de un equipo del que no es dueño, entonces el sistema debe denegárselo
- AC-41 (RF-32): Dado un Recurso o un Líder con permiso sobre la tarea, cuando arrastra su tarjeta de una columna a otra en el tablero, entonces el estado de la tarea debe actualizarse al de la columna destino
- AC-42 (RF-32): Dado un Recurso, cuando intenta arrastrar la tarjeta de una tarea que no tiene asignada, entonces el sistema debe impedir el cambio de estado

## Fuera de Alcance
- No se contempla registro de horas trabajadas (timesheet) por tarea, solo estimación, deadline y estado
- No se incluye facturación ni gestión de costos/tarifas asociadas a clientes, recursos o tareas
- No se contempla control de horas extra, licencias, ausentismo o gestión de RRHH del recurso
- No se incluye gestión de dependencias entre tareas (bloqueos, predecesoras/sucesoras)
- No se incluyen notificaciones automáticas de disponibilidad de recursos (queda para v2)
- No se incluye vista de línea de tiempo (timeline); solo vista de tablero (queda para v2)
- No se incluye visibilidad del estado de ocupación de recursos de otros equipos (queda para v2)
- No se incluye creación de subtareas internas dentro de una tarea (queda para v2)
- No se incluye la gestión de subgrupos de clientes (queda para v2)
- No se incluye edición del nombre/descripción ni baja (eliminación) de clientes, equipos o tareas ya creados; solo se contemplan las modificaciones ya definidas en los RF (agregar recursos a un equipo, tomar/estimar/cambiar el estado de una tarea) (queda para v2)
- No se incluye exportación de reportes a archivo (CSV u otro formato); el reporte se consulta solo en pantalla (queda para v2)
- El alta de usuarios (PM, Líder, Recurso) la realiza exclusivamente un Admin dentro de la interfaz; no hay autorregistro (sign-up) para ningún rol
- La integración con herramientas externas (Jira/Trello/Drive/Asana) queda fuera de esta versión; en el MVP la carga de datos es manual

## Riesgos y Dependencias
- Riesgo: Tiempos de respuesta (<2s/<1s) se degradan con el crecimiento de datos históricos → mitigación: indexado y paginación desde el diseño inicial.
- Riesgo: Baja adopción si los líderes siguen usando sus métodos paralelos (Drive, tableros propios) → mitigación: onboarding simple y comunicación de uso obligatorio.
- Riesgo: la franja horaria fijada para RNF-06 (lunes a viernes 9-18h, hora local) asume que "hora local" es un único huso horario para toda la operación; si la pyme opera en varias zonas horarias, este NFR debe redefinirse antes de implementar.

- Dependencia: RF-02 (alta de usuarios por Admin) implementado antes de que cualquier PM/Líder/Recurso pueda autenticarse.
- Dependencia: RF-03 a RF-07 (clientes, equipos, tareas) implementados antes de habilitar el tablero.
- Dependencia: Infraestructura de hosting que sostenga RNF-04 (50 sesiones) y RNF-06 (99% disponibilidad).
