#include <Arduino.h>
#include <ArduinoJson.h>
#include <ArduinoMqttClient.h>
#include <DHT.h>
#include <WiFi.h>
#include <esp_random.h>
#include <math.h>
#include <time.h>

#if __has_include("secrets.h")
#include "secrets.h"
#else
#include "secrets.example.h"
#endif

#if NOVAX_MQTT_TLS
#include <WiFiClientSecure.h>
WiFiClientSecure network;
#else
WiFiClient network;
#endif

static_assert(SAMPLE_INTERVAL_MS > 2000, "El intervalo del DHT11 debe superar dos segundos.");

constexpr uint32_t MQTT_RETRY_MS = 5000;
constexpr uint32_t ACK_TIMEOUT_MS = 15000;
constexpr uint8_t MAX_SEND_ATTEMPTS = 3;

DHT dht(DHT_PIN, DHT11);
MqttClient mqtt(network);
String telemetryTopic;
String ackTopic;
bool configured = false;
bool wifiWasConnected = false;
uint32_t lastMqttAttempt = 0;
uint32_t lastSample = 0;

struct PendingReading {
  char id[37] = {};
  char body[384] = {};
  size_t size = 0;
  uint8_t attempts = 0;
  uint32_t lastAttempt = 0;
};

PendingReading pending;

void generateUuid(char *output) {
  uint8_t bytes[16];
  esp_fill_random(bytes, sizeof(bytes));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  constexpr char hex[] = "0123456789abcdef";
  for (size_t i = 0; i < sizeof(bytes); ++i) {
    if (i == 4 || i == 6 || i == 8 || i == 10) {
      *output++ = '-';
    }
    *output++ = hex[bytes[i] >> 4];
    *output++ = hex[bytes[i] & 0x0f];
  }
  *output = '\0';
}

bool clockReady() {
  return time(nullptr) >= 1704067200;
}

void captureReading() {
  const float humidity = dht.readHumidity();
  const float temperature = SEND_TEMPERATURE ? dht.readTemperature() : 0;
  if (!isfinite(humidity) || !isfinite(temperature)) {
    Serial.println("Lectura DHT11 inválida. Revisa el GPIO y el cableado.");
    return;
  }

  generateUuid(pending.id);
  JsonDocument document;
  document["token"] = SOURCE_TOKEN;
  JsonObject message = document["message"].to<JsonObject>();
  message["schema_version"] = 1;
  message["message_id"] = pending.id;

  if (clockReady()) {
    const time_t now = time(nullptr);
    struct tm utc;
    char observedAt[21];
    if (gmtime_r(&now, &utc) && strftime(observedAt, sizeof(observedAt), "%Y-%m-%dT%H:%M:%SZ", &utc)) {
      message["observed_at"] = String(observedAt);
    }
  }

  JsonObject payload = message["payload"].to<JsonObject>();
  payload["humidity"] = humidity;
  if (SEND_TEMPERATURE) {
    payload["temperature"] = temperature;
  }
  if (document.overflowed() || measureJson(document) >= sizeof(pending.body)) {
    Serial.println("No se pudo preparar el mensaje MQTT.");
    return;
  }

  pending.size = serializeJson(document, pending.body, sizeof(pending.body));
  pending.attempts = 0;
  Serial.printf("Medición: %.1f %%", humidity);
  if (SEND_TEMPERATURE) {
    Serial.printf(" | %.1f °C", temperature);
  }
  Serial.println();
}

void onAck(int size) {
  char response[384];
  if (!pending.size || size <= 0 || static_cast<size_t>(size) >= sizeof(response) ||
      mqtt.messageTopic() != ackTopic || mqtt.messageRetain()) {
    return;
  }
  if (mqtt.readBytes(response, size) != static_cast<size_t>(size)) {
    return;
  }

  JsonDocument ack;
  if (deserializeJson(ack, response, size) ||
      strcmp(ack["message_id"] | "", pending.id) != 0) {
    return;
  }

  const char *status = ack["status"] | "";
  if (strcmp(status, "ACCEPTED") == 0 || strcmp(status, "DUPLICATE") == 0) {
    Serial.printf("NOVAX %s | lecturas: %d | mensaje: %s\n",
                  status, ack["reading_count"] | 0, pending.id);
  } else if (strcmp(status, "REJECTED") == 0) {
    Serial.printf("NOVAX REJECTED | %s | mensaje: %s\n",
                  ack["code"] | "SIN_CODIGO", pending.id);
  } else {
    return;
  }
  pending.size = 0;
}

bool connectWifi() {
  const uint32_t now = millis();
  if (WiFi.status() != WL_CONNECTED) {
    if (wifiWasConnected) {
      mqtt.stop();
      wifiWasConnected = false;
      Serial.println("Wi-Fi desconectado.");
    }
    return false;
  }
  if (!wifiWasConnected) {
    wifiWasConnected = true;
    lastMqttAttempt = now - MQTT_RETRY_MS;
    configTime(0, 0, "pool.ntp.org");
    Serial.print("Wi-Fi conectado. IP del ESP32: ");
    Serial.println(WiFi.localIP());
  }
  return true;
}

