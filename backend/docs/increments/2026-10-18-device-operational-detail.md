# Incremento: detalle operativo de dispositivos y sus sensores

## Requisito y funcionalidad

Gestionar sensores desde el dispositivo al que pertenecen y consultar rápidamente su última medición. Reutiliza usuarios, permisos, dispositivos, sensores, mediciones, auditoría y temas existentes. No sustituye módulos ni registra automáticamente sensores desconocidos que aparezcan en telemetría.

Pantalla `/app/device/:deviceId` (el parámetro siempre es `external_id`, nunca la clave interna), dentro del espacio autenticado. Se accede desde Dispositivos → Abrir. Breadcrumb hacia Inicio y Dispositivos, panel izquierdo con datos del equipo y área principal con sensores paginados (12 por página), vista tabla/tarjetas, última lectura, fecha y calidad. En móvil el panel se coloca encima; las tablas se convierten en fichas etiquetadas sin ocultar acciones.

Acciones: crear y editar sensor, activar/desactivar conservando histórico, abrir reportes, añadir medición manual y sincronizar. La última lectura se determina por `observed_at DESC, id DESC`, no por orden de recepción; cero y falso son valores válidos. Un sensor habilitado no implica conectividad online: son estados distintos y la interfaz los etiqueta por separado.

## Análisis y decisiones

- Ya existían CRUD de dispositivos/sensores, mediciones tipadas e histórico, pero el catálogo de sensores no filtraba por dispositivo ni incluía últimas lecturas.
- Se mantiene AutoCrud. Se añade una extensión local al listado de sensores, sin cambiar el helper general ni la estructura SQL.
- `GET /v1/api/iot/sensors?device_external_id=<UUID>&include_latest=true&page=1&page_size=12` valida el UUID, resuelve el dispositivo dentro de la organización autorizada y aplica el filtro antes de paginar. No se descarga el catálogo completo para filtrarlo en Angular.
- `include_latest` requiere además `measurements.read` (o `*`); sin ese permiso la interfaz no solicita lecturas. El backend devuelve 403 si se intenta forzar ese parámetro. Los permisos de lectura/gestión de sensores siguen comprobándose en las rutas existentes.
- Una consulta SQL parametrizada con `JOIN LATERAL ... LIMIT 1` obtiene las lecturas de los sensores de la página. Aprovecha el índice existente `(tenant_id, sensor_id, observed_at)`, evita una petición por sensor y no recorre todo el histórico para enviarlo al navegador. El desempate por `id` es únicamente interno.
- La serialización existente elimina claves internas. Se reutiliza la conversión de mediciones NUMBER/TEXT/BOOLEAN/JSON. No se crean valores cuando un sensor no tiene histórico: `latest_measurement: null`.
- Las lecturas agregadas se auditan como LIST de measurements, además del LIST de sensors.
- Crear sensor utiliza el endpoint existente con `device_external_id` fijado por la pantalla; editar nunca reasigna el dispositivo. La clave del canal identifica el campo del perfil de integración, no es un código de inventario. No se pide código automático.
- Se conserva la protección de esquema de sensores con histórico. Se corrige la validación de rangos al actualizar combinando valores actuales y nuevos bajo bloqueo; los límites nulos son opcionales.
- Reportes reutiliza Monitorización con filtros de dispositivo y sensor; muestra las muestras paginadas, no agregaciones diarias/anuales ni un PDF. Medición manual reutiliza su formulario tipado con catálogo limitado al dispositivo y sensor preseleccionado. Ambas pantallas permiten regresar al detalle mediante RouterLink.
- Sincronizar solo vuelve a consultar el backend. No cambia last_seen, conectividad ni inventa telemetría. Alternativa futura: comandos MQTT con correlación, autorización y confirmación, que requieren un contrato adicional del firmware; no se simula esa capacidad ahora.
- Formularios con validación, avisos de cambios pendientes y protección de doble envío. Errores de consulta no muestran sensores de otros dispositivos. Preferencias de tema y componentes globales se reutilizan; no hay dependencias nuevas.

## Archivos creados

