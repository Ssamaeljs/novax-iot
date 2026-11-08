# Proyectos y tableros de sensores

## Uso

1. Reiniciar el backend para cargar el nuevo módulo. Recargar la sesión web para actualizar los permisos.
2. Abrir **Proyectos**, indicar título y descripción. El servidor genera un código `PRJ-…` automáticamente.
3. Seleccionar **Abrir tablero → Editar tablero**. El panel derecho se abre y se puede cerrar.
4. Añadir un termómetro, gauge, línea temporal o HTML personalizado. Seleccionar sensores y pulsar **Aplicar** en sus propiedades.
5. Arrastrar el manejador del encabezado para mover; usar la esquina inferior para redimensionar. También se pueden usar las flechas del teclado o introducir coordenadas en las propiedades.
6. **Fijar** impide mover o redimensionar; **Liberar** permite editar otra vez. **Guardar tablero** persiste el conjunto. Salir con cambios requiere confirmación.

Debe existir al menos un sensor activo compatible. Los widgets no generan mediciones: consumen las registradas por los mecanismos de ingesta existentes. Los proyectos son agrupaciones visuales de NOVAX, no nuevos tenants.

## API y autorización

Base: `/v1/api/projects`. Se mantienen autenticación, cookies, CSRF, errores y auditoría existentes.

| Operación | Endpoint | Permisos |
| --- | --- | --- |
| Consultar proyectos | `GET /` y `GET /:external_id` | `projects.read` |
| Crear, actualizar, desactivar | `POST /`, `PATCH /:external_id`, `DELETE /:external_id` | `projects.manage` |
| Leer tablero | `GET /:external_id/board` | `projects.read` |
| Reemplazar tablero | `PUT /:external_id/board` | `projects.manage` + `sensors.read` |
| Consultar datos | `GET /:external_id/telemetry?range=24h` | `projects.read` + `measurements.read` |

La migración concede los nuevos permisos a los roles de sistema `TENANT_OWNER` ya existentes. Otros roles se configuran en administración. La interfaz oculta edición sin los permisos necesarios y el servidor los vuelve a exigir. Las respuestas solo contienen identificadores públicos UUID.

### Guardado del tablero

El cuerpo contiene `version` y `widgets`. Cada widget incluye `external_id` solo si ya existe, `title`, `type`, `layout`, `sensor_external_ids` y `settings`. Nunca IDs internos ni el catálogo completo del sensor.

`layout`: `x`, `y`, `width`, `height`, `locked`. Rejilla de 12 columnas, ancho 3–12, alto 3–16, y 0–200; sin solapamientos. Hasta 30 widgets y 40 sensores distintos por tablero. Termómetro/gauge: un sensor numérico. Línea temporal: hasta seis sensores numéricos con la misma métrica y unidad. HTML: hasta seis sensores de cualquier tipo.

El guardado bloquea la fila del proyecto, comprueba la versión y realiza widgets, asociaciones y auditoría en una transacción. Una edición desactualizada devuelve `409 BOARD_VERSION_CONFLICT`; el frontend conserva el borrador. Los widgets omitidos se eliminan del tablero al guardar. La desactivación de un proyecto conserva sus datos, pero impide operar su tablero.

## HTML y CSS sin JavaScript

Campos: `{{value}}`, `{{name}}`, `{{unit}}`, `{{observed_at}}`, `{{quality}}` para el primer sensor; `{{sensor_1.value}}`, `{{sensor_2.name}}`, etc. para selecciones ordenadas. La lectura inexistente se representa con `—`.

Ejemplo HTML: `<section class="reading"><h3>{{name}}</h3><strong>{{value}} {{unit}}</strong></section>`.

Ejemplo CSS: `.reading { padding: 1rem; } strong { color: var(--primary); }`.

La plantilla usa etiquetas estructurales permitidas y CSS en un campo separado; no admite scripts, formularios, imágenes remotas, navegación ni importaciones. Máximo HTML 16.000 y CSS 8.000 caracteres. Los valores del sensor se escapan y el documento se sanea en un template inerte. Se presenta dentro de un iframe con `sandbox` vacío (sin scripts ni mismo origen), CSP restrictiva y política sin referente. Los tokens semánticos se copian para seguir Light/Dark. No se compila una plantilla Angular ni se evalúan expresiones del usuario.