bool connectBroker() {
  if (mqtt.connected()) {
    return true;
  }
  const uint32_t now = millis();
  if (now - lastMqttAttempt < MQTT_RETRY_MS) {
    return false;
  }
  lastMqttAttempt = now;
#if NOVAX_MQTT_TLS
  if (!clockReady()) {
    Serial.println("Esperando hora NTP para verificar el certificado del broker.");
    return false;
  }
#endif
  if (!mqtt.connect(MQTT_HOST, MQTT_PORT)) {
    Serial.printf("Conexión MQTT fallida. Código: %d\n", mqtt.connectError());
    return false;
  }
  if (!mqtt.subscribe(ackTopic, 1)) {
    Serial.println("El broker no autorizó la suscripción a /ack.");
    mqtt.stop();
    return false;
  }
  Serial.println("MQTT conectado. Suscrito a /ack.");
  return true;
}

void sendPending() {
  const uint32_t now = millis();
  if (pending.attempts && now - pending.lastAttempt < ACK_TIMEOUT_MS) {
    return;
  }
  if (pending.attempts >= MAX_SEND_ATTEMPTS) {
    Serial.printf("Entrega sin confirmar para %s tras %u intentos.\n", pending.id, pending.attempts);
    pending.size = 0;
    return;
  }

  ++pending.attempts;
  pending.lastAttempt = now;
  Serial.printf("Envío %u/%u | mensaje: %s\n", pending.attempts, MAX_SEND_ATTEMPTS, pending.id);
  const bool sent = mqtt.beginMessage(telemetryTopic, static_cast<unsigned long>(pending.size), false, 1) &&
                    mqtt.write(reinterpret_cast<const uint8_t *>(pending.body), pending.size) == pending.size &&
                    mqtt.endMessage();
  if (!sent && pending.size) {
    Serial.println("Envío MQTT interrumpido. Se conserva el mismo mensaje para reintentar.");
    mqtt.stop();
  }
}

void setup() {
  Serial.begin(115200);
  configured = WIFI_SSID[0] && MQTT_HOST[0] && MQTT_USERNAME[0] && MQTT_PASSWORD[0] &&
               strlen(SOURCE_UUID) == 36 && strlen(SOURCE_TOKEN) == 54 &&
               strncmp(SOURCE_TOKEN, "nvx_ingest_", 11) == 0;
#if NOVAX_MQTT_TLS
  configured = configured && MQTT_CA_CERT[0];
#endif
  if (!configured) {
    Serial.println("Completa secrets.h con Wi-Fi, broker y credenciales de la fuente NOVAX.");
    return;
  }

  const String topic = String("novax/v1/sources/") + SOURCE_UUID;
  telemetryTopic = topic + "/telemetry";
  ackTopic = topic + "/ack";
  const uint64_t chipId = ESP.getEfuseMac();
  char clientId[24];
  snprintf(clientId, sizeof(clientId), "novax-%04x%08lx",
           static_cast<unsigned int>(chipId >> 32), static_cast<unsigned long>(chipId & 0xffffffff));

#if NOVAX_MQTT_TLS
  network.setCACert(MQTT_CA_CERT);
  network.setHandshakeTimeout(8);
#endif
  mqtt.setId(clientId);
  mqtt.setUsernamePassword(MQTT_USERNAME, MQTT_PASSWORD);
  mqtt.setConnectionTimeout(MQTT_RETRY_MS);
  mqtt.onMessage(onAck);

  dht.begin();
  WiFi.persistent(false);
  WiFi.mode(WIFI_STA);
  WiFi.onEvent([](WiFiEvent_t, WiFiEventInfo_t) {
    Serial.println("Wi-Fi asociado. Esperando dirección IP...");
  }, ARDUINO_EVENT_WIFI_STA_CONNECTED);
  WiFi.onEvent([](WiFiEvent_t, WiFiEventInfo_t info) {
    Serial.printf("Wi-Fi sin conexión. Motivo ESP32: %u\n",
                  static_cast<unsigned int>(info.wifi_sta_disconnected.reason));
  }, ARDUINO_EVENT_WIFI_STA_DISCONNECTED);
  WiFi.setAutoReconnect(true);
  lastSample = millis();
  Serial.println("Conectando a Wi-Fi...");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

void loop() {
  if (configured && connectWifi() && connectBroker()) {
    mqtt.poll();
    if (mqtt.connected()) {
      const uint32_t now = millis();
      if (!pending.size && now - lastSample >= SAMPLE_INTERVAL_MS) {
        lastSample = now;
        captureReading();
      }
      if (pending.size) {
        sendPending();
      }
    }
  }
  delay(10);
}
