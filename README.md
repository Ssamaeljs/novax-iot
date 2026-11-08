# NOVAX IoT

Plataforma para integrar y gestionar dispositivos IoT heterogéneos en NOVAX. El propósito del prototipo es que equipos con protocolos y formatos distintos produzcan mediciones comparables que se puedan consultar desde la misma aplicación web.

El sistema permite administrar usuarios, roles y permisos; registrar dispositivos y sus canales; recibir telemetría por HTTPS o MQTT; definir perfiles de normalización; consultar histórico, presencia y auditoría; y configurar tableros con widgets. Un ESP32 con DHT11 se representa como un dispositivo con dos canales, temperatura y humedad. Registrar un canal no configura el cableado ni el firmware. Los colores condicionales de los widgets no son alertas persistentes.

## Arranque rápido con Docker

Este Compose es para **laboratorio y demostración local**, no para publicar en Internet. Incluye PostgreSQL, migraciones, backend, Angular servido por Nginx y un Mosquitto de prueba. Usa HTTP local y MQTT autenticado **sin TLS**. No apunta a la base de datos ni al broker de tu instalación existente.

### 1 Preparar Docker y la configuración

1. Descarga o clona este repositorio y abre una terminal en su raíz, donde está `compose.yaml`.
2. Instala Docker Engine con Compose v2 actualizado o abre Docker Desktop en modo **contenedores Linux**. Comprueba que `docker version` muestre tanto `Client` como `Server` y que `docker compose version` responda. La instalación se verificó con Compose v2.40.0 y los comandos usan la opción `--wait`.
3. Genera `.env` con secretos aleatorios. Si tienes Node.js 22 en el equipo:

   ```sh
   node docker/init-env.cjs
   ```

   Si no tienes Node.js, puedes usar solo Docker desde PowerShell, Bash o Zsh:

   ```sh
   docker run --rm -v "${PWD}:/workspace" -w /workspace node:22-bookworm-slim node docker/init-env.cjs
   ```

   El generador usa [`.env.example`](.env.example), no imprime secretos y no sobrescribe un `.env` existente. Si preparas el archivo manualmente, asigna valores privados a `NOVAX_DB_PASSWORD`, `NOVAX_BOOTSTRAP_SECRET` (mínimo 32 caracteres), `MQTT_PASSWORD` y `MQTT_TEST_PASSWORD` (distintas, mínimo 16 caracteres). El archivo de la raíz es para Compose; `backend/.env` sigue siendo independiente para desarrollo sin Docker. No publiques ninguno.

### 2 Construir y arrancar

```sh
docker compose config --quiet
docker compose up --build -d --wait --wait-timeout 120
docker compose ps -a
```

El primer build descarga imágenes y paquetes. PostgreSQL inicializa un volumen nuevo; `migrate` aplica las migraciones pendientes. El backend espera a que la migración termine bien y a que Mosquitto acepte una conexión autenticada. El frontend espera a que el backend responda. **`migrate` con `Exited (0)` es el resultado esperado**; no debe quedarse ejecutándose. No se restaura un dump ni se ejecuta `db:reset`.

| Acceso | Dirección por defecto | Alcance |
| --- | --- | --- |
| Web | `http://localhost:8080` | Navegador del equipo que ejecuta Docker. |
| Salud de API | `http://localhost:8080/api/health` | Nginx la reenvía al backend; no confirma suscripción MQTT. |
| API | `http://localhost:8080/v1/api` | Mismo origen que la web; no se publica directamente el puerto 5000. |
| Broker para clientes en el host | `mqtt://127.0.0.1:1883` | Cuenta de emisor `MQTT_TEST_USERNAME` y `MQTT_TEST_PASSWORD`. |
| Broker desde contenedores | `mqtt://mosquitto:1883` | Nombre DNS interno; no usar `localhost` desde el backend. |
| Base de datos | `db:5432` | Red interna; no se publica al host. |

