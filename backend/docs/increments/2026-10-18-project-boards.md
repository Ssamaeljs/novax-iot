# Incremento: proyectos y tableros configurables

Fecha: 18-10-2026. Estado: implementado y verificado automáticamente; pendiente aceptación visual/funcional del Product Owner con dispositivos reales.

## Requisitos relacionados

Identificadores propuestos para la trazabilidad del TFM, pendientes de incorporar al catálogo oficial:

- RF-PROJ-01: crear, consultar, editar y desactivar proyectos con código, título y descripción.
- RF-BOARD-01: presentar sensores en un tablero con biblioteca lateral desplegable.
- RF-WIDGET-01: termómetros, gauges, históricos y comparación de sensores compatibles.
- RF-WIDGET-02: configurar posición/tamaño, bloquear geometría y conservar el diseño.
- RF-WIDGET-03: HTML/CSS personalizados con campos de sensores, sin JavaScript (elección explícita del PO).
- RNF-SEC-01: permisos en servidor, UUID públicos, validación y aislamiento de contenido.
- RNF-MNT-01: extensión modular sin reemplazar módulos existentes ni añadir dependencias.
- RNF-AUD-01: trazabilidad de consultas y cambios mediante la auditoría existente.

## Análisis y decisiones

Se reutilizan AutoCrud, validación, autenticación, autorización, auditoría, catálogo de sensores, mediciones, API Angular, rutas y tokens de tema. No se introduce una nueva arquitectura ni otro servicio de telemetría independiente.

Proyecto es una agrupación visual de NOVAX. Un widget pertenece a un proyecto; sus sensores se asocian mediante una tabla intermedia ordenada. La configuración variable se almacena en JSONB validado; las relaciones y geometría conservan campos explícitos. Un sensor puede mostrarse en varios proyectos sin duplicar sus mediciones.

Alternativas: guardar todo el tablero como JSON simplificaría el primer guardado, pero perdería integridad referencial de sensores. Una biblioteca externa de grid/charts aportaría opciones, pero no es necesaria para este alcance. Se usa CSS Grid y SVG con componentes pequeños; se conserva la posibilidad de sustituir solo el motor de presentación en el futuro.

El guardado es explícito, transaccional y con versión optimista para evitar sobrescribir cambios de otra sesión. El bloqueo de posición es una regla de edición, no una autorización independiente: un editor puede desbloquear o eliminar el widget. No es un bloqueo exclusivo entre usuarios.

HTML personalizado se restringe a presentación: valores escapados, lista permitida de etiquetas/atributos, iframe sin privilegios y CSP. No se evalúa código del usuario. Los gráficos comparativos exigen misma métrica y unidad para no generar conclusiones engañosas.

## Archivos creados y responsabilidades

Rutas relativas a la raíz del repositorio:

- `backend/src/modules/module-projects/migrations/2026.10.18T010000-create-project-boards.js`: tablas, restricciones, permisos y asignación al propietario existente.
- `backend/src/modules/module-projects/projects/projects.model.js`: entidad proyecto.
- `backend/src/modules/module-projects/projects/projectWidget.model.js`: entidad widget.
- `backend/src/modules/module-projects/projects/projectWidgetSensor.model.js`: asociación ordenada con sensores.
- `backend/src/modules/module-projects/projects/projects.service.js`: CRUD y validación del proyecto.
- `backend/src/modules/module-projects/projects/board.validation.js`: validación pura de layout, configuración y bloqueo.
- `backend/src/modules/module-projects/projects/board.service.js`: lectura, guardado transaccional, versión y DTO público.
- `backend/src/modules/module-projects/projects/telemetry.service.js`: consulta agrupada de lecturas e histórico limitado.
- `backend/src/modules/module-projects/projects/projects.controller.js`: adaptación HTTP y errores consistentes.
- `backend/src/modules/module-projects/projects/projects.routes.js`: endpoints y permisos.
- `backend/test/projectBoard.test.js`: pruebas unitarias de dominio.
- `backend/test/projectsIntegration.test.js`: pruebas HTTP/PostgreSQL con usuarios, permisos y sensores reales de prueba.
- `backend/docs/project-boards.md`: contrato, uso, seguridad, límites y reproducción.
- `backend/docs/increments/2026-10-18-project-boards.md`: esta evidencia.
- `frontend/src/app/features/projects/project.models.ts`: contratos tipados.
- `frontend/src/app/features/projects/project-api.service.ts`: integración HTTP y DTO de guardado.
- `frontend/src/app/features/projects/board-layout.ts`: geometría y búsqueda de espacio libre.
- `frontend/src/app/features/projects/project-board.page.ts`: estado y acciones del tablero.
- `frontend/src/app/features/projects/project-board.page.html`: estructura accesible y panel lateral.
- `frontend/src/app/features/projects/project-board.page.css`: layout responsive con tokens semánticos.
- `frontend/src/app/features/projects/widget-editor.component.ts`: propiedades y selección de sensores.
- `frontend/src/app/features/projects/widgets/widget-view.component.ts`: indicadores y selección del renderer.
- `frontend/src/app/features/projects/widgets/comparison-chart.component.ts`: gráfico temporal SVG y leyenda.
- `frontend/src/app/features/projects/widgets/custom-html.ts`: interpolación escapada y documento aislado.
- `frontend/src/app/features/projects/widgets/custom-widget.component.ts`: presentación del iframe y tema.
- `frontend/src/app/features/projects/projects.spec.ts`: contratos, seguridad de presentación y editor.

