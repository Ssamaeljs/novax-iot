# Incremento: modelo común administrable e integración HTTPS/MQTT

Fecha: 18-10-2026. Estado: código, migración local y pruebas automatizadas implementados. Pendientes conexión al broker de NOVAX, certificados/ACL reales y demostración con dispositivos representativos.

## Requisitos relacionados

- RF-INT-01 (propuesto): recibir telemetría por dos mecanismos reales, HTTPS y MQTT.
- RF-MODEL-01 (propuesto): normalizar formatos heterogéneos hacia un contrato común versionado.
- RF-MODEL-02 (propuesto): permitir a administradores gestionar campos y conversiones sin editar SQL ni ejecutar código.
- RF-INT-02 (propuesto): vincular credenciales a fuentes/dispositivos y evitar duplicación por reintentos.
- RF-PRES-01 (propuesto): registrar última telemetría válida y derivar estado online/offline por timeout.
- RNF-SEC-01/RNF-AUD-01: validación, TLS, aislamiento NOVAX y trazabilidad sin secretos.
- RNF-HIST-01 (propuesto): preservar significado histórico de magnitud y unidad.

El PO autorizó implementar la capa común y delimitar nuevas integraciones a HTTPS/MQTT. Se interpretó «gestionar el modelo» como perfiles declarativos, versionados y vinculados a sensores; se comunicó antes de actuar. No se permite modificar tablas ni desplegar programas desde el frontend.

## Análisis y clasificación

El modelo previo de Device/Sensor/Measurement ya cubría identidad, tipo y fechas, y disponía de recepción HTTP. No se reemplazó. Faltaban normalización por formato, consumidor MQTT, credenciales acotadas por dispositivo, idempotencia y presencia automática: funcionalidades no implementadas, no razones para reescribir.

La modificación de unidad/tipo de un sensor con histórico podía reinterpretar lecturas: riesgo de integridad semántica que requiere corrección. Se añaden snapshots a nuevas mediciones y un bloqueo explícito al cambio de clave/magnitud/unidad/tipo cuando existe histórico. Los datos anteriores no se reconstruyen sin evidencia.

ONVIF queda fuera de nuevas altas e integraciones. Se conservan sus registros anteriores y la posibilidad de editar metadatos, evitando una eliminación innecesaria del trabajo previo.

## Decisiones y alternativas

- Monolito modular con adaptadores; no microservicios ni nueva cola de aplicación.
- Perfil/familia/versiones inmutables: mismos código de familia y versión creciente, UUID diferente. Actualizar interpretación exige versión/fuente nueva; no migra conexiones en silencio.
- Mapeos cerrados y transformación lineal para números; sin `eval`, scripts, URLs de usuario ni expresiones arbitrarias. Una plataforma de ontologías/JSON Schema genérico añade complejidad que no se necesita para este alcance.
- Fuentes con credencial opaca aleatoria; hash SHA-256 y prefijo persistidos, secreto una vez. No se reutiliza una cuenta humana como identidad del equipo ni se confía en device_id del mensaje.
- Sobre común v1 con payload de fabricante: firmware o gateway debe aportar encabezados mínimos. No se afirma soporte automático de cualquier formato de fabricante sin adaptación.
- Idempotencia por fuente y UUID del productor; hash canónico y transacción. Reintento con contenido distinto es conflicto, no nueva lectura oculta.
- Se reutiliza MeasurementService para persistir tipos y snapshots. Mensaje normalizado, lecturas, presencia y auditoría se guardan juntos.
- MQTT.js como cliente real, broker externo configurable; sesión persistente/QoS 1/backpressure y confirmación de aplicación tras persistencia. QoS 0 conserva su naturaleza best effort.
- Producción exige HTTPS detrás de proxy explícitamente confiable y MQTT sobre TLS verificado. La configuración del broker, usuarios, ACL y certificados pertenece a infraestructura; no se inventa desde la interfaz.

## Modelo y flujo

Perfil 1:N fuentes; dispositivo 1:N fuentes; fuente 1:N mensajes; mensaje 1:N mediciones; sensor 1:N mediciones. Relaciones internas enteras permanecen ocultas; recursos/referencias públicas son UUID. El UUID de productor `message_id` no es una clave interna.

Adaptador → autenticar fuente/transporte/NOVAX → validar sobre y límites → comprobar replay → cargar versión y sensores compatibles → normalizar valor/fecha/calidad → transacción de recepción y mediciones existentes → actualizar presencia → auditar → confirmar.

