# Simuladores Python para NOVAX IoT

Ejecuta los comandos desde la raíz del repositorio con Python 3.10 o posterior. Los dos simuladores envían una lectura de **80 %** por defecto. Puedes registrar el primer emisor como ESP32 y el segundo como simulador HTTPS.

Para un ESP32 físico con DHT11, abre la [guía del sketch para Arduino IDE](esp32_mqtt/README.md).

## Configura las dos fuentes

1. Registra un dispositivo con protocolo **MQTT** y otro con **HTTPS**, ambos activos.
2. En cada dispositivo, añade un canal activo de humedad con magnitud `humidity`, unidad `%` y tipo **Número**. La plantilla **DHT11 · Humedad** crea la clave `dht11_humidity`.
3. En **Integraciones → Modelos de datos**, publica un perfil con **Ruta en payload** `humidity`, **Clave del sensor** igual a la que guardaste en el canal, **Magnitud común** `humidity`, **Tipo** Número, **Unidad final** `%`, **Escala** 1 y **Desplazamiento** 0. Marca el campo como obligatorio. Puedes reutilizar el perfil en ambos dispositivos si comparten clave, magnitud, tipo y unidad. Para una fuente existente, comprueba la versión del perfil que aparece en su fila.
4. En **Integraciones → Fuentes**, crea una fuente para cada dispositivo y selecciona su transporte y perfil. Guarda la credencial al crear la fuente y toma su UUID desde **Destino del dispositivo**. Cada simulador usa el UUID y la credencial de su propia fuente.

## ESP32 simulado por MQTT

```powershell
python -m pip install -r examples/iot/requirements.txt
$mqttSource = Read-Host 'UUID de la fuente MQTT'
python examples/iot/esp32_mqtt.py --source $mqttSource
```

El broker por defecto es `mqtt://127.0.0.1:1883` y el usuario de laboratorio es `novax_emitter`. El script pide la contraseña de ese usuario y la credencial de la fuente sin mostrar lo que escribes. Si tu cuenta del broker es distinta, pasa `--username`. También admite `MQTT_TEST_USERNAME`, `MQTT_TEST_PASSWORD` y `NOVAX_SOURCE_TOKEN` como variables de entorno. Para el Compose de laboratorio, la contraseña del emisor corresponde a `MQTT_TEST_PASSWORD` de tu `.env`.

El script se suscribe a `/ack` antes de publicar en `/telemetry`, con QoS 1 y `retain` desactivado. **ACCEPTED** confirma una recepción nueva de NOVAX. **DUPLICATE** confirma que NOVAX ya procesó ese mensaje. Ante un rechazo, muestra el código del servidor y se detiene.

## Dispositivo simulado por HTTP o HTTPS

```powershell
$httpSource = Read-Host 'UUID de la fuente HTTPS'
python examples/iot/device_http.py --source $httpSource --base-url http://localhost:8080
```

Este script usa la biblioteca estándar de Python. Pide la credencial de la fuente si `NOVAX_SOURCE_TOKEN` no está definida. Envía un `POST` a `/v1/api/ingest/https/{UUID_FUENTE}`, con el sobre JSON en el cuerpo y la credencial en la cabecera `Authorization`. Una recepción nueva devuelve **HTTP 201**. Un reenvío ya procesado devuelve **HTTP 200** con `duplicate: true`.

Para un servidor con TLS, pasa `--base-url https://tu-servidor` o `--broker mqtts://tu-broker:8883`, según el simulador. Ambos verifican los certificados y admiten `--ca-file ruta/al/certificado-ca.pem` para una CA privada. El HTTP del Compose local prueba el adaptador sin TLS. Para usar deliberadamente una URL sin TLS fuera de loopback, añade `--allow-insecure`.

## Variar los datos y comprobar la ingesta

- Añade `--count 10 --interval 5 --jitter 2` para enviar diez lecturas separadas por cinco segundos, con variación de hasta dos puntos alrededor de la humedad inicial.
- `--temperature 24.6` añade la propiedad `temperature`. Configura su canal y su mapeo en el perfil si quieres que NOVAX la registre.
- Para simular un formato distinto, guarda por ejemplo `{"env":{"rh":0.8}}` en un archivo JSON y pasa `--payload-file ruta/al/archivo.json`. En el perfil de esa fuente usa **Ruta en payload** `env.rh` y **Escala** 100 para obtener **80 %**.
- Cada observación tiene su propio UUID y fecha UTC. Ante un fallo transitorio, los reintentos de esa ejecución conservan el sobre completo.
- Comprueba cada envío en **Integraciones → Mensajes recibidos** y en **Reportes** del sensor. Si aparece `SENSOR_PROFILE_MISMATCH`, compara clave, magnitud, unidad final y tipo del perfil con el canal activo. El nombre de la propiedad JSON se compara con **Ruta en payload**.
