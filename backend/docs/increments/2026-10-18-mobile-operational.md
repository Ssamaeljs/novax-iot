# Incremento: responsive móvil con prioridad operativa

Fecha: 18-10-2026. Requisito del PO: plataforma responsive para móvil y acciones/datos operativos prioritarios en las pantallas.

## Requisitos y diagnóstico

- RNF-RESP-01 (propuesto): acceder a datos y acciones desde móvil, tablet y escritorio sin pérdida funcional.
- RNF-USAB-03 (propuesto): priorizar el trabajo sobre contenido orientativo o configuración secundaria.

La inspección encontró tablas dependientes de desplazamiento horizontal, filas de acciones sin ajuste, configuración de widgets situada antes de sus datos en móvil y cabecera con demasiada anchura disponible para contexto. Se clasifican como mejoras UX/responsive; no justifican reemplazar la arquitectura ni cambiar contratos.

Se conserva Angular standalone, el CRUD compartido, los formularios, permisos, telemetría, temas y edición versionada de tableros. No se modifica backend ni base de datos; no se añaden dependencias.

## Solución y alternativas

Una única tabla cambia su presentación por consultas de medios, con etiquetas de campo por celda. Evita mantener una segunda versión de datos/acciones para móvil. Frente a ocultar columnas, conserva toda la información. Se explicitan roles de accesibilidad y se mantienen encabezados; la experiencia de lectores requiere aceptación manual.

El tablero muestra datos antes que configuración en el flujo móvil. Cuando se solicita editar, el foco y desplazamiento permiten localizar las propiedades. No se introduce un drawer modal adicional ni una librería de drag-and-drop. El diseño móvil es una presentación: no reescribe posiciones guardadas.

## Archivos

Creado:

- `frontend/src/app/features/responsive.spec.ts`: 16 pruebas de layout/interacción disponible con anchos reales dentro del navegador.
- `frontend/docs/mobile-operational-design.md`: criterio permanente, alcance comprobado y aceptación pendiente.
- `backend/docs/increments/2026-10-18-mobile-operational.md`: evidencia del incremento.

Modificados:

- `frontend/src/styles/primitives.css`: fichas de tablas operativas, controles, formularios, paginación y diálogos responsive.
- `frontend/src/app/features/administration/resource.page.html`: etiquetas por celda y semántica de tabla preservada.
- `frontend/src/app/features/administration/resource.page.css`: acciones ajustables y desplazamiento de página en móvil.
- `frontend/src/app/features/monitoring/monitoring.page.ts`: filtros apilados, celdas etiquetadas y agrupación legible de dispositivo/sensor.
- `frontend/src/app/shared/layout/navbar.component.ts`: cabecera privada compacta sin quitar controles.
- `frontend/src/app/shared/ui/theme-selector.component.ts`: objetivos táctiles de 44 px en modo compacto.
- `frontend/src/app/features/overview/overview.page.ts`: centro de operaciones y accesos de trabajo antes de contenido auxiliar.
- `frontend/src/app/features/projects/project-board.page.ts`: apertura explícita y enfoque del panel en móvil tras renderizar.
- `frontend/src/app/features/projects/project-board.page.html`: guardar junto a propiedades y control único de apertura del panel.
- `frontend/src/app/features/projects/project-board.page.css`: flujo datos-configuración, tamaños y ajuste móvil; formato expandido para legibilidad.
- `frontend/README.md`: referencia al criterio de diseño.

## Pruebas y resultados

- 81 pruebas Angular aprobadas: 65 anteriores y 16 nuevas.
- Catálogos en 320/360/390/768/1280 px en Light/Dark, sin desbordamiento global de página y sin quitar acciones.
- Monitorización, inicio, cabecera, diálogo y tablero con comprobaciones específicas de layout.
- Las pruebas confirman que el apilado de widgets no cambia geometría ni genera cambios pendientes.
- Compilación de producción/SSR aprobada; persiste la advertencia de presupuesto de estilos del tablero, ahora aproximadamente 4,53 kB frente a 4 kB. No se eleva el umbral para ocultarla.
- Contrato de temas y calculador SUS se verifican por separado. Estos resultados no constituyen un estudio con usuarios.

Comandos desde `frontend`: `node node_modules/@angular/cli/bin/ng.js test --watch=false --browsers=ChromeHeadless`, `node --test test/theme-contract.test.cjs test/sus-score.test.cjs` y `node node_modules/@angular/cli/bin/ng.js build`.

## Riesgos, deuda y aceptación

Pendientes Android/iOS físicos, teclado virtual, áreas seguras, orientación, zoom y lectores de pantalla. Las pruebas se ejecutan en Chrome de escritorio con viewports de componente; no se presentan como emulación completa del dispositivo ni cobertura de todo contenido de cada pantalla. Revisar rendimiento de listados extensos y ajustes con datos reales. Las fichas priorizan lectura de registros; comparaciones densas de muchas filas pueden ser más eficientes en escritorio.

No se pierden funciones ni se cambia el rol del usuario. Los accesos operativos respetan permisos y no implican que se haya implementado una nueva integración de hardware. No se modifica la paleta ni se ocultan errores o vacíos.

## Para el TFM

Relacionar requisito responsive con jerarquía de tareas, reutilización de componentes, preservación de información y matriz de viewports. Añadir capturas y observación de tareas en móvil durante el estudio SUS, sin convertir pruebas de CSS en evidencia de usabilidad percibida.

Preguntas de defensa: ¿por qué cambiar presentación sin duplicar datos? ¿Cómo se conserva accesibilidad de una tabla presentada como fichas? ¿Por qué el layout móvil no debe sobrescribir el de escritorio? ¿Qué verifica un viewport y qué no verifica de un teléfono? ¿Cómo se determina la acción principal según el rol? ¿Qué compromisos existen entre lectura por registro y comparación de muchas filas?