El frontend administra fuentes y versiones, prueba normalización sin insertar mediciones y consulta recepciones. Los widgets continúan consumiendo mediciones, sin ramas especiales para MQTT/HTTPS.

## Archivos creados

Backend:

- `src/modules/module-integration/migrations/2026.10.18T020000-create-integration.js`: tres tablas, índices, restricciones, snapshots, permisos y asignación al propietario existente.
- `src/modules/module-integration/profiles/integrationProfile.model.js`: familia/versiones de formato.
- `src/modules/module-integration/profiles/profiles.service.js`: publicación, metadatos y creación transaccional de versiones.
- `src/modules/module-integration/sources/integrationSource.model.js`: asociación y hash de credencial.
- `src/modules/module-integration/sources/sources.service.js`: alta, validación de referencias, rotación y DTO público.
- `src/modules/module-integration/ingestion/integrationMessage.model.js`: recepción y resultado normalizado.
- `src/modules/module-integration/ingestion/messages.service.js`: lectura de recepciones sin IDs internos.
- `src/modules/module-integration/ingestion/ingestion.service.js`: servicio común transaccional e idempotente.
- `src/modules/module-integration/normalization/contract.js`: contrato v1, límites, rutas seguras, hash y transformación pura.
- `src/modules/module-integration/adapters/https.routes.js`: credencial de dispositivo y requisito HTTPS/rate limit.
- `src/modules/module-integration/adapters/mqtt.adapter.js`: cliente, configuración TLS, recepción, backpressure y ACK seguro.
- `src/modules/module-integration/presence/presence.service.js`: expiración de presencia sin fabricar lecturas.
- `src/modules/module-integration/runtime.js`: arranque, estado y cierre del receptor/revisión periódica.
- `src/modules/module-integration/integration.routes.js`: administración, preview y permisos.
- `test/integrationContract.test.js`: contrato, normalización y adaptador MQTT.
- `test/ingestionIntegration.test.js`: HTTP/PostgreSQL, permisos, fuentes, perfiles, idempotencia, presencia y legado.
- `test/mqttRejection.test.js`: rechazo y confirmaciones sin credenciales en logs/respuestas.
- `test/mqttWire.test.js`: MQTT.js por TCP contra un broker mínimo de pruebas; no es un broker operativo.
- `docs/integration-common-model.md`: guía, contrato, seguridad y límites.
- `docs/increments/2026-10-18-common-ingestion-https-mqtt.md`: esta evidencia.

Frontend:

- `src/app/features/integrations/integration.models.ts`: contratos de perfil/mapping.
- `src/app/features/integrations/profile-editor.component.ts`: editor declarativo reutilizable.
- `src/app/features/integrations/integrations.page.ts`, `.html`, `.css`: fuentes operativas, versiones, credenciales, preview y últimos mensajes; diseño responsive con tokens.
- `src/app/features/integrations/integrations.spec.ts`: permisos, publicación, credenciales, preview y edición sin mutar originales.

## Archivos existentes modificados

- `backend/index.js`: proxy explícito, runtime y cierre con espera de tareas.
- `backend/src/modules/index.routes.js`: entrada de dispositivo independiente de IAM y rutas administrativas.
- `backend/src/modules/module-iot/measurements/measurements.model.js` y `.service.js`: snapshots, referencia al mensaje y reutilización de recepción/validación existentes.
- `backend/src/modules/module-iot/sensors/sensors.service.js`: protección transaccional del significado del histórico.
- `backend/src/modules/module-iot/devices/devices.service.js`: alcance de nuevas altas y compatibilidad controlada con legado.
- `backend/package.json` y `package-lock.json`: MQTT.js 5.16.1 y dependencias transitivas fijadas en lock.
- `backend/.env.example`: configuración documentada; no se cambian secretos del `.env` real.
- `backend/scripts/run-integration-isolated.js`: incorpora suites de ingesta y MQTT TCP y aísla variables de pruebas.
- `backend/README.md`: documentación del nuevo módulo.
- `frontend/src/app/app.routes.ts`: ruta diferida y guard de cambios/credencial pendiente.
- `frontend/src/app/shared/layout/navigation.component.ts`: acceso por permiso.
- `frontend/src/app/shared/ui/enum-label.ts`: auditoría de ingesta legible.
- `frontend/src/app/features/administration/resource.page.ts`: edición de protocolo legado y filtro de auditoría.
- `frontend/src/app/features/administration/resource-definitions.ts`: nuevas altas solo HTTPS/MQTT.
- `frontend/src/app/features/overview/overview.page.ts`: alcance operativo actualizado.
- `frontend/src/app/features/landing/landing.page.html`: alcance HTTPS/MQTT sin prometer ONVIF.
- `frontend/src/app/features/help/help.page.ts`: flujo de conexión y modelo versionado.
- `frontend/src/app/features/responsive.spec.ts`: editores de integración en móvil Light/Dark.
- `frontend/README.md`: guía y alcance actuales.