## Archivos existentes modificados por este incremento

- `backend/src/modules/index.routes.js`: registro del módulo.
- `backend/scripts/run-integration-isolated.js`: incorpora la suite de proyectos al entorno temporal.
- `backend/README.md`: acceso a la documentación del módulo.
- `frontend/src/app/app.routes.ts`: rutas protegidas y protección de cambios sin guardar.
- `frontend/src/app/shared/layout/navigation.component.ts`: navegación por permisos.
- `frontend/src/app/features/administration/resource-definitions.ts`: catálogo CRUD de proyectos.
- `frontend/src/app/features/administration/resource.page.ts`: reutilización de RouterLink y etiqueta de título.
- `frontend/src/app/features/administration/resource.page.html`: acceso al tablero desde el listado.
- `frontend/README.md`: uso y límites.

Los cambios previos de organización única, autenticación y recuperación local se conservan; no forman parte de este incremento ni se sobrescriben.

## Flujo defendible

Usuario autorizado → ruta Angular → CRUD de proyecto → tablero/version/widgets → editor local → PUT con UUID y versión → permisos/validación → transacción/bloqueo de fila → sensores existentes de NOVAX → persistencia/auditoría → respuesta pública → nueva consulta de mediciones agrupadas → renderers.

## Pruebas y resultados

- Backend unitario: 31 pruebas aprobadas; 2 suites PostgreSQL omitidas intencionalmente en la ejecución ordinaria.
- Integración aislada: 13 escenarios aprobados (6 de proyectos, 7 preexistentes); el ejecutor de Node informa 15 al incluir los dos grupos padre. Migraciones completas sobre base temporal y limpieza final correctas.
- Angular en Chrome Headless: 48 pruebas aprobadas (15 nuevas y 33 preexistentes).
- Contrato de temas: 11 pruebas aprobadas; sin colores literales relevantes fuera de tokens, contraste de pares semánticos y paridad Light/Dark.
- Build Angular de producción/SSR aprobado; advertencia no bloqueante: estilos del tablero de 4,29 kB frente al presupuesto orientativo de 4 kB. El umbral no se ha elevado para ocultarla.
- Migración aditiva aplicada también a la base local: únicamente `2026.10.18T010000-create-project-boards.js`; sin reset, bootstrap ni cambios de credenciales.

Las pruebas incluyen UUID públicos, aislamiento organizacional, permisos, persistencia de los cuatro tipos, varios sensores, conflictos de versión, contenido peligroso, rechazo de geometría inválida, bloqueo, auditoría, lecturas reales de prueba, controles de puntero/teclado y preservación del borrador ante errores.

No equivalen a una prueba de carga, auditoría completa de seguridad, validación en todos los navegadores ni aceptación sobre dispositivos físicos. La revisión visual en Light/Dark y móvil queda como comprobación manual del PO.

## Deuda, riesgos y mejoras futuras

- Histórico acotado a 200 muestras por sensor; no implementar ni describir como agregación estadística completa.
- HTTP cada 30 s, no transmisión continua. La frecuencia real de ingesta depende de mecanismos ya existentes.
- Hasta 30 widgets y 40 sensores distintos; medir consultas con volumen real e incorporar agregaciones/índices según evidencia.
- Código del editor y sus estilos pueden dividirse más si crecen; no se añade una biblioteca de layout por anticipación.
- El guardado reemplaza el conjunto completo del tablero: si hay conflicto, recargar y reaplicar cambios; no hay fusión colaborativa.
- No hay permisos distintos por proyecto, publicación pública, exportación/importación ni historial de versiones recuperable.
- No se demuestra una nueva integración heterogénea solo con estos widgets. Para el objetivo central del TFM aún debe evidenciarse la normalización de al menos dos mecanismos/dispositivos de comunicación y sus pruebas.
- Próximos incrementos posibles: agregaciones temporales, reglas/alertas, evidencia de integración heterogénea y pruebas de carga del camino de telemetría.

## Material para el TFM y defensa

Documentar el modelo proyecto-widget-sensor, diagrama del flujo de lectura/guardado, restricciones de dominio, autorización en servidor, estrategia de concurrencia, aislamiento de contenido y matriz requisito-prueba. Añadir capturas de un tablero con sensores reales y evidencias de mediciones coincidentes entre API, base y gráfico.

Preguntas de tribunal: ¿por qué una tabla de asociaciones y no referencias en JSON? ¿Cómo se evita sobrescribir una edición concurrente? ¿Qué diferencia hay entre fijar posición y limitar permisos? ¿Por qué no permitir JavaScript? ¿Qué ocurre si dos sensores usan unidades distintas? ¿Una última lectura demuestra que un equipo está online? ¿Qué representa el límite de 200 muestras? ¿Dónde se normaliza la heterogeneidad, antes o después del dashboard?
