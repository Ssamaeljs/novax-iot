const { onlyKeys, UUID } = require("../normalization/contract");
const AppError = require("../../../utils/handleError/AppError");

function configuration(env = process.env) {
  if (env.MQTT_ENABLED !== "true") return null;
  const url = new URL(env.MQTT_URL || "");
  if (!["mqtt:", "mqtts:"].includes(url.protocol) || url.username || url.password || url.search || (url.pathname && url.pathname !== "/")) throw new Error("Invalid MQTT broker configuration");
  if (env.NODE_ENV === "production" && (url.protocol !== "mqtts:" || !env.MQTT_USERNAME || !env.MQTT_PASSWORD)) throw new Error("Production MQTT requires TLS and broker credentials");
  const clientId = env.MQTT_CLIENT_ID || "novax-ingestion-v1";
  if (!/^[a-zA-Z0-9_-]{3,80}$/.test(clientId)) throw new Error("Invalid MQTT client id");
  return { url: url.toString(), options: { clientId, username: env.MQTT_USERNAME || undefined, password: env.MQTT_PASSWORD || undefined, clean: false, protocolVersion: 4, reconnectPeriod: 5000, connectTimeout: 10000, rejectUnauthorized: true, manualConnect: true } };
}
function sourceFromTopic(topic) {
  const match = /^novax\/v1\/sources\/([^/]+)\/telemetry$/.exec(String(topic));
  if (!match || !UUID.test(match[1])) throw new AppError("Topic no permitido", 422, "INVALID_MQTT_TOPIC");
  return match[1];
}
async function handlePacket(packet, ingest) {
  const sourceExternalId = sourceFromTopic(packet.topic);
  if (packet.retain) throw new AppError("La telemetría no admite mensajes retenidos", 422, "RETAINED_TELEMETRY_REJECTED");
  if (!packet.payload || packet.payload.length > 66560) throw new AppError("Paquete demasiado grande", 422, "MQTT_PACKET_TOO_LARGE");
  let wrapper;
  try { wrapper = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(packet.payload)); } catch { throw new AppError("JSON inválido o codificación UTF-8 incorrecta", 422, "INVALID_MQTT_JSON"); }
  onlyKeys(wrapper, ["token", "message"]);
  return ingest({ sourceExternalId, token: wrapper.token, envelope: wrapper.message, transport: "MQTT", request: { method: "MQTT", path: `mqtt:sources/${sourceExternalId}`, bodyFields: ["message"] } });
}
function startMqtt({ env = process.env, connect = require("mqtt").connect, ingest, logger = console } = {}) {
  const config = configuration(env);
  const state = { enabled: !!config, connected: false, subscription_ready: false, accepted: 0, duplicates: 0, rejected: 0, last_error: null, last_received_at: null };
  if (!config) return { status: () => ({ ...state }), stop: () => Promise.resolve() };
  const client = connect(config.url, config.options);
  let stopping = false, inFlight = Promise.resolve();
  const errorCode = (code) => { state.last_error = code; logger.warn({ component: "mqtt-ingestion", code }); };
  client.on("connect", () => {
    state.connected = true;
    client.subscribe("novax/v1/sources/+/telemetry", { qos: 1 }, (error, granted) => {
      state.subscription_ready = !error && !!granted?.length && granted.every((item) => item.qos < 128);
      if (!state.subscription_ready) errorCode("MQTT_SUBSCRIBE_FAILED"); else state.last_error = null;
    });
  });
  client.on("close", () => { state.connected = false; state.subscription_ready = false; });
  client.on("error", () => errorCode("MQTT_CONNECTION_ERROR"));
  // QoS 1 is acknowledged only after the database transaction has completed.
  client.handleMessage = (packet, callback) => {
    if (stopping) { callback(new Error("INGEST_STOPPED")); return; }
    inFlight = handlePacket(packet, ingest).then((result) => {
      state.last_received_at = new Date().toISOString();
      if (result.duplicate) state.duplicates++; else state.accepted++;
      const ack = { message_id: result.normalized.message_id, external_id: result.external_id, status: result.duplicate ? "DUPLICATE" : "ACCEPTED", reading_count: result.reading_count };
      if (!stopping) client.publish(String(packet.topic).replace(/telemetry$/, "ack"), JSON.stringify(ack), { qos: 1, retain: false }, (error) => { if (error) errorCode("MQTT_ACK_FAILED"); });
      callback();
    }).catch((error) => {
      state.rejected++;
      errorCode(error.isOperational ? error.code : "INGEST_TEMPORARY_FAILURE");
      if (error.isOperational) {
        if (error.sourceAuthenticated && !stopping) {
          try {
            const wrapper = JSON.parse(packet.payload.toString("utf8"));
            if (UUID.test(wrapper.message?.message_id || "")) client.publish(String(packet.topic).replace(/telemetry$/, "ack"), JSON.stringify({ message_id: wrapper.message.message_id, status: "REJECTED", code: error.code }), { qos: 1, retain: false }, (failure) => { if (failure) errorCode("MQTT_ACK_FAILED"); });
          } catch { /* Invalid envelopes have no safe application acknowledgement. */ }
        }
        callback(); // Discard poison messages; do not loop forever.
      }
      else { callback(new Error("INGEST_TEMPORARY_FAILURE")); client.stream?.destroy(); }
    });
  };
  client.connect();
  return { status: () => ({ ...state }), stop: async () => { stopping = true; await new Promise((resolve) => client.end(true, {}, resolve)); await inFlight; } };
}
module.exports = { configuration, sourceFromTopic, handlePacket, startMqtt };