Si un puerto está ocupado, cambia `NOVAX_WEB_PORT` o `NOVAX_MQTT_PORT` en `.env` y vuelve a ejecutar `docker compose up -d --wait`. Cambia también la URL que abres en el navegador. Para una demo en un servidor remoto, mantén los puertos en loopback y usa un túnel SSH autorizado. Por ejemplo, con puertos remotos por defecto, `ssh -L 8080:127.0.0.1:8080 -L 1883:127.0.0.1:1883 usuario@servidor`; luego usa las mismas direcciones locales. No abras el broker de laboratorio en el firewall.

### 3 Crear el primer administrador

En una base nueva, ejecuta en una **terminal interactiva**:

```sh
docker compose exec backend node scripts/compose-bootstrap.js
```

Introduce nombre, apellido, documento o código ficticio de laboratorio (ejemplo `LAB-001`), usuario, correo y contraseña. Usa al menos 12 caracteres y como máximo 72 bytes UTF-8; la contraseña no se muestra. El asistente utiliza el secreto de bootstrap del contenedor y crea NOVAX con el rol `TENANT_OWNER`. Si indica que ya se inicializó, entra con la cuenta existente; **no borres la base**. El registro público está deshabilitado. El Compose no configura correo SMTP; no esperes recibir un correo de recuperación.

Entra en la web con el usuario o correo y la contraseña que acabas de elegir. No se necesita escribir un tenant ni usar un token para el login. Desde **Administración** puedes registrar personas, crear sus cuentas y asignar roles según los permisos de cada tarea.

## Operar y comprobar la integración MQTT

1. En **Dispositivos**, registra un equipo con protocolo **MQTT** y abre su detalle. Añade un canal con clave `humidity`, magnitud `humidity`, tipo `Número` y unidad `%`.
2. En **Integraciones → Modelos de datos**, crea un perfil con ruta de entrada `hum`, clave de sensor `humidity`, magnitud `humidity`, tipo `NUMBER`, unidad final `%`, escala `1`, desplazamiento `0` y campo obligatorio. La unidad de origen puede ser `%`.
3. En **Integraciones → Fuentes**, crea una fuente MQTT que vincule el dispositivo y esa versión del perfil. Copia el UUID de la **fuente** del tópico y su credencial, que solo se muestra una vez. Si la pierdes, rota la credencial; la anterior deja de funcionar.
4. Comprueba que el indicador muestre **Suscrito al broker**. Eso acredita la suscripción del backend, no que una medición concreta se haya guardado.
5. Envía una lectura con la herramienta incluida. No necesitas instalar otro cliente en el host:

   ```sh
   docker compose run --rm mqtt-test
   ```

   Introduce el UUID de la fuente, su credencial y el payload `{"hum":72.4}` en una sola línea. La herramienta crea el sobre con UUID y fecha, publica con QoS 1 sin `retain` y espera el ACK de NOVAX. Debe aparecer `ACCEPTED` y una lectura. En el detalle del dispositivo, pulsa **Sincronizar** y comprueba `72.4 %`; abre **Reportes** para ver el histórico. Sincronizar actualiza la vista, no envía comandos al equipo.

Si usas un cliente MQTT externo, conecta con la cuenta **de emisor del broker**, publica en `novax/v1/sources/<UUID_FUENTE>/telemetry` y suscríbete al tópico hermano `/ack` antes de enviar. La credencial que va en `token` es la de la **fuente NOVAX**, no la contraseña del broker. Usa un UUID nuevo por observación; al reintentar conserva el mismo sobre completo. El ACK del broker no prueba persistencia; el ACK de aplicación `ACCEPTED` y el histórico sí permiten comprobarla. Consulta el [contrato completo y ejemplos](backend/docs/integration-common-model.md).

El servicio `mosquitto` construye la imagen `novax-mosquitto:lab` a partir de Eclipse Mosquitto 2.0.22. No admite usuarios anónimos: la cuenta del backend lee telemetría y publica ACK; la del emisor publica telemetría y lee ACK. En el laboratorio la cuenta del emisor puede usar los tópicos de fuentes de prueba; la credencial de cada fuente se valida en la API. No es una política de ACL por dispositivo para producción. El broker de laboratorio no guarda mensajes al reiniciar.

