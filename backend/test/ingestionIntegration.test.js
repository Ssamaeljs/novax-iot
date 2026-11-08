const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID, randomBytes } = require("node:crypto");
test("common ingestion via HTTPS and MQTT, versioned administration, credentials and presence", { skip: process.env.RUN_DATABASE_TESTS !== "1", timeout: 60000 }, async (t) => {
  require("dotenv").config({ quiet: true });
  assert.notEqual(process.env.NODE_ENV, "production");
  const app = require("../index");
  const { sequelize, Tenant, User, Account, Role, Permission, Session, Sensor, Measurement, Device, IntegrationProfile, IntegrationSource, IntegrationMessage, AuditLog } = require("../src/config/models");
  const { generateSessionToken, hashToken } = require("../src/utils/security/apiToken");
  const { handlePacket } = require("../src/modules/module-integration/adapters/mqtt.adapter");
  const { ingest } = require("../src/modules/module-integration/ingestion/ingestion.service");
  const { expire } = require("../src/modules/module-integration/presence/presence.service");
  const originalQuery = sequelize.query.bind(sequelize), originalTransaction = sequelize.transaction.bind(sequelize), originalEnv = { ...process.env };
  const outer = await originalTransaction();
  sequelize.query = (sql, options = {}) => originalQuery(sql, { ...options, transaction: options.transaction || outer });
  sequelize.transaction = (options, callback) => typeof options === "function" ? originalTransaction({ transaction: outer }, options) : originalTransaction({ ...options, transaction: outer }, callback);
  process.env.WEB_ORIGIN = "http://127.0.0.1:4200";
  const server = app.listen(0, "127.0.0.1"); await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}/v1/api/`;
  async function request(path, { method = "GET", body, cookie, token } = {}) {
    const response = await fetch(base + path, { method, headers: { Origin: process.env.WEB_ORIGIN, "Content-Type": "application/json", "X-Novax-CSRF": "1", ...(cookie ? { Cookie: cookie } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: response.status === 204 ? null : await response.json() };
  }
  const envelope = (payload) => ({ schema_version: 1, message_id: randomUUID(), observed_at: new Date().toISOString(), payload });
  const mapping = (path, scale = 1) => ({ path, sensor_key: "humidity", metric: "humidity", unit: "%", source_unit: scale === 1 ? "%" : "ratio", data_type: "NUMBER", scale });
  function publicOnly(value) {
    if (!value || typeof value !== "object") return;
    for (const [key, nested] of Object.entries(value)) { assert.ok(!["id", "tenant_id", "device_id", "sensor_id", "source_id", "profile_id", "token_hash", "integration_message_id"].includes(key), key); publicOnly(nested); }
  }
  try {
    const tenant = await Tenant.create({ name: "NOVAX ingest QA", slug: `ingest-${randomUUID()}`, timezone: "America/Guayaquil" }); process.env.NOVAX_TENANT_EXTERNAL_ID = tenant.external_id;
    async function login(code, keys) {
      const user = await User.create({ tenant_id: tenant.id, first_name: "Test", last_name: "Ingest", id_card: code });
      const account = await Account.create({ tenant_id: tenant.id, user_id: user.id, username: code, email: `${code}@example.test`, password_hash: "fixture-not-used-for-login" });
      const role = await Role.create({ tenant_id: tenant.id, code, name: code }); await role.setPermissions(await Permission.findAll({ where: { key: keys } })); await account.setRoles([role]);
      const token = generateSessionToken(); await Session.create({ tenant_id: tenant.id, account_id: account.id, token_hash: token.tokenHash, token_prefix: token.tokenPrefix, expires_at: new Date(Date.now() + 60000) });
      return `novax_session=${token.token}`;
    }
    const cookie = await login("ingest-editor", ["integrations.read", "integrations.manage", "devices.read", "devices.manage", "sensors.read", "sensors.manage", "measurements.read"]);
    const reader = await login("ingest-reader", ["integrations.read"]);
    const devices = [], profiles = [], sources = [], sensors = [];
    await t.test("administrator creates two transport bindings and immutable versioned data profiles", async () => {
      for (const [index, transport] of ["HTTPS", "MQTT"].entries()) {
        const device = await request("iot/devices", { method: "POST", cookie, body: { name: `Device ${transport}`, device_type: "SIMULATOR", protocol: transport } }); assert.equal(device.status, 201); devices.push(device.body.data);
        const sensor = await request("iot/sensors", { method: "POST", cookie, body: { device_external_id: devices[index].external_id, name: "Humedad", key: "humidity", metric: "humidity", unit: "%", data_type: "NUMBER" } }); assert.equal(sensor.status, 201); sensors.push(sensor.body.data);
        const profile = await request("integrations/profiles", { method: "POST", cookie, body: { name: `Profile ${transport}`, mappings: [mapping(index ? "env.rh" : "hum", index ? 100 : 1)] } }); assert.equal(profile.status, 201); profiles.push(profile.body.data);
        const source = await request("integrations/sources", { method: "POST", cookie, body: { name: transport, device_external_id: devices[index].external_id, profile_external_id: profiles[index].external_id, transport, heartbeat_timeout_seconds: 60 } }); assert.equal(source.status, 201); sources.push(source.body.data); publicOnly(source.body);
      }
      assert.equal((await request("integrations/profiles", { method: "POST", cookie: reader, body: { name: "Denied", mappings: [mapping("hum")] } })).status, 403);
      assert.equal((await request(`integrations/profiles/${profiles[0].external_id}`, { method: "PATCH", cookie, body: { mappings: [mapping("new")] } })).body.code, "UNKNOWN_FIELDS");
      const version = await request(`integrations/profiles/${profiles[0].external_id}/versions`, { method: "POST", cookie, body: { name: "HTTPS v2", mappings: [mapping("humidity")] } });
      assert.equal(version.status, 201); assert.equal(version.body.data.version, 2); assert.equal(version.body.data.code, profiles[0].code);
      const source = await request(`integrations/sources/${sources[0].external_id}`, { cookie }); assert.equal(source.body.data.profile.version, 1); assert.equal(source.body.data.token, undefined); publicOnly(source.body);
    });
    let sent;
    await t.test("organization and transport bindings reject foreign devices and valid credentials from another organization", async () => {
      const foreign = await Tenant.create({ name: "Other fixture", slug: `other-${randomUUID()}` });
      const device = await Device.create({ tenant_id: foreign.id, code: "FOREIGN", name: "Other", device_type: "SIMULATOR", protocol: "HTTPS" });
      const profile = await IntegrationProfile.create({ tenant_id: foreign.id, code: "FOREIGN", name: "Other", mappings: [mapping("hum")] });
      const token = `nvx_ingest_${randomBytes(32).toString("base64url")}`;
      const source = await IntegrationSource.create({ tenant_id: foreign.id, device_id: device.id, profile_id: profile.id, name: "Other", transport: "HTTPS", token_hash: hashToken(token), token_prefix: token.slice(0, 20) });
      assert.equal((await request("integrations/sources", { method: "POST", cookie, body: { name: "Denied", transport: "HTTPS", device_external_id: device.external_id, profile_external_id: profiles[0].external_id } })).body.code, "INVALID_INTEGRATION_BINDING");
      assert.equal((await request(`ingest/https/${source.external_id}`, { method: "POST", token, body: envelope({ hum: 70 }) })).status, 401);
      await assert.rejects(handlePacket({ topic: sources[0].mqtt_topic, payload: Buffer.from(JSON.stringify({ token: sources[0].token, message: envelope({ hum: 70 }) })) }, ingest), { code: "INVALID_SOURCE_CREDENTIAL" });
    });
    await t.test("different wire formats become equivalent common measurements and preview does not persist", async () => {
      const preview = await request(`integrations/profiles/${profiles[0].external_id}/preview`, { method: "POST", cookie, body: { device_external_id: devices[0].external_id, message: envelope({ hum: 72.4 }) } });
      assert.equal(preview.status, 200); assert.equal(await IntegrationMessage.count({ where: { tenant_id: tenant.id } }), 0);
      sent = envelope({ hum: 72.4 });
      const https = await request(`ingest/https/${sources[0].external_id}`, { method: "POST", token: sources[0].token, body: sent }); assert.equal(https.status, 201); publicOnly(https.body);
      const mqtt = await handlePacket({ topic: sources[1].mqtt_topic, payload: Buffer.from(JSON.stringify({ token: sources[1].token, message: envelope({ env: { rh: 0.724 } }) })), retain: false }, ingest);
      assert.ok(Math.abs(https.body.data.normalized.readings[0].value - mqtt.normalized.readings[0].value) < 1e-9);
      assert.equal(await Measurement.count({ where: { tenant_id: tenant.id } }), 2);
      const row = await Measurement.findOne({ where: { tenant_id: tenant.id } }); assert.equal(row.metric_snapshot, "humidity"); assert.equal(row.unit_snapshot, "%"); assert.equal(row.source_payload, null);
      const device = await Device.findOne({ where: { external_id: devices[0].external_id } }); assert.equal(device.status, "ONLINE"); assert.ok(device.last_seen_at);
    });
    await t.test("replays are idempotent, conflicting IDs and malformed messages do not write partial state", async () => {
      const repeat = await request(`ingest/https/${sources[0].external_id}`, { method: "POST", token: sources[0].token, body: sent }); assert.equal(repeat.status, 200); assert.equal(repeat.body.data.duplicate, true);
      assert.equal((await request(`ingest/https/${sources[0].external_id}`, { method: "POST", token: sources[0].token, body: { ...sent, payload: { hum: 80 } } })).body.code, "MESSAGE_ID_CONFLICT");
      assert.equal((await request(`ingest/https/${sources[0].external_id}`, { method: "POST", token: sources[0].token, body: envelope({ hum: "72.4" }) })).status, 422);
      assert.equal(await Measurement.count({ where: { tenant_id: tenant.id } }), 2);
      assert.equal(await IntegrationMessage.count({ where: { tenant_id: tenant.id } }), 2);
      assert.equal((await request(`iot/sensors/${sensors[0].external_id}`, { method: "PATCH", cookie, body: { unit: "ratio" } })).body.code, "SENSOR_SCHEMA_IN_USE");
    });
    await t.test("source credentials cannot be replaced by sessions, crossed between sources or survive rotation", async () => {
      const path = `ingest/https/${sources[0].external_id}`;
      assert.equal((await request(path, { method: "POST", cookie, body: sent })).status, 401);
      assert.equal((await request(path, { method: "POST", token: sources[1].token, body: sent })).status, 401);
      assert.equal((await request(`integrations/sources/${sources[0].external_id}/rotate`, { method: "POST", cookie: reader, body: {} })).status, 403);
      const rotated = await request(`integrations/sources/${sources[0].external_id}/rotate`, { method: "POST", cookie, body: {} }); assert.equal(rotated.status, 200);
      assert.equal((await request(path, { method: "POST", token: sources[0].token, body: sent })).status, 401); sources[0].token = rotated.body.data.token;
    });
    await t.test("timeouts update presence without changing measurement observation time or exposing internal IDs", async () => {
      await Device.update({ last_seen_at: new Date(Date.now() - 3600000), status: "ONLINE" }, { where: { tenant_id: tenant.id } });
      assert.equal(await expire(), 2);
      assert.equal((await Device.findOne({ where: { external_id: devices[0].external_id } })).status, "OFFLINE");
      const listed = await request("integrations/messages", { cookie: reader }); assert.equal(listed.status, 200); publicOnly(listed.body); assert.equal(listed.body.data.length, 2); assert.ok(listed.body.data[0].message_id);
      const audit = await AuditLog.findOne({ where: { tenant_id: tenant.id, action: "INGEST", outcome: "FAILURE" } }); assert.ok(audit); assert.equal(JSON.stringify(audit.details).includes(sources[0].token), false);
    });
    await t.test("disabled profiles and sources stop ingestion and legacy protocols cannot be newly registered", async () => {
      assert.equal((await request("iot/devices", { method: "POST", cookie, body: { name: "Camera", device_type: "CAMERA", protocol: "ONVIF" } })).status, 422);
      const legacy = await Device.create({ tenant_id: tenant.id, code: "LEGACY-CAMERA", name: "Legacy", device_type: "CAMERA", protocol: "ONVIF" });
      assert.equal((await request(`iot/devices/${legacy.external_id}`, { method: "PATCH", cookie, body: { name: "Legacy renamed", protocol: "ONVIF" } })).status, 200);
      assert.equal((await request(`iot/devices/${devices[0].external_id}`, { method: "PATCH", cookie, body: { protocol: "ONVIF" } })).body.code, "LEGACY_PROTOCOL_READ_ONLY");
      await request(`integrations/profiles/${profiles[0].external_id}`, { method: "PATCH", cookie, body: { is_active: false } });
      assert.equal((await request(`ingest/https/${sources[0].external_id}`, { method: "POST", token: sources[0].token, body: envelope({ hum: 70 }) })).body.code, "INTEGRATION_INACTIVE");
      await request(`integrations/sources/${sources[1].external_id}`, { method: "PATCH", cookie, body: { is_active: false } });
      await assert.rejects(handlePacket({ topic: sources[1].mqtt_topic, payload: Buffer.from(JSON.stringify({ token: sources[1].token, message: envelope({ env: { rh: 0.7 } }) })) }, ingest), { code: "INVALID_SOURCE_CREDENTIAL" });
      await Device.update({ status: "ONLINE", last_seen_at: new Date(Date.now() - 3600000) }, { where: { external_id: devices[1].external_id } });
      assert.equal(await expire(), 1);
    });
    await t.test("device sensor pages are scoped, preserve zero and false, select latest observation and enforce measurement permission", async () => {
      const device = await Device.findOne({ where: { external_id: devices[0].external_id } });
      const original = await Sensor.findOne({ where: { external_id: sensors[0].external_id } });
      const at = new Date();
      await Measurement.create({ tenant_id: tenant.id, device_id: device.id, sensor_id: original.id, observed_at: at, value_number: 99 });
      await Measurement.create({ tenant_id: tenant.id, device_id: device.id, sensor_id: original.id, observed_at: at, value_number: 0, unit_snapshot: "%" });
      await Measurement.create({ tenant_id: tenant.id, device_id: device.id, sensor_id: original.id, observed_at: new Date(at.getTime() - 1000), value_number: 99 });
      const flag = await Sensor.create({ tenant_id: tenant.id, device_id: device.id, name: "Contacto", key: "contact", metric: "contact", data_type: "BOOLEAN" });
      await Measurement.create({ tenant_id: tenant.id, device_id: device.id, sensor_id: flag.id, observed_at: at, value_boolean: false });
      const empty = await Sensor.create({ tenant_id: tenant.id, device_id: device.id, name: "Vacío", key: "empty", metric: "test" });
      const listed = await request(`iot/sensors?device_external_id=${device.external_id}&include_latest=true`, { cookie });
      assert.equal(listed.status, 200); publicOnly(listed.body); assert.equal(listed.body.data.length, 3);
      assert.ok(listed.body.data.every((sensor) => sensor.device.external_id === device.external_id));
      assert.equal(listed.body.data.find((sensor) => sensor.external_id === original.external_id).latest_measurement.value, 0);
      assert.equal(listed.body.data.find((sensor) => sensor.external_id === flag.external_id).latest_measurement.value, false);
      assert.equal(listed.body.data.find((sensor) => sensor.external_id === empty.external_id).latest_measurement, null);
      const limited = await login("sensor-reader", ["sensors.read"]);
      assert.equal((await request(`iot/sensors?device_external_id=${device.external_id}`, { cookie: limited })).status, 200);
      assert.equal((await request(`iot/sensors?device_external_id=${device.external_id}&include_latest=true`, { cookie: limited })).status, 403);
      const paged = await request(`iot/sensors?device_external_id=${device.external_id}&include_latest=true&page_size=1`, { cookie });
      assert.equal(paged.body.data.length, 1); assert.equal(paged.body.pagination.total, 3);
      assert.equal((await request("iot/sensors?device_external_id=123", { cookie })).status, 422);
      const foreignTenant = await Tenant.create({ name: "Other", slug: `sensor-${randomUUID()}` });
      const foreignDevice = await Device.create({ tenant_id: foreignTenant.id, name: "Foreign", code: "FOREIGN-SENSOR", protocol: "HTTPS", device_type: "TEST" });
      assert.equal((await request(`iot/sensors?device_external_id=${foreignDevice.external_id}`, { cookie })).status, 404);
      assert.equal((await request(`iot/sensors/${empty.external_id}`, { method: "PATCH", cookie, body: { minimum_value: 1, maximum_value: 10 } })).status, 200);
      assert.equal((await request(`iot/sensors/${empty.external_id}`, { method: "PATCH", cookie, body: { maximum_value: 0 } })).body.code, "INVALID_RANGE");
    });
    await t.test("nested device routes create and manage channels under their actual ESP32", async () => {
      const path = `iot/devices/${devices[0].external_id}/sensors`;
      const input = { name: "Temperatura DHT11", key: "dht11_temperature", metric: "temperature", unit: "°C", data_type: "NUMBER" };
      const created = await request(path, { method: "POST", cookie, body: input });
      assert.equal(created.status, 201); publicOnly(created.body);
      const child = created.body.data;
      const stored = await Sensor.findOne({ where: { external_id: child.external_id } });
      const parent = await Device.findOne({ where: { external_id: devices[0].external_id } });
      assert.equal(stored.device_id, parent.id);
      assert.equal((await request(`${path}/${child.external_id}`, { cookie })).body.data.device.external_id, parent.external_id);
      const listed = await request(`${path}?include_latest=true&page_size=1`, { cookie });
      assert.equal(listed.status, 200); assert.equal(listed.body.data.length, 1);
      assert.ok(listed.body.data.every((sensor) => sensor.device.external_id === parent.external_id)); publicOnly(listed.body);
      assert.equal((await request(path, { method: "POST", cookie, body: input })).status, 409);
      assert.equal((await request(`iot/devices/${devices[1].external_id}/sensors`, { method: "POST", cookie, body: input })).status, 201);
      assert.equal((await request(`${path}/${child.external_id}`, { method: "PATCH", cookie, body: { name: "Temperatura ambiente" } })).status, 200);
      assert.equal((await request(`${path}/${child.external_id}`, { method: "DELETE", cookie })).status, 204);
      await stored.reload(); assert.equal(stored.is_active, false);
      assert.equal((await request(`${path}/${child.external_id}`, { method: "PATCH", cookie, body: { is_active: true } })).status, 200);
    });
    await t.test("nested ownership cannot be bypassed through body, query, child UUID or missing permissions", async () => {
      const path = `iot/devices/${devices[0].external_id}/sensors`;
      const otherChild = sensors[1].external_id;
      for (const method of ["GET", "PATCH", "DELETE"]) {
        assert.equal((await request(`${path}/${otherChild}`, { method, cookie, ...(method === "PATCH" ? { body: { name: "Forbidden edit" } } : {}) })).status, 404);
      }
      assert.equal((await request(`${path}?device_external_id=${devices[1].external_id}`, { cookie })).body.code, "DEVICE_SCOPE_MISMATCH");
      assert.equal((await request(path, { method: "POST", cookie, body: { device_external_id: devices[1].external_id, name: "Wrong parent", key: "wrong", metric: "test" } })).body.code, "DEVICE_SCOPE_MISMATCH");
      assert.equal((await request(`${path}/${sensors[0].external_id}`, { method: "PATCH", cookie, body: { device_external_id: devices[1].external_id } })).body.code, "IMMUTABLE_FIELD");
      const limited = await login("nested-reader", ["devices.read", "sensors.read"]);
      assert.equal((await request(path, { cookie: limited })).status, 200);
      assert.equal((await request(`${path}?include_latest=true`, { cookie: limited })).status, 403);
      assert.equal((await request(path, { method: "POST", cookie: limited, body: {} })).status, 403);
      assert.equal((await request(path, { cookie: reader })).status, 403);
      assert.equal((await request("iot/devices/123/sensors", { cookie })).status, 422);
      const foreignTenant = await Tenant.create({ name: "Foreign nested", slug: `nested-${randomUUID()}` });
      const foreignDevice = await Device.create({ tenant_id: foreignTenant.id, name: "Foreign ESP32", code: "FOREIGN-NESTED", protocol: "HTTPS", device_type: "ESP32" });
      assert.equal((await request(`iot/devices/${foreignDevice.external_id}/sensors`, { cookie })).status, 404);
      const parent = await Device.findOne({ where: { external_id: devices[0].external_id } });
      await parent.update({ is_active: false });
      assert.equal((await request(`${path}/${sensors[0].external_id}`, { method: "PATCH", cookie, body: { name: "Inactive parent" } })).body.code, "DEVICE_INACTIVE");
      assert.equal((await request(path, { cookie })).status, 200);
      await parent.update({ is_active: true });
    });
    await t.test("production HTTPS rejects cleartext transport without trusting spoofed forwarded headers", async () => {
      const previous = process.env.NODE_ENV; process.env.NODE_ENV = "production";
      try {
        const response = await fetch(base + `ingest/https/${sources[0].external_id}`, { method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-Proto": "https", Authorization: `Bearer ${sources[0].token}` }, body: JSON.stringify(sent) });
        assert.equal(response.status, 426);
      } finally { process.env.NODE_ENV = previous; }
    });
  } finally {
    await new Promise((resolve) => server.close(resolve)); sequelize.query = originalQuery; sequelize.transaction = originalTransaction; await outer.rollback(); await sequelize.close();
    for (const key of ["NOVAX_TENANT_EXTERNAL_ID", "WEB_ORIGIN"]) if (originalEnv[key] === undefined) delete process.env[key]; else process.env[key] = originalEnv[key];
  }
});
