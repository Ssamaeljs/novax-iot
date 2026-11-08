# Despliegue reproducible de NOVAX IoT en laboratorio

## Requisito y decisiones

El objetivo del incremento es instalar el prototipo desde el repositorio con Docker Compose, inicializar una base vacía sin un dump y demostrar la recepción MQTT con un broker real de laboratorio. No cambia el modelo de datos ni la lógica de negocio.

- Una imagen de backend se reutiliza en la API, las migraciones y las herramientas. Solo `backend` define su construcción, para evitar que dos compilaciones paralelas intenten etiquetar la misma imagen.
- Nginx sirve Angular y reenvía la API en el mismo origen. La entrada CSR soporta recargas de rutas internas. No se reemplaza la configuración SSR existente fuera de Compose.
- PostgreSQL permanece en una red interna, con volumen persistente. El arranque espera la salud de PostgreSQL y la finalización exitosa de Umzug. El administrador se crea mediante el bootstrap existente, una sola vez.
- La imagen `novax-mosquitto:lab` deriva de `eclipse-mosquitto:2.0.22`; arranca sin privilegios de root, sin acceso anónimo y con cuentas separadas para consumidor y emisor. La credencial de fuente sigue siendo necesaria a nivel de aplicación. No se publican puertos de broker ni web fuera de loopback.
- `.env.example` es versionable; `docker/init-env.cjs` crea `.env` privado con secretos aleatorios y no sobrescribe archivos existentes. No se copian archivos `.env` al build.

## Archivos del incremento

- `compose.yaml`, `.env.example`, `.gitignore`, `.gitattributes`, `docker/init-env.cjs`, `docker/qa.env` y `README.md`.
- `backend/Dockerfile`, `backend/.dockerignore`, `backend/scripts/compose-bootstrap.js`, `compose-prompts.js`, `compose-mqtt-client.js`, `compose-mqtt-send.js`, `compose-smoke.js` y `backend/test/composeMqttClient.test.js`.
- `frontend/Dockerfile`, `frontend/.dockerignore`, `frontend/nginx.conf` y `frontend/nginx-api-proxy.conf`.
- `docker/mosquitto/`: Dockerfile, exclusiones, configuración, inicialización de usuarios y comprobación autenticada de salud.

## Evidencia ejecutada

Entorno: Docker Desktop con motor Linux 28.5.1 y Compose v2.40.0, Node 22.23.4, PostgreSQL 16.15, Nginx 1.30.6 y Mosquitto 2.0.22. Proyecto aislado `novax-iot-qa-final`, volumen nuevo, puertos de host 28080 y 11883.

| Comprobación | Resultado |
| --- | --- |
| Compose y construcción | Configuración válida; imágenes `novax-backend:local`, `novax-frontend:local` y `novax-mosquitto:lab` construidas. |
| Arranque | PostgreSQL, Mosquitto, backend y frontend saludables; `migrate` salió con código 0. |
| Navegación y sesión | Ruta profunda de Angular y proxy de salud correctos; bootstrap, login y cookie web verificados mediante Nginx. |
| Asistente interactivo | La contraseña de prueba no se mostró. Reintentar la inicialización en una base ya preparada devolvió el rechazo esperado sin sobrescribir la cuenta. |
| Telemetría MQTT | Publicación a Mosquitto real, ACK `ACCEPTED`, reenvío `DUPLICATE` con la misma recepción y una sola medición persistida. |
| Modelo común | `env.rh=0.724` por MQTT con escala 100 y `hum=72.4` por HTTP local produjeron sendas mediciones equivalentes a 72,4 %. |
| Seguridad de laboratorio | Publicación anónima rechazada por Mosquitto; `.env` no está presente en la imagen del backend. |
| Regresión | 45 pruebas unitarias correctas, cuatro escenarios opt-in omitidos en esa ejecución; 28 pruebas de integración correctas en el verificador aislado. Angular compiló dentro y fuera de Docker. |

La reproducción está descrita en el [README general](../../../README.md). El smoke usa datos ficticios en una base QA nueva y no imprime credenciales. La base de NOVAX ya existente y `backend/.env` no se modificaron.

## Límites y seguimiento

- La prueba del adaptador HTTPS utilizó HTTP local. No acredita TLS, un dispositivo físico, rendimiento bajo carga, seguridad productiva ni evaluación SUS.
- El broker no persiste mensajes y sus permisos son para una cuenta emisora de laboratorio; en producción se deben usar certificados y permisos por fuente. No se debe publicar este Compose directamente en Internet.
- La compilación conserva la advertencia previa de CSS del tablero (4,45 kB frente a 4 kB). El build terminó correctamente. Se mantienen los lockfiles y no se cambiaron las dependencias de la aplicación.
- Para la memoria: registrar versiones, topología, puertos, `ACCEPTED`/`DUPLICATE` y resultado del histórico. En defensa, explicar por qué se separan autenticación del broker y credencial de fuente, por qué el ACK de aplicación prueba algo distinto al ACK del broker y cómo se preserva la base entre arranques.