Para probar el adaptador HTTP, registra un equipo con protocolo `HTTPS`, un canal y una fuente HTTPS. El destino local es `http://localhost:8080/v1/api/ingest/https/<UUID_FUENTE>`, con `Authorization: Bearer <CREDENCIAL_DE_FUENTE>` y el sobre JSON **sin** el envoltorio MQTT. Esto prueba recepción, autenticación y persistencia del adaptador, **no acredita TLS**. Para el TFM, documenta el entorno real si presentas HTTPS cifrado o MQTT sobre TLS.

## Prueba automática de la instalación

El smoke crea datos ficticios, por lo que debe ejecutarse únicamente en una **base QA nueva**. Usa otro proyecto Compose y los puertos 28080 y 11883, separados del laboratorio habitual (ajústalos en `docker/qa.env` si están ocupados):

```sh
docker compose -p novax-iot-qa --env-file .env --env-file docker/qa.env up --build -d --wait --wait-timeout 120
docker compose -p novax-iot-qa --env-file .env --env-file docker/qa.env run --rm -T smoke
docker compose -p novax-iot-qa --env-file .env --env-file docker/qa.env down
```

Comprueba ruta profunda de Angular, proxy, bootstrap, login con cookie, suscripción MQTT, persistencia, reenvío `DUPLICATE` y equivalencia de lecturas entre MQTT y HTTP local. No imprime contraseñas ni tokens. Si el proyecto QA ya tiene una cuenta, la prueba se detiene sin modificarla; para repetir, usa un **nombre de proyecto QA nuevo** y puertos libres. `down` deja el volumen intacto. No uses `down -v` sobre una instalación que quieras conservar.

## Arquitectura

```text
Navegador ──► Nginx ──► archivos Angular
                └── /v1/api ──► Express: identidad, inventario, histórico y tableros

Emisor HTTP(S) ──► Nginx ──────► Adaptador HTTPS ─┐
Emisor MQTT ─────► Mosquitto ──► Adaptador MQTT ──┴──► Ingesta común ──► PostgreSQL
```

El backend es un **monolito modular**. Los adaptadores aíslan el transporte; la fuente resuelve identidad y perfil; el normalizador transforma el payload a lecturas tipadas. El servicio común valida, deduplica y persiste en una transacción que incluye presencia y auditoría. Los tableros e históricos consultan mediciones, no consumen tópicos MQTT directamente. Sequelize y Umzug gestionan modelos y migraciones. La API usa identificadores públicos `external_id`; los ID relacionales quedan internos.

El frontend es Angular. El contenedor Nginx sirve la landing prerenderizada y la aplicación cliente para las demás rutas; `index.csr.html` permite recargar rutas como `/app/device/<UUID>`. La API comparte origen con la web para mantener las cookies de sesión. Este despliegue no reemplaza el servidor SSR disponible para otros entornos.

## Estructura del repositorio