La validación por patrones del servidor es adicional, no la frontera de seguridad. La frontera es el saneamiento por lista permitida y el aislamiento del navegador. No ampliar permisos del sandbox ni aplicar confianza de Angular a contenido sin pasar por este flujo.

Referencias: [seguridad Angular](https://angular.dev/best-practices/security), [sandbox de iframe](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe), [template inerte](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/template).

## Colores condicionales

En las propiedades del widget, **Colores según condiciones → Añadir condición**. Seleccionar un sensor numérico asociado al widget, operador, umbral, color semántico y etiqueta visible. Hasta diez reglas ordenadas; se aplica la primera coincidencia. Los operadores disponibles son mayor, mayor/igual, menor, menor/igual, igualdad exacta, distinto y rango inclusivo.

Ejemplo: humedad ≥ 85 → rojo «Humedad crítica» primero; humedad ≥ 70 → ámbar «Humedad elevada» después. Se puede cambiar su prioridad con las flechas. Aplicar propiedades y guardar el tablero.

Las reglas se conservan en `settings.color_rules` con `sensor_external_id`, `operator` (`gt/gte/lt/lte/eq/neq/between`), `value`, `upper` solo para rango, `tone` y `label`. El servidor valida referencias, tipos, límites y la paleta cerrada (`success/warning/danger/info/maintenance/offline`). No se aceptan CSS, fórmulas ni JavaScript como condición.

Se evalúa la última lectura finita del sensor; sin lectura, con dato no numérico o calidad `BAD` no hay coincidencia. Sin coincidencia se mantiene el color del tema. No existe caducidad automática del dato: revisar su fecha. La igualdad es exacta; para mediciones decimales suele ser más útil usar rangos.

Los indicadores cambian su trazo/relleno y todos los tipos presentan fondo, borde y etiqueta condicional. Las líneas de una comparación mantienen colores distintos para conservar su identidad. El HTML aislado dispone de `var(--widget-color)` para usar el color calculado en su CSS, sin permitir scripts.

Estas son condiciones **visuales**, no reglas de alertas: no envían notificaciones, no ejecutan acciones y no registran transiciones de estado en servidor. Siguen el refresco de telemetría existente. La etiqueta complementa el color por accesibilidad y los tokens existentes se adaptan a Light/Dark.

## Datos, rendimiento y límites de consulta

- Actualización HTTP cada 30 segundos y botón manual. No es streaming WebSocket.
- Periodos: 1 h, 6 h, 24 h y 7 días. Histórico: últimas 200 muestras numéricas por sensor dentro del periodo, ordenadas temporalmente; no son agregaciones diarias, mensuales ni anuales.
- Indicadores: última lectura disponible, incluso anterior al periodo; muestran su fecha. Una lectura antigua no demuestra conectividad actual del dispositivo.
- Comparación con eje temporal real y escala común. No convierte unidades ni mezcla métricas distintas.
- La respuesta agrupa sensores para evitar una petición por widget. El límite de salida no equivale a limitar todo el trabajo de consulta: medir y optimizar índices/planes con volumen real antes de escalar.
- En móvil los widgets se apilan; el diseño guardado de escritorio no se modifica. La edición por propiedades sigue disponible.
- El layout se comparte entre usuarios autorizados del proyecto. No hay publicación pública, colaboración en vivo ni plantillas exportables.

## Pruebas reproducibles

Backend: `node --test` (las suites de base se omiten por defecto); `node scripts/run-integration-isolated.js` crea una base temporal, migra, ejecuta las suites y elimina únicamente esa base. No ejecutar pruebas destructivas contra la base de trabajo.

Frontend: `node node_modules/@angular/cli/bin/ng.js test --watch=false --browsers=ChromeHeadless`; `node --test test/theme-contract.test.cjs`; `node node_modules/@angular/cli/bin/ng.js build`.

Comprobación manual pendiente de aceptación: crear un proyecto con sensores reales, contrastar las lecturas con el histórico, comparar dos sensores compatibles, guardar y recargar; comprobar bloqueo, dos pestañas con conflicto, HTML sin ejecución, temas y pantallas físicas de diferente tamaño.
