# ESP32 con DHT11 por MQTT

El sketch toma una lectura de humedad cada 10 segundos y la envía a NOVAX. Conserva **GPIO32** del sketch de referencia. Si cableaste el sensor según la figura del TFM, cambia `DHT_PIN` a **27** para que coincida con el montaje.

Para el DHT11 de cuatro pines de la figura, conecta **VDD a 3V3**, **DATA al GPIO configurado**, deja **NC libre** y conecta **GND a GND**. Coloca una resistencia de **4,7 kΩ** entre DATA y 3V3, con cables cortos. [Ficha técnica del DHT11](https://www.aosong.com/userfiles/files/media/DHT11-V1_3%E8%AF%B4%E6%98%8E%E4%B9%A6%EF%BC%88%E8%AF%A6%E7%BB%86%E7%89%88%EF%BC%89.pdf)

## 1. Prepara Arduino IDE

1. Instala **esp32 by Espressif Systems** desde el Gestor de placas. Para un ESP32 DevKit clásico, selecciona **ESP32 Dev Module**. Consulta la [guía de Espressif](https://docs.espressif.com/projects/arduino-esp32/en/latest/installing.html).
2. Instala **ArduinoMqttClient**, **ArduinoJson 7.x**, **DHT sensor library** de Adafruit y su dependencia **Adafruit Unified Sensor** desde el Gestor de bibliotecas. [ArduinoMqttClient](https://github.com/arduino-libraries/ArduinoMqttClient) · [ArduinoJson 7](https://arduinojson.org/v7/how-to/use-arduinojson-with-arduinomqttclient/) · [DHT sensor library](https://github.com/adafruit/DHT-sensor-library)
3. Abre `esp32_mqtt.ino` en su carpeta. Copia `secrets.example.h` a `secrets.h` y completa los datos de tu entorno. Git ignora `secrets.h`.

## 2. Vincula el canal y la fuente

1. En NOVAX, abre el dispositivo MQTT y comprueba que el canal de humedad esté activo. Usa su clave guardada, su magnitud `humidity`, unidad `%` y tipo Número.
2. Comprueba que la fuente apunte a un perfil con **Ruta en payload** `humidity` y **Clave del sensor** igual a la del canal. Para la fuente del ejercicio anterior que ya guardó 80 %, la clave es `humidity`. Si usas la plantilla del DHT11 en un dispositivo nuevo, la clave inicial es `dht11_humidity`.
3. En **Integraciones → Fuentes → Destino del dispositivo**, copia el UUID que aparece entre `sources/` y `/telemetry` a `SOURCE_UUID`. En `SOURCE_TOKEN`, pega la credencial de esa fuente.
4. Si quieres publicar también temperatura, añade el canal y su mapeo con **Ruta en payload** `temperature`, unidad `°C` y tipo Número. Vincula la fuente a esa versión y cambia `SEND_TEMPERATURE` a `true`.

## 3. Conecta el ESP32 al broker

| Ajuste en `secrets.h` | Valor |
| --- | --- |
| `WIFI_SSID`, `WIFI_PASSWORD` | Red a la que se conecta el ESP32. |
| `MQTT_HOST`, `MQTT_PORT` | Nombre o IP y puerto del broker accesible desde esa red. |
| `MQTT_USERNAME`, `MQTT_PASSWORD` | Cuenta del broker con acceso para publicar en el tópico `/telemetry` y leer `/ack`. En el laboratorio corresponden a `MQTT_TEST_USERNAME` y `MQTT_TEST_PASSWORD` del `.env`. |
| `NOVAX_MQTT_TLS`, `MQTT_CA_CERT` | Para un broker con TLS, usa `1`, ajusta el puerto y pega la CA en PEM. Usa un host que coincida con el certificado. |

Para guardar el PEM de varias líneas en `secrets.h`, reemplaza el valor de `MQTT_CA_CERT` por un literal de la forma `R"PEM(...contenido del certificado...)PEM"`, conservando las líneas `BEGIN CERTIFICATE` y `END CERTIFICATE`.

### Probar con el broker Compose en una red privada de laboratorio

Compose publica el broker en `127.0.0.1:1883` para el equipo anfitrión. Para admitir conexiones desde la red privada, añade `NOVAX_MQTT_LAN_IP=192.168.1.50` al `.env` de la raíz y sustituye la dirección por la IP privada de tu equipo.

```powershell
docker compose up -d --no-deps --wait mosquitto
```

Configura esa IP en `MQTT_HOST`, el valor de `NOVAX_MQTT_PORT` (1883 por defecto) en `MQTT_PORT` y `NOVAX_MQTT_TLS` en `0`. Si cambia la IP del anfitrión, actualiza ambos archivos. Para volver al acceso exclusivo desde el equipo anfitrión, establece `NOVAX_MQTT_LAN_IP=127.0.0.1` y repite el comando. [Publicación en una IP específica](https://docs.docker.com/reference/compose-file/services/#ports)

## 4. Carga y verifica

1. Selecciona la placa y el puerto USB en Arduino IDE, pulsa **Subir** y abre el **Monitor serie** a **115200 baudios**.
2. Espera **MQTT conectado. Suscrito a /ack.** y luego **NOVAX ACCEPTED**. La publicación usa QoS 1 y `retain` desactivado. El ACK de NOVAX confirma la persistencia.
3. En **Integraciones → Mensajes recibidos**, comprueba la recepción. Abre **Reportes** desde la tarjeta del sensor para comprobar su valor y fecha.
4. Si ves `SENSOR_PROFILE_MISMATCH`, compara la clave, magnitud, unidad final y tipo del perfil con el canal activo del dispositivo. Comprueba la **versión del perfil de la fuente**. Si no llega ACK, revisa la IP, el puerto, la suscripción MQTT del backend y las dos credenciales.

El sketch sincroniza UTC por NTP. Si el reloj todavía no está sincronizado y usas MQTT de laboratorio, NOVAX asigna su hora de recepción. Con TLS el sketch espera al reloj para validar el certificado. Los reintentos conservan el UUID y el JSON de la lectura pendiente en memoria durante hasta tres envíos.

### Si el ESP32 se queda conectando a Wi-Fi

El ESP32 clásico usa Wi-Fi de **2,4 GHz**. Si tu router tiene nombres separados por banda, usa el nombre de la red de 2,4 GHz en `secrets.h`. El sketch muestra si la placa se asocia al router, obtiene una IP o recibe un motivo de desconexión. [Ficha técnica del ESP32](https://documentation.espressif.com/esp32_datasheet_en.html)

| Mensaje del monitor | Qué revisar |
| --- | --- |
| `Motivo ESP32: 201` | El ESP32 no encontró el punto de acceso. Comprueba el nombre de red, la banda de 2,4 GHz y la señal. |
| `Motivo ESP32: 202` o `204` | Revisa la autenticación y el modo de seguridad. Para aislar el fallo, prueba una red de 2,4 GHz con WPA2-Personal. |
| `Wi-Fi asociado. Esperando dirección IP...` sin una IP posterior | Revisa que el router asigne una dirección IP por DHCP. |
| `Wi-Fi conectado. IP del ESP32: ...` seguido de error MQTT | Revisa la dirección y el puerto del broker desde la red de la placa. |

[Motivos de desconexión de Espressif](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-guides/wifi.html#wi-fi-reason-code)

La versión con diagnóstico Wi-Fi se compiló para **ESP32 Dev Module** con Arduino-ESP32 3.3.12. Las variantes MQTT y MQTT con TLS se verificaron inicialmente con Arduino-ESP32 2.0.17, ArduinoMqttClient 0.1.8, ArduinoJson 7.4.3 y DHT sensor library 1.4.7.