```text
novax-iot-lab/
├── compose.yaml               # Servicios, redes, volumen y salud
├── .env.example               # Plantilla de configuración de Compose
├── docker/
│   ├── init-env.cjs            # Genera .env privado sin sobrescribirlo
│   ├── qa.env                 # Puertos de QA, sin credenciales
│   └── mosquitto/             # Dockerfile, listener, usuarios y ACL de laboratorio
├── backend/
│   ├── Dockerfile             # API, migraciones y herramientas Node
│   ├── index.js               # Arranque de Express y runtime MQTT
│   ├── src/
│   │   ├── config/            # PostgreSQL, Sequelize y alcance NOVAX
│   │   ├── helpers/autoCrud/  # CRUD, validación y serialización reutilizables
│   │   ├── middleware/       # Autenticación y autorización
│   │   └── modules/
│   │       ├── bootstrap/    # Inicialización única de NOVAX
│   │       ├── module-core/  # Organización, usuarios y cuentas
│   │       ├── module-iam/   # Sesiones, roles, permisos y tokens API
│   │       ├── module-iot/   # Dispositivos, sensores y mediciones
│   │       ├── module-integration/ # Adaptadores, fuentes, perfiles, ingesta, presencia
│   │       ├── module-projects/    # Proyectos, tableros y widgets
│   │       └── module-audit/       # Registro y consulta de auditoría
│   ├── scripts/              # Migraciones, mantenimiento y utilidades Compose
│   ├── test/                 # Pruebas de backend e integración
│   └── docs/                 # Contratos, guías y evidencias por incremento
└── frontend/
    ├── Dockerfile            # Compilación Angular y servidor Nginx
    ├── nginx.conf            # Rutas Angular y proxy de API
    ├── src/app/
    │   ├── core/             # Cliente API, sesión, permisos y tema
    │   ├── features/         # Pantallas organizadas por funcionalidad
    │   ├── layouts/          # Área pública y espacio autenticado
    │   └── shared/           # Componentes y utilidades reutilizables
    ├── src/styles/           # Tokens y estilos semánticos Light/Dark
    └── docs/                 # Responsive, navegación y protocolo SUS
```

## Diagnóstico y mantenimiento

| Síntoma | Qué comprobar |
| --- | --- |
| `Cannot connect to the Docker daemon` o falta `dockerDesktopLinuxEngine` | Abre Docker Desktop, espera a que inicie el motor Linux y repite `docker version`. La CLI instalada no es suficiente. |
| `migrate` sale con código distinto de 0 | `docker compose logs migrate db`. Comprueba contraseña y nombre de base. El usuario, nombre y contraseña de PostgreSQL se inicializan al crear el volumen; cambiar variables en `.env` no cambia una base ya creada. |
| Web no disponible o `502` | `docker compose ps -a`, `docker compose logs frontend backend` y `/api/health`. Verifica el puerto y el estado de `migrate`. |
| Login devuelve error de origen | Usa `http://localhost:<NOVAX_WEB_PORT>` o `http://127.0.0.1:<NOVAX_WEB_PORT>`; no uses un dominio/IP distintos sin configurar el origen. |
| MQTT deshabilitado o sin suscripción | Comprueba `MQTT_ENABLED=true`, `MQTT_URL=mqtt://mosquitto:1883`, las credenciales del backend y `docker compose logs backend mosquitto`. Recrea los contenedores con `docker compose up -d` tras cambiar variables. |
| Mosquitto recibe, pero NOVAX no guarda | Revisa el UUID de **fuente**, la credencial de fuente, tópico, perfil, tipo del valor, estado activo y ausencia de `retain`. Comprueba `/ack` y el histórico. |

Para detener sin perder datos: `docker compose stop`. Para retirar contenedores y redes conservando datos: `docker compose down`. Para reconstruir después de cambios de código: `docker compose up --build -d --wait`. Guarda un respaldo antes de actualizar una instalación que contenga datos importantes.

Para un despliegue fuera del laboratorio se requieren HTTPS para web/API, `mqtts://` con certificados válidos, ACL por tópico/dispositivo, orígenes y proxies confiables explícitos, gestión de secretos y copias de seguridad. No basta con cambiar `NODE_ENV` en este Compose: el stack de laboratorio no trae certificados ni un proxy TLS público. Consulta las guías de [backend](backend/README.md), [frontend](frontend/README.md) y [modelo común](backend/docs/integration-common-model.md).

Referencias de infraestructura: [orden de arranque en Compose](https://docs.docker.com/compose/how-tos/startup-order/), [variables de Compose](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/) e [imagen oficial Eclipse Mosquitto](https://hub.docker.com/_/eclipse-mosquitto).

Resultados de la verificación local: [registro del incremento Docker Compose](backend/docs/increments/compose-lab.md).