Los cambios de incrementos anteriores del mismo directorio se preservan. No se crea una organización nueva, no se cambian contraseñas y no se eliminan dispositivos antiguos.

## Verificación

- 43 unitarias backend aprobadas; cuatro suites de base/red omitidas deliberadamente en ejecución ordinaria y ejecutadas aparte.
- Ejecutor aislado: 25 resultados aprobados, correspondientes a 21 escenarios PostgreSQL/HTTP, tres grupos padre y una prueba MQTT real por TCP.
- 92 pruebas Angular aprobadas, incluyendo administración y formularios de integración a 360 px en Light/Dark.
- 11 pruebas de temas y 3 del calculador SUS aprobadas.
- Build Angular de producción/SSR aprobado; permanece advertencia previa del presupuesto CSS del tablero, no del módulo de integración.
- Migración aditiva aplicada localmente; no quedan cambios destructivos solicitados ni bootstrap ejecutado.

Se comprueban formatos distintos equivalentes, cero/falso, unidades/tipos, fechas/recepción, hash estable frente a orden de claves, límites/profundidad, revocación y cruce de credenciales, aislamiento organizacional, preview sin telemetría, historial, expiración, TLS obligatorio sin confiar en cabeceras falsas y preservación del inventario legado.

Las pruebas TCP usan un fixture de broker del propio test. No se presentan como conexión al broker de NOVAX ni prueba de TLS con sus certificados. Los casos PostgreSQL usan transacciones aisladas; no constituyen una prueba de carga ni de todas las carreras concurrentes en despliegue multinstancia.

## Aceptación y deuda pendientes

1. Configurar broker, usuarios de publicación/suscripción, ACL, límites y certificados reales; activar MQTT y comprobar «Suscrito al broker».
2. Configurar proxy HTTPS real y redes explícitas de confianza; no publicar el puerto HTTP interno.
3. Preparar dos emisores representativos, registrar sus sensores y perfiles, publicar formatos distintos y comprobar equivalencia en histórico/widget.
4. Verificar reintentos con el mismo sobre, corte/reconexión, deriva de reloj, baja de fuente y rotación en hardware.
5. Medir rendimiento/retención; no añadir Redis o una cola adicional sin evidencia de necesidad.

Otros límites: credenciales de fuente sin expiración automática; broker de confianza ve el sobre con credencial y debe proteger acceso/logs/retención; sin DLQ ni almacenamiento del payload crudo para reprocesamiento; contrato v1 por observación y hasta 32 campos; sin normalización automática de cadenas/arrays temporales ni ontología de unidades. No hay control ONVIF, vídeo, órdenes remotas ni alertas nuevas.

## TFM y defensa

Documentar requisitos y trazabilidad, modelo de entidades, frontera de adaptadores, contrato canónico, dos perfiles equivalentes, transacción/idempotencia, credenciales y preservación histórica. Añadir capturas de la gestión, muestras de entrada/salida sin secretos y evidencias con emisores reales. Separar claramente fixtures automatizados de despliegue y hardware.

Preguntas: ¿qué heterogeneidad se normaliza y cuál exige gateway? ¿Por qué una tabla Measurement común y no una por fabricante? ¿Qué diferencia hay entre protocolo y formato del payload? ¿Qué garantiza y qué no garantiza QoS 1? ¿Cómo se evita duplicar después de un commit sin ACK? ¿Por qué cambiar una unidad requiere otro sensor? ¿Por qué el modelo es versionado e inmutable? ¿Qué significa ONLINE exactamente? ¿Qué credenciales necesita un publicador MQTT y por qué el broker es frontera de confianza? ¿Cómo distingue auditoría un actor humano, una fuente y el sistema?
