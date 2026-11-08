# Criterio de diseño: móvil y operación primero

Fecha: 18-10-2026. Aplica a nuevas pantallas y cambios de las existentes, manteniendo rutas, permisos y capacidades reales.

## Jerarquía funcional

1. Identificar la tarea y ofrecer su acción principal según permisos.
2. Mostrar datos de trabajo: equipos, estado reportado, mediciones, resultados y errores recuperables.
3. Mantener disponibles búsqueda, filtros, actualización y acciones de cada elemento.
4. Presentar configuración, metadatos, explicaciones y ayuda después de la información operativa. No eliminarlos para conseguir una pantalla más corta.

En acceso, la tarea principal es entrar o recuperar el acceso; en cuenta, actualizar datos/seguridad; en administración, encontrar y gestionar registros; en monitorización, consultar lecturas; en proyectos, observar datos antes de editar el diseño. La landing pública conserva su función y acceso a la plataforma: no se convierte en otra página administrativa.

## Comportamiento implementado

- Inicio: «Centro de operaciones», accesos de trabajo antes de métricas y orientación; cada acceso respeta permisos.
- Listados CRUD y monitorización: tabla tradicional en escritorio; hasta 600 px, cada fila se presenta como una ficha con etiquetas, datos y acciones completos. No se ocultan columnas ni se duplica el conjunto de datos. Se conservan roles de tabla/fila/celda y encabezados para tecnologías de asistencia; pendiente comprobación con lectores reales.
- En móvil, el listado utiliza el desplazamiento vertical de la página, sin una segunda zona vertical limitada a 60–65 vh.
- Filtros de mediciones apilados, acciones de filas con ajuste de línea, búsqueda y paginación accesibles.
- Formularios: controles de al menos 44 px de alto y fuente de 16 px en campos; acciones de diálogos adheridas al borde inferior de su área de desplazamiento. Esta fuente reduce el riesgo de zoom automático de controles en navegadores móviles, pero no sustituye probar el teclado real.
- Cabecera privada compacta; en anchos de hasta 420 px el nombre de organización no ocupa espacio en ella. Sigue disponible en otras pantallas; no se eliminan controles de navegación, usuario ni los tres modos de tema.
- Tablero: lecturas antes del panel en móvil/tablet de hasta 800 px; al solicitar edición se desplaza y enfoca el panel para localizar sus propiedades. El panel sigue pudiendo cerrarse. Guardar está disponible también tras las propiedades, sin volver al encabezado.
- Los widgets se apilan sin escribir nuevas coordenadas ni marcar cambios; editar tamaño/posición por propiedades sigue disponible. No se fuerza el arrastre como única interacción táctil.
- Las pantallas de cuenta/acceso ya disponían de apilado responsive; heredan los controles y tamaños compartidos. No se reemplazan módulos funcionales.

## Verificación reproducible

`src/app/features/responsive.spec.ts` utiliza componentes Angular con sus estilos reales dentro de marcos del mismo origen en Chrome Headless. Las consultas de medios responden al ancho de cada marco, no a clases que simulan un móvil.

Cobertura nueva:

- Catálogo en 320, 360, 390, 768 y 1280 px, en Light y Dark: etiquetas, acciones y ausencia de desbordamiento de página.
- Diálogo a 360 px: ancho, acciones adheridas y tamaño de texto de controles.
- Cabecera a 320 px: controles de usuario/tema y altura compacta.
- Mediciones a 360 px: filtros y cuatro campos conservados por lectura.
- Vista general a 360 px: acciones operativas antes de métricas y contenido auxiliar.
- Tablero a 360/768 px: datos antes de configuración y geometría persistida intacta.

La prueba de catálogo reutilizable afecta a dispositivos, sensores, usuarios, cuentas, roles, permisos, proyectos, tokens y auditoría, pero no demuestra por sí sola todos sus contenidos posibles. Probar además textos largos, permisos y datos propios de cada recurso.

## Aceptación manual pendiente

Revisar en un Android y un iPhone reales, orientación horizontal/vertical, teclado abierto, zoom, lector de pantalla y conexión lenta. Recorrer acceso/recuperación, inicio, todos los catálogos, mediciones, registro de lecturas, tablero, cuenta, ajustes, guía, 403 y 404. Verificar que las acciones de formularios no queden tapadas y que textos largos no desplacen los controles fuera de pantalla.

Los anchos comprobados automáticamente son evidencia de layout, no certificación para todos los navegadores ni una puntuación SUS. Las sesiones con usuarios deben incluir tareas operativas desde móvil, no solo inspección visual.
