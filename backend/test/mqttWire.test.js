const test = require("node:test");
const assert = require("node:assert/strict");
const net = require("node:net");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { startMqtt } = require("../src/modules/module-integration/adapters/mqtt.adapter");

// Minimal protocol fixture, not a production broker. Uses MQTT.js's locked packet dependency.
test("MQTT.js receives QoS 1 over real TCP and acknowledges only after the ingestion promise commits", { skip: process.env.RUN_MQTT_WIRE_TESTS !== "1", timeout: 15000 }, async () => {
  const packets = require(require.resolve("mqtt-packet", { paths: [path.dirname(require.resolve("mqtt"))] }));
  const id = randomUUID(), messageId = randomUUID();
  const topic = `novax/v1/sources/${id}/telemetry`;
  let release, received, telemetryAck = false, applicationAck, socket, stopping = false;
  const committed = new Promise((resolve) => { release = resolve; });
  const started = new Promise((resolve) => { received = resolve; });
  let resolveAck;
  const acknowledged = new Promise((resolve) => { resolveAck = resolve; });
  const server = net.createServer((connection) => {
    socket = connection;
    connection.on("error", (error) => { if (!(stopping && error.code === "ECONNRESET")) throw error; });
    const parser = packets.parser();
    const send = (packet) => connection.write(packets.generate(packet));
    connection.on("data", (chunk) => parser.parse(chunk));
    parser.on("packet", (packet) => {
      if (packet.cmd === "connect") send({ cmd: "connack", returnCode: 0, sessionPresent: false });
      if (packet.cmd === "subscribe") {
        send({ cmd: "suback", messageId: packet.messageId, granted: [1] });
        send({ cmd: "publish", qos: 1, dup: false, retain: false, topic, messageId: 123, payload: Buffer.from(JSON.stringify({ token: "fixture-not-a-real-credential", message: { schema_version: 1, message_id: messageId, payload: { hum: 70 } } })) });
      }
      if (packet.cmd === "publish" && packet.topic === topic.replace(/telemetry$/, "ack")) {
        applicationAck = JSON.parse(packet.payload.toString());
        send({ cmd: "puback", messageId: packet.messageId });
      }
      if (packet.cmd === "puback" && packet.messageId === 123) { telemetryAck = true; resolveAck(); }
      if (packet.cmd === "pingreq") send({ cmd: "pingresp" });
      if (packet.cmd === "disconnect") connection.end();
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const runtime = startMqtt({ env: { MQTT_ENABLED: "true", MQTT_URL: `mqtt://127.0.0.1:${server.address().port}`, MQTT_CLIENT_ID: `qa-${randomUUID()}` }, logger: { warn() {} }, ingest: async (input) => {
    assert.equal(input.transport, "MQTT"); assert.equal(input.envelope.message_id, messageId); received();
    await committed;
    return { external_id: id, duplicate: false, reading_count: 1, normalized: { message_id: messageId } };
  } });
  try {
    await started; assert.equal(telemetryAck, false);
    release(); await acknowledged;
    assert.equal(telemetryAck, true); assert.equal(applicationAck.status, "ACCEPTED"); assert.equal(applicationAck.message_id, messageId);
    assert.equal(runtime.status().accepted, 1);
  } finally { stopping = true; await runtime.stop(); socket?.destroy(); await new Promise((resolve) => server.close(resolve)); }
});