- `frontend/src/app/features/devices/device-detail.page.ts`: estado, carga paginada, permisos y acciones del detalle.
- `frontend/src/app/features/devices/device-detail.page.html`: breadcrumb, ficha de dispositivo, editor y vistas de sensores.
- `frontend/src/app/features/devices/device-detail.page.css`: layout responsive y tokens semánticos existentes.
- `frontend/src/app/features/devices/device-detail.spec.ts`: diez pruebas del flujo operativo y navegación contextual.
- Este documento: evidencia y límites del incremento.

## Archivos modificados

- `backend/src/modules/module-iot/sensors/sensors.service.js`: filtro por dispositivo, últimas lecturas, autorización, auditoría y validación de rangos.
- `backend/test/ingestionIntegration.test.js`: escenario real PostgreSQL/HTTP que comprueba alcance, últimas lecturas, permisos, paginación y ausencia de identificadores internos.
- `frontend/src/app/app.routes.ts`: ruta lazy con `devices.read` y protección de salida.
- `frontend/src/app/features/administration/resource.page.html`: enlace de apertura desde el listado de dispositivos en lugar del diálogo genérico.
- `frontend/src/app/features/monitoring/monitoring.page.ts`: contexto del sensor/dispositivo, filtro y retorno al detalle.
- `frontend/src/app/features/operations/measurement-entry.page.ts`: selección contextual del sensor y retorno al detalle; texto actualizado a ingesta HTTPS/MQTT.
- `frontend/src/app/features/responsive.spec.ts`: cuatro escenarios de detalle/editor en móvil (Light/Dark y tabla/tarjetas).
- `frontend/README.md`: ruta y alcance operativo.

## Verificación

- Backend: 26 pruebas de integración (incluidos grupos padre), todas correctas, con base temporal creada y eliminada por el verificador. Ningún dato funcional se elimina ni modifica durante las pruebas.
- Angular: 106 pruebas correctas, incluidas diez nuevas del detalle y cuatro nuevas de layout a 360 px en ambos temas.
- Compilación de producción: correcta. Advertencia conocida del CSS del tablero de proyectos (4,53 kB frente a presupuesto 4 kB), ajena a este incremento.
- No se necesitan migraciones, nuevas variables de entorno ni nuevas dependencias.

Para comprobar manualmente: iniciar sesión con los permisos necesarios; abrir un dispositivo; crear un sensor; registrar una lectura desde su tarjeta; regresar y sincronizar; abrir Reportes; alternar tabla/tarjetas y Light/Dark; repetir con usuario sin gestión ni lectura de mediciones. Desactivar el sensor y verificar que conserva su última lectura y desaparece la acción de entrada manual. La medición manual no implica que el equipo físico esté conectado.

## Deuda, riesgos y mejoras futuras

- Sincronización activa con hardware no implementada; requiere contrato de comandos y respuestas. No confundir con actualización de la vista.
- No hay streaming ni polling automático en este detalle: la actualización es explícita.
- El editor contextual cubre los campos operativos del sensor; calibración/metadata siguen sin editor especializado. No existe autodescubrimiento de sensores desde mensajes recibidos.
- Reportes son el histórico y gráfico existentes: las agregaciones, exportaciones y rangos de calendario completos son otro requisito.
- Validación responsive automatizada en navegador, no aceptación con teléfonos físicos ni certificación de accesibilidad/SUS.
- Para volúmenes elevados conviene medir el plan y tiempos de la consulta sobre datos representativos antes de añadir índices o cache. Última lectura es por fecha observada; lecturas con reloj incorrecto requieren controles de calidad/tiempo en la ingesta.

## Evidencia y defensa del TFM

Se puede documentar el flujo dispositivo → sensores → medición → histórico; capturas de ambas vistas/temas; contrato del endpoint; matriz de permisos; prueba de aislamiento; criterio temporal de la última lectura y consulta indexada. Este incremento mejora operabilidad, pero la heterogeneidad se demuestra con las ingestas HTTPS y MQTT convergiendo en mediciones comunes, no solo con la interfaz.

Preguntas posibles del tribunal: ¿por qué se filtra y pagina en servidor?, ¿cómo se evitan N+1 consultas?, ¿cómo se impide consultar mediciones sin permiso?, ¿por qué un sensor habilitado no significa online?, ¿qué sucede con lecturas fuera de orden?, ¿qué significa sincronizar realmente?, ¿por qué desactivar en vez de borrar?, ¿cómo se preserva el histórico al cambiar unidades?
