const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { EventEmitter } = require("node:events");
const { validateMappings, validateEnvelope, normalize, readPath } = require("../src/modules/module-integration/normalization/contract");
const { configuration, sourceFromTopic, handlePacket, startMqtt } = require("../src/modules/module-integration/adapters/mqtt.adapter");
const id = randomUUID();
const mapping = () => ({ path: "env.rh", sensor_key: "humidity", metric: "humidity", unit: "%", source_unit: "ratio", data_type: "NUMBER", scale: 100, offset: 0, required: true });
const sensor = { external_id: id, key: "humidity", metric: "humidity", unit: "%", data_type: "NUMBER", minimum_value: 0, maximum_value: 100 };
const now = new Date();
const message = () => ({ schema_version: 1, message_id: randomUUID(), observed_at: now.toISOString(), payload: { env: { rh: 0.7 } } });

test("profiles validate bounded declarative mappings and reject script/prototype paths", () => {
  assert.equal(validateMappings([mapping()])[0].scale, 100);
  for (const patch of [{ path: "__proto__.x" }, { path: "constructor.x" }, { path: "env[0].rh" }, { scale: "100" }, { scale: null }, { offset: null }, { data_type: "SCRIPT" }, { execute: "alert(1)" }, { required: "true" }]) assert.throws(() => validateMappings([{ ...mapping(), ...patch }]));
  assert.throws(() => validateMappings([mapping(), mapping()]));
  assert.throws(() => validateMappings([]));
  assert.throws(() => validateMappings(Array(33).fill(mapping())));
  assert.equal(readPath(Object.create({ humidity: 70 }), "humidity"), undefined);
});
test("normalization preserves zero/false, converts explicitly and distinguishes observation from receipt", () => {
  const profile = { mappings: [mapping()] };
  const first = normalize(profile, message(), [sensor], now)[0];
  assert.equal(first.value, 70); assert.equal(first.unit, "%"); assert.equal(first.timestamp_source, "DEVICE");
  const zero = message(); zero.payload.env.rh = 0;
  assert.equal(normalize(profile, zero, [sensor], now)[0].value, 0);
  const boolProfile = { mappings: [{ ...mapping(), path: "active", sensor_key: "active", metric: "presence", data_type: "BOOLEAN", unit: null, scale: 1 }] };
  assert.equal(normalize(boolProfile, { ...message(), payload: { active: false } }, [{ ...sensor, key: "active", metric: "presence", data_type: "BOOLEAN", unit: null }], now)[0].value, false);
  const estimated = message(); delete estimated.observed_at;
  const output = normalize(profile, estimated, [sensor], now)[0]; assert.equal(output.observed_at, now.toISOString()); assert.equal(output.quality, "UNCERTAIN"); assert.equal(output.timestamp_source, "SERVER");
});
test("normalization rejects implicit coercion, incompatible metadata, missing required readings and future clocks", () => {
  const profile = { mappings: [mapping()] };
  const string = message(); string.payload.env.rh = "0.7";
  assert.throws(() => normalize(profile, string, [sensor], now), { code: "MEASUREMENT_TYPE_MISMATCH" });
  assert.throws(() => normalize(profile, message(), [{ ...sensor, unit: "ratio" }], now), { code: "SENSOR_PROFILE_MISMATCH" });
  assert.throws(() => normalize(profile, { ...message(), payload: {} }, [sensor], now));
  assert.throws(() => normalize(profile, { ...message(), observed_at: "2026-10-18T12:00:00" }, [sensor], now));
  assert.throws(() => normalize(profile, { ...message(), observed_at: "2026-02-30T12:00:00Z" }, [sensor], now));
  assert.throws(() => normalize(profile, { ...message(), observed_at: new Date(now.getTime() + 3600000).toISOString() }, [sensor], now));
  const outside = message(); outside.payload.env.rh = 2;
  assert.equal(normalize(profile, outside, [sensor], now)[0].quality, "UNCERTAIN");
});
test("canonical hashing ignores object key order but rejects unsupported contracts, depth and size", () => {
  const first = message();
  assert.equal(validateEnvelope(first).digest, validateEnvelope({ payload: first.payload, observed_at: first.observed_at, message_id: first.message_id, schema_version: 1 }).digest);
  for (const patch of [{ schema_version: 2 }, { message_id: "local-counter-1" }, { token: "secret" }, { quality: "OK" }, { payload: [] }]) assert.throws(() => validateEnvelope({ ...first, ...patch }));
  assert.throws(() => validateEnvelope({ ...first, payload: { text: "a".repeat(66000) } }));
  let deep = { end: 1 }; for (let index = 0; index < 12; index++) deep = { nested: deep };
  assert.throws(() => validateEnvelope({ ...first, payload: deep }));
});
test("MQTT transport configuration is opt-in, TLS-verified and credential-free in URLs", () => {
  assert.equal(configuration({}), null);
  assert.throws(() => configuration({ MQTT_ENABLED: "true", MQTT_URL: "mqtt://localhost", NODE_ENV: "production" }));
  assert.throws(() => configuration({ MQTT_ENABLED: "true", MQTT_URL: "mqtts://user:secret@host" }));
  const config = configuration({ MQTT_ENABLED: "true", MQTT_URL: "mqtts://host:8883", NODE_ENV: "production", MQTT_USERNAME: "subscriber", MQTT_PASSWORD: "fixture" });
  assert.equal(config.options.rejectUnauthorized, true); assert.equal(config.options.clean, false); assert.equal(config.options.manualConnect, true);
});
test("MQTT adapter validates topic, retained payload and JSON before invoking the common ingestion", async () => {
  const topic = `novax/v1/sources/${id}/telemetry`;
  assert.equal(sourceFromTopic(topic), id); assert.throws(() => sourceFromTopic("novax/#"));
  const packet = { topic, payload: Buffer.from(JSON.stringify({ token: "fixture", message: message() })), retain: false };
  let call;
  await handlePacket(packet, async (input) => { call = input; return {}; });
  assert.equal(call.transport, "MQTT"); assert.equal(call.sourceExternalId, id); assert.equal(call.token, "fixture"); assert.equal(call.request.bodyFields.includes("token"), false);
  await assert.rejects(handlePacket({ ...packet, retain: true }, () => assert.fail()), { code: "RETAINED_TELEMETRY_REJECTED" });
  await assert.rejects(handlePacket({ ...packet, payload: Buffer.from("not JSON") }, () => assert.fail()), { code: "INVALID_MQTT_JSON" });
});
test("MQTT subscriber applies backpressure until persistence and publishes only safe application acknowledgements", async () => {
  const client = new EventEmitter(); let callbackCalled = false, resolveIngest, ack;
  client.connect = () => {};
  client.subscribe = (_topic, options, done) => { assert.equal(options.qos, 1); done(null, [{ qos: 1 }]); };
  client.publish = (_topic, payload, _opts, done) => { ack = JSON.parse(payload); done(); };
  client.end = (_force, _options, done) => done();
  const pending = new Promise((resolve) => { resolveIngest = resolve; });
  const runtime = startMqtt({ env: { MQTT_ENABLED: "true", MQTT_URL: "mqtt://localhost:1883" }, connect: () => client, ingest: () => pending, logger: { warn() {} } });
  client.emit("connect"); assert.equal(runtime.status().subscription_ready, true);
  client.handleMessage({ topic: `novax/v1/sources/${id}/telemetry`, payload: Buffer.from(JSON.stringify({ token: "DO_NOT_LOG", message: message() })) }, () => { callbackCalled = true; });
  await Promise.resolve(); assert.equal(callbackCalled, false);
  resolveIngest({ external_id: id, duplicate: false, reading_count: 1, normalized: { message_id: id } });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(callbackCalled, true); assert.equal(ack.status, "ACCEPTED"); assert.equal(JSON.stringify(ack).includes("DO_NOT_LOG"), false); assert.equal(runtime.status().accepted, 1);
  await runtime.stop();
});
