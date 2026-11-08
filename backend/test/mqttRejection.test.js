const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { EventEmitter } = require("node:events");
const { startMqtt } = require("../src/modules/module-integration/adapters/mqtt.adapter");
const AppError = require("../src/utils/handleError/AppError");
test("MQTT rejects authenticated bad data with safe application status, but never answers unauthenticated sources", async () => {
  const client = new EventEmitter(), acks = [], logs = [];
  client.connect = () => {}; client.end = (_force, _opts, done) => done();
  client.publish = (_topic, payload, _opts, done) => { acks.push(JSON.parse(payload)); done(); };
  const error = new AppError("Not echoed", 422, "MEASUREMENT_TYPE_MISMATCH"); error.sourceAuthenticated = true;
  const runtime = startMqtt({ env: { MQTT_ENABLED: "true", MQTT_URL: "mqtt://localhost" }, connect: () => client, logger: { warn: (line) => logs.push(line) }, ingest: async () => { throw error; } });
  const packet = { topic: `novax/v1/sources/${randomUUID()}/telemetry`, payload: Buffer.from(JSON.stringify({ token: "secret-fixture", message: { message_id: randomUUID() } })) };
  await new Promise((resolve) => client.handleMessage(packet, resolve));
  assert.equal(acks[0].status, "REJECTED"); assert.equal(acks[0].code, "MEASUREMENT_TYPE_MISMATCH"); assert.equal(JSON.stringify([...acks, ...logs]).includes("secret-fixture"), false);
  error.sourceAuthenticated = false; await new Promise((resolve) => client.handleMessage(packet, resolve)); assert.equal(acks.length, 1);
  await runtime.stop();
});
