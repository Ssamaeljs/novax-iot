#pragma once

// Copia este archivo como secrets.h y completa los datos de tu instalación.
constexpr char WIFI_SSID[] = "";
constexpr char WIFI_PASSWORD[] = "";

// Usa el host del broker accesible desde el ESP32, sin mqtt:// ni mqtts://.
constexpr char MQTT_HOST[] = "";
constexpr uint16_t MQTT_PORT = 1883;
constexpr char MQTT_USERNAME[] = "novax_emitter";
constexpr char MQTT_PASSWORD[] = "";

// Para MQTT con TLS, cambia NOVAX_MQTT_TLS a 1, ajusta el puerto y pega la CA.
#define NOVAX_MQTT_TLS 0
constexpr char MQTT_CA_CERT[] = "";

constexpr char SOURCE_UUID[] = "";
constexpr char SOURCE_TOKEN[] = "";

constexpr uint8_t DHT_PIN = 32;
constexpr bool SEND_TEMPERATURE = false;
constexpr uint32_t SAMPLE_INTERVAL_MS = 10000;
